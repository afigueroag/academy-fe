# Solicitud al backend — Tabla de estudiantes y configuración de academia

> El frontend ya está implementado asumiendo estos cambios. Mientras no existan,
> los campos llegan `undefined`/`null` y la UI degrada a "—" (no se rompe).
> Idioma de datos sin cambios; montos en **cents** (int).

## Contexto

Se rediseñó la tabla de `/students` y se agregó una pantalla de **Configuración
de la academia** (admin, `PATCH /academies/{id}`). Varias columnas y campos
necesitan datos que el backend aún no expone.

Columnas nuevas de la tabla de estudiantes: Número de estudiante · Grupo
asignado · Costo de mensualidad · Costo de matrícula anual · Días de pago /
Próximo pago.

---

## Cambios requeridos

### BE-1 · `role_consecutive` en `UserRead` — ✅ HECHO

`UserRead` ya expone `role_consecutive: int` (lista y detalle). El FE lo muestra
en la columna "N.º".

### BE-2 · Montos activos del alumno en `UserRead` — ✅ HECHO

`UserRead` ya expone `tuition_amount: int | None` y
`enrollment_fee_amount: int | None` (cents). El FE muestra las columnas
"Mensualidad" y "Matrícula anual"; "—" cuando son `null`.

> Mostramos el **monto de la recurrencia activa** (lo que se le cobra cada
> periodo), no el próximo pendiente.

### BE-3 · Grupos del alumno en `UserRead` (lista) — ⏳ PENDIENTE en openapi.json

El alumno puede pertenecer a **varios** grupos → es una **lista**. Exponer en
`UserRead`:

```jsonc
"groups": [ { "id": 1, "name": "Karate", "order": 3 }, ... ]   // [] cuando no tiene
```

- `name` — único dato que el FE muestra hoy (los une con coma; "—" si vacío).
- `order: int | None` — para grupos **ordinales** (p. ej. cintas de karate)
  donde el orden importa en algunas funciones; los **cualitativos** (judo,
  taekwondo) lo dejan en `null`. Se usará más adelante; por ahora el FE solo lo
  tipa, no lo renderiza.

**Nota:** en el `openapi.json` actual `UserRead` aún no incluye `groups`; el FE
asume field `groups` con shape `{ id:int, name:str, order?:int }[]`. Si el
nombre/forma difieren, avisar para alinear.

### BE-4 · Días de pago (gracia) por academia — ✅ HECHO (FE) / confirmar cálculo de deuda

`payment_grace_days: int | None` (default **7**) ya está en `AcademyMe`,
`AcademyRead` y `AcademyUpdate`. El FE lo usa para mostrar la ventana ("Días
1–7") derivada del día de `next_due_date`.

**Confirmar** que el cálculo de `debt_amount` / `next_due_*` respeta la gracia:
una mensualidad **no** cuenta como deuda hasta que termina la ventana (día N a
N + payment_grace_days − 1).

### BE-5 · Nombre editable de la academia — ✅ HECHO

`name` ya está en `AcademyUpdate`/`AcademyRead`. El admin lo edita desde
`/ajustes` (`PATCH /academies/{id}`).

### BE-6 · Autorización de `PATCH /academies/{id}`

Confirmar que `PATCH /academies/{id}` solo lo puede usar `role=admin` de esa
academia. El FE ya restringe la ruta `/ajustes` a admin.

---

## Notas

- El filtro `debt_filter` (`any` · `none` · `tuition` · `enrollment_fee`) ya
  existe y se reusa tal cual; en el FE se reetiquetó a "Con deuda / Al corriente
  / Deuda mensualidad / Deuda matrícula anual".
- Terminología: "inscripción" → "**matrícula anual**" es solo de presentación en
  el FE (la categoría sigue siendo `enrollment_fee`). No requiere cambios de BE.
- Todos los montos nuevos en **cents**; el FE usa `fromCents`/`formatMoney`.

## Checklist BE

- [x] BE-1 `role_consecutive` en `UserRead` (lista + detalle).
- [x] BE-2 `tuition_amount` y `enrollment_fee_amount` (cents, nullable) en `UserRead`.
- [ ] BE-3 `groups: {id,name,order?}[]` en `UserRead` (lista). **Falta exponer en openapi.json.**
- [x] BE-4 `payment_grace_days` (default 7) en academia — confirmar que entra al cálculo de deuda.
- [x] BE-5 `name` editable en `AcademyUpdate` (+ `AcademyRead`).
- [ ] BE-6 `PATCH /academies/{id}` restringido a admin (confirmar).
