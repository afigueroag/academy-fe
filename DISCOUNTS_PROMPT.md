# Módulo: Descuentos (Cantera)

## 1. Contexto del proyecto

Cantera, SaaS de gestión de academias. Integrar la funcionalidad de **descuentos** sobre los pagos. Hay DOS mecanismos y NINGUNO es un CRUD tipo Students/Instructors, así que **no parametrices `UsersModule.tsx` ni crees una página nueva con ruta/sidebar**:

1. **Descuento por estudiante** (tabla `discount`, persistente/recurrente): se gestiona DENTRO de la pantalla de edición de estudiante. El backend lo consume al generar recurring transactions.
2. **Descuento puntual** en una transacción: se captura al crear/editar una transacción, vive en los campos `discount_*` de la propia transacción.

Antes de tocar código lee: STYLE_GUIDE.md, openapi.json, src/api.ts, src/types.ts. La fuente de verdad es openapi.json (ya está actualizado con todo lo necesario).

## 2. Identidad visual

Sigue tokens y clases de STYLE_GUIDE.md. Reusa `.field`/`.field--row`/`.select`/`.input`/`.textarea`/`.field__error`, `.table-wrapper`/`.users-table`, `.detail-list`/`.detail-item`, `.badge`, `<SidePanel>`, `<ConfirmModal danger>`, `.row-actions`/`.icon-btn`. Solo agrega CSS nuevo a src/styles.css con clase semántica si un patrón no existe (p. ej. una fila de resumen "Monto neto"); nada inline, sin libs ni íconos nuevos (usa los de src/brand.tsx).

## 3. Enums (del backend, en español; déjalos fáciles de extender)

Crea helpers de label (estilo src/utils/salesLabels.ts) para que agregar un valor futuro sea una línea:

| Enum | Valor | Label |
|------|-------|-------|
| `DiscountType` | `family_discount` | "Familiar" |
| | `scholarship` | "Beca" |
| | `other` | "Otro" |
| `DiscountValueType` | `percentage` | "Porcentual" |
| | `fixed` | "Fijo" |
| `DiscountAppliesTo` | `tuition` | "Mensualidad" |
| | `enrollment_fee` | "Inscripción" |
| | `both` | "Ambos" |

## 4. Sincronización de tipos y API

### 4.1 src/types.ts
- Agrega uniones: `DiscountType`, `DiscountValueType`, `DiscountAppliesTo`.
- Agrega `DiscountCreate`, `DiscountUpdate`, `DiscountRead` según openapi:
  - `user_id:number`, `type:DiscountType`, `value_type:DiscountValueType`, `percentage:number|null`, `amount:number|null` (cents), `applies_to:DiscountAppliesTo`, `description:string|null`. `DiscountRead` añade `is_active:boolean`, `id:number`. `DiscountUpdate` incluye `is_active:boolean`. (Requeridos en create: `user_id`, `type`, `value_type`, `applies_to`.)
- Agrega `ListDiscountsParams` (`user_id?`, `type?`, `applies_to?`, `active?`, `search?`, `skip?`, `limit?`).
- **MODIFICA las transacciones** (el openapi cambió: ya NO existe `amount` en create/update, ahora es `gross_amount`):
  - `TransactionCreate` (y `TransactionUpdate`): quita `amount`; agrega `gross_amount:number`, `discount_amount:number|null`, `discount_percentage:number|null`, `discount_description:string|null`, `discount_id:number|null`.
  - `TransactionRead`: **ya no es un simple `extends TransactionCreate`**. Incluye todo lo de create/update **más** `amount:number` (neto, calculado por el backend, read-only), `id:number`, `user:UserPublic|null`.
- **NO toques** `RecurringTransaction*.amount` ni `TransactionUserRead.amount`.

### 4.2 src/api.ts (todos lanzan ApiError)
- Nuevos: `listDiscounts(params:ListDiscountsParams)` → `GET /discounts`, `getDiscount(id)`, `createDiscount(payload:DiscountCreate)` → `POST /discounts`, `updateDiscount(id,payload:DiscountUpdate)` → `PATCH /discounts/{id}`, `deleteDiscount(id)` → `DELETE /discounts/{id}`.
- Ajusta los endpoints de transacción existentes al nuevo payload de escritura (`gross_amount` + `discount_*`, sin `amount`).

## 5. Modelo de datos / reglas de negocio

**Descuento por estudiante:**
- Un estudiante puede tener VARIOS descuentos activos a la vez (incluso mezclando `fixed` + `percentage`).
- Según `value_type`: si `fixed` usa `amount` (cents) y deja `percentage:null`; si `percentage` usa `percentage` (entero 0–100) y deja `amount:null`. Exactamente uno.
- `applies_to` define si pega a inscripción, mensualidad o ambos.
- La aplicación a las recurring transactions la hace el BACKEND; el front solo administra la tabla (CRUD + activar/desactivar) por `user_id`.

**Descuento puntual (en la transacción):**
- Es `fixed` **O** `percentage`, nunca ambos a la vez.
- El admin captura `gross_amount` (monto bruto) y el descuento. El **neto** = `gross_amount − discount_amount` (fijo) o `gross_amount × (1 − discount_percentage/100)` (porcentual). El backend devuelve ese neto en `TransactionRead.amount`; el front lo calcula solo para previsualizarlo en vivo dentro del formulario.
- Un descuento puntual **sobreescribe** cualquier descuento heredado: no se acumulan en la misma transacción. El front solo edita los campos `discount_*` de esa transacción.
- `discount_id` solo lo setea el backend para transacciones generadas desde un descuento recurrente. En alta/edición manual el front lo deja como está (null en create); si viene poblado, muéstralo read-only para trazabilidad.
- Validaciones: neto ≥ 0 (descuento fijo ≤ bruto), porcentaje entre 0 y 100. Dinero en cents con toCents/fromCents/formatMoney (src/utils/money.ts).

## 6. UI / flujos

### A) Sección de descuentos en edición de estudiante
En el panel de edición de estudiante de src/pages/UsersModule.tsx (estado `kind:'edit'`, solo cuando `role==='student'`), añade una sección nueva (componente `src/components/StudentDiscountsSection.tsx`, siguiendo el patrón de los componentes de sección existentes como UserDocumentsSection/EnrollmentSection):
- Carga con `listDiscounts({ user_id })`. Tres estados: cargando (`SpinnerIcon`), vacío (`.empty-state`), error (`.alert`).
- Lista cada descuento: tipo, valor (porcentaje o monto formateado), a qué aplica, descripción, y badge de activo/inactivo.
- Botón "Agregar descuento" → formulario (inline o `<SidePanel>`): `type` (select), `value_type` (select/tabs fijo|porcentual), campo condicional **monto** (si fijo) **o** **porcentaje** (si porcentual), `applies_to` (select), `description` (textarea opcional).
- Por fila (`.row-actions`/`.icon-btn`): activar/desactivar (PATCH `is_active`), editar (cambiar `type`, `value_type`, valor, `applies_to`, `description`, `is_active`), eliminar con `<ConfirmModal danger>`.
- Toast de éxito `.alert.alert--success` autodismiss 4s (patrón showToast de UsersModule).

### B) Descuento puntual en src/components/TransactionForm.tsx
- Renombra el label del campo de monto a **"Monto bruto"** y mapea su estado a `gross_amount`.
- Agrega un bloque de descuento: selector de tipo (`Sin descuento` | `Fijo` | `Porcentual`), un campo de valor condicional (monto en moneda si fijo / porcentaje si porcentual) y `description` opcional.
- Muestra en read-only el **Monto neto** calculado en vivo (usa una fila/resumen con clase semántica si hace falta CSS).
- En submit arma el payload con `gross_amount` + (`discount_amount` XOR `discount_percentage`) + `discount_description` (el campo no usado va null). Conserva `discount_id` existente en edición; null en create. **No** envíes `amount` (es read-only del backend).
- Respeta el comportamiento `readonly` cuando la transacción está `paid`.
- Si `transaction.discount_id` viene poblado, muestra una nota read-only de trazabilidad ("Descuento aplicado desde configuración del estudiante"); editar el descuento puntual lo sobreescribe.

### C) Listas y detalle de transacciones
- **Listas no se tocan**: `TransactionRead.amount` ya es el neto, así que `formatMoney(t.amount, ...)` en src/pages/Sales.tsx, src/pages/Gastos.tsx y src/components/RegisterPaymentForm.tsx sigue mostrando el neto correctamente.
- **Detalle** (src/components/TransactionDetails.tsx): muestra bruto (`gross_amount`), descuento (monto o porcentaje + `discount_description`) y neto (`amount`). Si hay `discount_id`, indica que el descuento proviene de la configuración del estudiante.

## 7. Ruta y navegación

Ninguna ruta nueva en src/App.tsx ni entrada nueva en el sidebar de src/components/Layout.tsx. Ambos flujos viven dentro de pantallas existentes (edición de estudiante y formulario de transacción).

## 8. Reglas y restricciones

- Todo en español. CSS solo en src/styles.css (clases semánticas, sin inline). Sin dependencias nuevas. Sin emojis. Tokens CSS para colores. Dinero en cents. Toda lista con sus tres estados (cargando/vacío/error). Acciones destructivas con `<ConfirmModal danger>`. Manejo de error con el patrón ApiError de STYLE_GUIDE.

## 9. Definition of Done

- [ ] src/types.ts: `Discount*` + enums + `ListDiscountsParams`; `TransactionCreate/Update` con `gross_amount`+`discount_*` (sin `amount`); `TransactionRead` con `amount` (neto) + `gross_amount` + `discount_*` + `discount_id`.
- [ ] src/api.ts: `listDiscounts`/`getDiscount`/`createDiscount`/`updateDiscount`/`deleteDiscount`; endpoints de transacción con el nuevo payload de escritura.
- [ ] Helpers de label para `DiscountType`/`DiscountValueType`/`DiscountAppliesTo`.
- [ ] `StudentDiscountsSection` en el panel de edición de estudiante: listar, crear, editar, activar/desactivar, borrar; tres estados.
- [ ] TransactionForm: monto bruto + bloque de descuento (fijo XOR porcentual) + neto en vivo; payload correcto; nota de trazabilidad si hay `discount_id`.
- [ ] TransactionDetails muestra bruto/descuento/neto; las listas siguen mostrando `amount` (neto) sin cambios.
- [ ] Sin ruta/sidebar nuevos.
- [ ] `npm run typecheck` pasa sin errores ni warnings.
