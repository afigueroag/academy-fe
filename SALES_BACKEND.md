# Sales Backend — Reglas pendientes (D-G)

Documento de handoff para el equipo de backend.

Los **cambios estructurales (A-C)** —nuevos campos, nuevos endpoints, nuevos filtros— ya están aplicados en [openapi.json](openapi.json). Este documento concentra las **reglas de negocio que no cambian la forma del API** pero sí su comportamiento: validaciones cross-field, restricciones por estado, comportamientos en cascada y gating por rol.

El frontend del módulo de Ventas se construye asumiendo que estas reglas estarán implementadas.

---

## D. Validaciones Pydantic (cross-field, independientes de la BD)

Se implementan con `@model_validator(mode='after')` en los schemas Create/Update. Devuelven **422** con `detail[].loc` apuntando al campo, para que `ApiError.fieldErrors` del frontend ([src/api.ts](src/api.ts)) las muestre inline.

### D.1 `TransactionCreate` / `TransactionUpdate`

| Regla | Mensaje en español |
|---|---|
| Si `status == 'paid'` → `paid_date` requerido | "Una transacción pagada debe tener fecha de pago." |
| Si `status == 'paid'` → `payment_method` requerido | "Una transacción pagada debe tener método de pago." |
| Si `kind == 'sale'` → `category` debe estar en `{tuition, enrollment_fee, material_sale, exam_fee, private_class, other_income}` | "La categoría no corresponde a una venta." |
| Si `kind == 'expense'` → `category` debe estar en `{rent, utilities, salary, marketing, equipment, other_expense}` | "La categoría no corresponde a un gasto." |
| Si `period_start` y `period_end` ambos presentes → `period_end >= period_start` | "El fin del periodo debe ser igual o posterior al inicio." |
| `user_id` y `external_name` **XOR**: exactamente uno debe estar presente, no ambos ni ninguno | "Define cliente registrado o externo (no ambos)." / "Debes indicar un cliente registrado o un nombre externo." |
| `amount > 0` | "El monto debe ser mayor a cero." |

### D.2 `RecurringTransactionCreate` / `RecurringTransactionUpdate`

| Regla | Mensaje |
|---|---|
| Si `frequency in {monthly, quarterly, semester, annual}` → `billing_day` requerido | "El día de cobro es obligatorio para esta frecuencia." |
| Si `billing_day` está presente → `1 <= billing_day <= 28` | "El día de cobro debe estar entre 1 y 28." |
| Si `start_date` y `end_date` ambos presentes → `end_date > start_date` | "La fecha de fin debe ser posterior a la de inicio." |
| Mismas reglas XOR de `user_id`/`external_name` que en transacciones. | (idem) |
| Mismas reglas de coherencia `kind`↔`category` que en transacciones. | (idem) |
| `amount > 0` | (idem) |

### D.3 `AcademyUpdate`

| Regla | Mensaje |
|---|---|
| Si `enrollment_fee_mode in {annual_recurring, one_time_on_signup}` → `enrollment_fee_amount` requerido y `> 0` | "Debes definir el monto de inscripción." |
| Si `enrollment_fee_mode == 'annual_recurring'` → `enrollment_fee_month` requerido y `1 <= ... <= 12` | "Debes definir el mes de la cuota anual." |
| Si `default_billing_day` está presente → `1 <= ... <= 28` | "El día de cobro debe estar entre 1 y 28." |
| Si `billing_lookahead_months` está presente → `1 <= ... <= 12` | "El periodo de proyección debe estar entre 1 y 12 meses." |

---

## E. Reglas de service-layer (dependen del estado actual en BD)

Estas **no** se pueden poner en Pydantic porque dependen del registro existente. Se aplican en el endpoint después de leer la BD. Devuelven 422 con el mismo formato que Pydantic (o 409 cuando aplica).

### E.1 `PATCH /transactions/{id}` — campos editables por estado

| Status actual | Campos editables | Campos bloqueados | Si se intenta editar uno bloqueado |
|---|---|---|---|
| `scheduled` | Todos excepto `kind`, `recurring_id` | `kind`, `recurring_id` | 422 por campo |
| `pending` | Todos excepto `kind`, `recurring_id` | `kind`, `recurring_id` | 422 por campo |
| `paid` | Solo `description`, `payment_reference`, `payment_notes` | Todo lo demás | 422 por campo |
| `cancelled` | Ninguno | Todos | 409 "La transacción ya está cancelada." |

**Implementación sugerida** (Python pseudocódigo):

```python
ALWAYS_BLOCKED = {"kind", "recurring_id"}
EDITABLE_WHEN_PAID = {"description", "payment_reference", "payment_notes"}

def validate_transaction_update(existing, update_dict):
    if existing.status == "cancelled":
        raise HTTPException(409, "La transacción ya está cancelada.")

    if existing.status == "paid":
        blocked = [f for f in update_dict if f not in EDITABLE_WHEN_PAID]
    else:  # scheduled o pending
        blocked = [f for f in update_dict if f in ALWAYS_BLOCKED]

    if blocked:
        raise HTTPException(422, detail=[
            {
                "loc": ["body", f],
                "msg": f"No editable en estado {existing.status}",
                "type": "value_error",
            }
            for f in blocked
        ])
```

### E.2 `DELETE /transactions/{id}` — restricciones de cancelación (soft delete)

El DELETE no borra: cambia `status` a `cancelled`.

| Status actual | Acción | Respuesta |
|---|---|---|
| `scheduled` | Cambia a `cancelled` | 200 |
| `pending` | Cambia a `cancelled` | 200 |
| `paid` | Bloquea | 409 "No se puede cancelar una transacción pagada. Esta versión no soporta reembolsos." |
| `cancelled` | Bloquea | 409 "La transacción ya está cancelada." |

### E.3 `DELETE /recurring-transactions/{id}` — cascada de cancelación

Cuando se desactiva (soft-delete) una recurrencia:

1. Marcar el recurring como inactivo (set `end_date = today` o flag equivalente; lo que el FE debe ver es `active = false` cuando filtre con `?active=false`).
2. Buscar `Transaction WHERE recurring_id = id AND status = 'scheduled'`.
3. Actualizar todas a `status = 'cancelled'`.
4. **No tocar** las `pending` (es deuda real del estudiante, debe seguirse cobrando) ni las `paid`.

---

## F. Comportamientos / jobs

### F.1 Job de generación de transacciones programadas

Job diario (o cuando el equipo decida) que por cada recurring **activo**:

1. Calcula las próximas fechas de cobro dentro de la ventana `today + academy.billing_lookahead_months`.
2. Aplica `academy.weekend_billing_behavior` (`ignore | shift_previous | shift_next`) si la fecha cae en sábado/domingo.
3. Inserta `Transaction(status='scheduled', recurring_id=ese, period_start, period_end, amount, ...)`.
4. **Idempotencia**: agregar restricción `UNIQUE (recurring_id, period_start)` en la tabla `Transaction` para evitar duplicados si el job se reejecuta.

> Si este job ya existe, confirmar al equipo de frontend para no asumir lo contrario.

### F.2 Transición `scheduled → pending`

Cuando una transacción `scheduled` vence (`transaction_date < today`) sin pagarse, debe pasar a `pending`. Puede ser parte del mismo job diario o uno separado.

### F.3 Auto-creación al crear estudiante

El **frontend** orquesta esto en dos requests (no requiere endpoint nuevo):

1. `POST /users` para crear al estudiante.
2. Si la academia tiene `default_billing_day` (o el usuario llenó el bloque "Cobro mensual" del formulario): `POST /recurring-transactions` con `category='tuition'`, `frequency='monthly'`, `user_id=<nuevo>`, `billing_day`, `amount`.
3. Si la academia tiene `enrollment_fee_mode='annual_recurring'`: `POST /recurring-transactions` con `category='enrollment_fee'`, `frequency='annual'`, `user_id`, `amount=enrollment_fee_amount`, `billing_day=1` del mes `enrollment_fee_month`.
4. Si `enrollment_fee_mode='one_time_on_signup'`: `POST /transactions` con `kind='sale'`, `category='enrollment_fee'`, `status='pending'`, `amount=enrollment_fee_amount`, `transaction_date=today`.
5. Si `enrollment_fee_mode='none'`: nada.

> El BE no necesita cambio para esto. Solo asegurar que los endpoints existentes acepten estas combinaciones.

---

## G. Gating por rol

### G.1 `receptionist`

| Endpoint | Comportamiento |
|---|---|
| `GET /transactions` | Filtra automáticamente a `status in {pending, scheduled}` (no ve histórico pagado) |
| `POST /transactions` | OK (puede registrar ventas, ej. material) |
| `PATCH /transactions/{id}` | OK únicamente cuando el cambio es `status: 'paid'` + `paid_date` + `payment_method` (+ opcional `payment_reference`, `payment_notes`). Cualquier otro cambio → 403 |
| `DELETE /transactions/{id}` | 403 "No tienes permiso para cancelar transacciones." |
| `GET /transactions/{id}` | OK pero solo si el registro está en `pending` o `scheduled` (mismo filtro que el listado) |
| `GET /transactions/summary` | Devuelve `pending_count` con el valor real; **los campos `total`, `paid`, `pending`, `total_count` se devuelven en `0`** (o el endpoint puede regresar `0` en ellos sin lanzar error — el frontend ya los oculta para este rol) |
| `GET /recurring-transactions` | OK (lectura) |
| `POST /recurring-transactions` | 403 |
| `PATCH /recurring-transactions/{id}` | 403 |
| `DELETE /recurring-transactions/{id}` | 403 |
| `GET /users` | OK (necesita `debt_amount`, `next_due_date` para cobrar) |

### G.2 `admin`

Todos los endpoints sin restricción.

### G.3 `instructor`, `student`

Fuera del alcance de este módulo. Se atará en una sesión posterior; mientras tanto pueden quedar con la política actual.

---

## Resumen

- **D**: 7 validaciones Pydantic en `TransactionCreate/Update`, 6 en `RecurringTransaction*`, 4 en `AcademyUpdate`.
- **E**: matriz de editabilidad por status en PATCH transactions, restricciones en DELETE transactions, cascada en DELETE recurring.
- **F**: job de generación + transición scheduled→pending + flujo de auto-creación al alta de estudiante (manejado por FE).
- **G**: gating de receptionist en 9 endpoints; admin sin restricción.

Cualquier divergencia entre lo aquí descrito y la realidad final del backend, debe actualizarse en este archivo y notificarse al equipo de frontend.
