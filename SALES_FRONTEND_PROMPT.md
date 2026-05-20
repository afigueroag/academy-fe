# Prompt — Módulo Ventas (frontend)

> Pega este documento completo a Claude Code en el repo `academy-fe`.

---

## 1. Contexto del proyecto

Cantera — SaaS de gestión de academias. Construir el módulo **Ventas** y modificar el módulo **Estudiantes** existente para integrar información de cobros. El módulo de Ventas tiene dos pestañas (Transacciones y Cobros recurrentes), y abre la puerta a futuros módulos (Gastos, Finanzas, Home) que reusarán los mismos endpoints y tipos.

El backend ya tiene los endpoints y schemas necesarios (`/transactions`, `/transactions/{id}`, `/transactions/summary`, `/recurring-transactions`, `/recurring-transactions/{id}`, más campos nuevos en `/users` y `/me`). Las reglas de validación cross-field, restricciones por estado y gating por rol están documentadas en [SALES_BACKEND.md](SALES_BACKEND.md) (no requieren cambios en el frontend; solo manejar los 422/403 que devuelven).

**Antes de tocar código**, leer en este orden:
1. [STYLE_GUIDE.md](STYLE_GUIDE.md) — vinculante.
2. [openapi.json](openapi.json) — fuente de verdad de schemas y endpoints.
3. [src/api.ts](src/api.ts) y [src/types.ts](src/types.ts) — agregar lo nuevo siguiendo el patrón existente.
4. [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx), [src/pages/Classes.tsx](src/pages/Classes.tsx) — referencias del patrón.
5. [SALES_BACKEND.md](SALES_BACKEND.md) — para entender los errores que puede devolver el API.

Esto **no** parametriza `UsersModule.tsx` (es un módulo distinto con estructura propia). Sí extiende `UsersModule.tsx` y `UserForm.tsx` para las nuevas columnas/filtros/bloques en Estudiantes.

---

## 2. Identidad visual

Seguir [STYLE_GUIDE.md](STYLE_GUIDE.md) al pie de la letra. Tres cosas que requieren añadir algo nuevo (todo en `styles.css` y `brand.tsx`):

**a) Ícono nuevo para Ventas.** No existe ningún ícono de moneda/recibo en [src/brand.tsx](src/brand.tsx). Agregar `DollarIcon` (símbolo `$` minimalista trazo) siguiendo el patrón de los demás (`size` y `color` por props, `currentColor` por default, `aria-hidden`). Usarlo en el sidebar y como detalle visual donde aplique.

**b) Gráfico "Ingresos por categoría" — barras horizontales (NO treemap).** Añadir clases en [src/styles.css](src/styles.css):
- `.hbar-list` (contenedor `display:flex; flex-direction:column; gap:8px;`).
- `.hbar` con `.hbar__label`, `.hbar__track` (fondo `--color-border`, height ~10px, radius), `.hbar__fill` (gradiente `--color-primary → --color-secondary`, width:%), `.hbar__value`.
- Layout: la tabla de transacciones ocupa el ancho mayor; el `hbar-list` va en una `<aside>` a la derecha (en desktop) o debajo (en mobile, ≤960px). Usar grid o flex; nada de libs.

**c) Tabs internos dentro del módulo.** Reusar `.tab-group` que ya existe en `.filter-bar`, pero promovido a navegación principal del módulo: colocarlo arriba de los KPIs (no dentro del `.filter-bar`). Los dos tabs son `Transacciones` y `Cobros recurrentes`. Estado del tab vive en URL como query param `?tab=transacciones|recurrentes` (default `transacciones`) para que sea linkeable.

---

## 3. Enums

Todos vienen del backend. Definirlos en [src/types.ts](src/types.ts) y crear un único módulo `src/utils/salesLabels.ts` con las funciones `label*(value)` para evitar repetir mapeos.

```ts
type TransactionKind = 'sale' | 'expense';
type TransactionStatus = 'scheduled' | 'pending' | 'paid' | 'cancelled';
type TransactionCategory =
  | 'tuition' | 'enrollment_fee' | 'material_sale' | 'exam_fee' | 'private_class' | 'other_income'
  | 'rent' | 'utilities' | 'salary' | 'marketing' | 'equipment' | 'other_expense';
type TransactionFrequency = 'weekly' | 'monthly' | 'quarterly' | 'semester' | 'annual' | 'one_time';
type EnrollmentFeeMode = 'annual_recurring' | 'one_time_on_signup' | 'none';
type Debt = 'any' | 'none' | 'tuition' | 'enrollment_fee';
type WeekendBillingBehavior = 'ignore' | 'shift_previous' | 'shift_next';
// PaymentMethod ya existe en types.ts
```

| Enum | Valor | Label |
|---|---|---|
| `TransactionKind` | `sale` / `expense` | "Venta" / "Gasto" |
| `TransactionStatus` | `scheduled` / `pending` / `paid` / `cancelled` | "Programada" / "Pendiente" / "Pagada" / "Cancelada" |
| `TransactionCategory` | `tuition` | "Mensualidad" |
| | `enrollment_fee` | "Inscripción" |
| | `material_sale` | "Venta de material" |
| | `exam_fee` | "Examen" |
| | `private_class` | "Clase privada" |
| | `other_income` | "Otro ingreso" |
| | `rent` | "Renta" |
| | `utilities` | "Servicios" |
| | `salary` | "Salario" |
| | `marketing` | "Marketing" |
| | `equipment` | "Equipo" |
| | `other_expense` | "Otro gasto" |
| `TransactionFrequency` | `weekly` / `monthly` / `quarterly` / `semester` / `annual` / `one_time` | "Semanal" / "Mensual" / "Trimestral" / "Semestral" / "Anual" / "Única" |
| `PaymentMethod` | `credit_card` / `debit_card` / `paypal` / `bank_transfer` / `cash` / `other` | "Tarjeta de crédito" / "Tarjeta de débito" / "PayPal" / "Transferencia" / "Efectivo" / "Otro" |
| `EnrollmentFeeMode` | `annual_recurring` / `one_time_on_signup` / `none` | "Anual recurrente" / "Única al inscribir" / "Sin inscripción" |
| `Debt` | `any` / `none` / `tuition` / `enrollment_fee` | (uso interno en filtros: "Con deuda" / "Al corriente" / "Mensualidad pendiente" / "Inscripción pendiente") |

Categorías son **mutuamente excluyentes con el `kind`** (ver `D.1` en [SALES_BACKEND.md](SALES_BACKEND.md)). En el formulario de "Nueva transacción", al seleccionar `kind`, el dropdown de `category` se filtra a las válidas. En este módulo siempre creamos `kind='sale'`.

---

## 4. Sincronización de tipos y API service

### 4.1 `src/types.ts` — agregar

- Enums listados arriba.
- Extender `AcademyMe` con los campos de billing nuevos: `country`, `default_billing_day`, `billing_lookahead_months`, `auto_billing_enabled`, `enrollment_fee_amount`, `enrollment_fee_month`, `enrollment_fee_mode`, `weekend_billing_behavior` (todos opcionales/nullable según OpenAPI).
- Extender `UserRead` con: `pending_transactions: TransactionUserRead[]`, `debt_amount: number | null`, `next_due_date: string | null`, `next_due_amount: number | null`.
- Nuevos tipos: `TransactionUserRead`, `TransactionCreate`, `TransactionRead`, `TransactionUpdate`, `TransactionSummary`, `RecurringTransactionCreate`, `RecurringTransactionRead`, `RecurringTransactionUpdate`.
- Tipos auxiliares: `ListTransactionsParams`, `ListRecurringTransactionsParams`, `TransactionSummaryParams`.

Hacer match exacto con OpenAPI (nullable → `| null`, anyOf → unión, etc.).

### 4.2 `src/api.ts` — agregar funciones

Siguiendo el patrón existente (mismo `request<T>()`, `ApiError`):

- `getTransactionsSummary(params): Promise<TransactionSummary>` → `GET /transactions/summary`
- `listTransactions(params): Promise<TransactionRead[]>` → `GET /transactions`
- `getTransaction(id): Promise<TransactionRead>` → `GET /transactions/{id}`
- `createTransaction(payload): Promise<TransactionRead>` → `POST /transactions`
- `updateTransaction(id, payload): Promise<TransactionRead>` → `PATCH /transactions/{id}`
- `deleteTransaction(id): Promise<TransactionRead>` → `DELETE /transactions/{id}` (soft delete, regresa el record actualizado con status='cancelled')
- `listRecurringTransactions(params)` → `GET /recurring-transactions`
- `getRecurringTransaction(id)` / `createRecurringTransaction` / `updateRecurringTransaction` / `deleteRecurringTransaction` → idem
- Extender `listUsers` para aceptar `debt_filter?: Debt`.

`ListTransactionsParams` debe aceptar: `kind`, `status`, `category`, `payment_method`, `user_id`, `from_date`, `to_date`, `search`, `skip`, `limit`. El módulo de Ventas siempre llama con `kind='sale'`.

---

## 5. Modelo de datos / reglas de negocio

Reglas que NO se ven en OpenAPI:

### 5.1 Permisos por rol

Leer el rol desde `useAuth().user.role` (si no está expuesto hoy, agregarlo a `useAuth()` consumiendo `getMe()`).

| Rol | Comportamiento |
|---|---|
| `admin` | Acceso completo a todo. |
| `receptionist` | Ve el módulo Ventas pero **oculta** los KPIs "Ingresos totales", "Pagos recibidos" y el gráfico de barras. Solo ve KPI "Pendientes" (con `pending_count` y `pending`). En la tabla solo ve transacciones `pending`/`scheduled` (el BE filtra). Puede crear ventas y registrar pagos, no puede editar otros campos ni cancelar. En la pestaña "Cobros recurrentes" solo ve (sin botones de crear/editar/desactivar). |
| `instructor`, `student` | No deberían ver el módulo en sidebar (ocultar `<NavLink>` si rol no es admin/receptionist). |

### 5.2 Restricciones de edición/cancelación por estado

Reflejar en la UI lo que el BE valida (ver E.1, E.2 en [SALES_BACKEND.md](SALES_BACKEND.md)):

- Botón "Editar" en una fila: deshabilitar si `status='cancelled'`. Si `status='paid'`, el form de edición solo muestra `description`, `payment_reference`, `payment_notes` (resto en `readonly`).
- Botón "Cancelar" (trash): deshabilitar si `status ∈ {paid, cancelled}`.
- Para `scheduled`/`pending`: todo editable excepto `kind` (no se muestra en el form) y `recurring_id` (oculto).
- Si llega 422 del BE con `field` específico, mostrar inline (`ApiError.fieldErrors`).
- Si llega 409, mostrar como alerta global del panel.

### 5.3 Cálculos derivados

- "Ingresos totales" KPI = `summary.total` (cents → formatMoney).
- "Pagos recibidos" KPI = `summary.paid`.
- "Pendientes" KPI = `summary.pending` (monto). Para receptionist mostrar solo `summary.pending_count` con label "Transacciones pendientes" en vez de monto.
- "# Transacciones" KPI = `summary.total_count`.
- Gráfico ingresos por categoría: para construirlo, llamar `listTransactions({ kind:'sale', from_date, to_date, limit: 1000 })` y agrupar por `category` sumando `amount` solo donde `status='paid'`. Ordenar desc. Top N (6 categorías), el resto en "Otros".
- Default de rango temporal: mes en curso (primer día del mes → hoy). Filtros lo modifican.

### 5.4 Flujo de "Registrar pago"

Mini-panel (usar `SidePanel`, no modal) con:
- `paid_date` (date input, default hoy).
- `payment_method` (select, default = el del estudiante si tiene, si no, ninguno).
- Si `payment_method ∈ {bank_transfer, credit_card, debit_card, paypal}` → mostrar `payment_reference` (input texto, label "Número de comprobante"). Si `cash` u `other`, ocultar.
- `payment_notes` (textarea opcional, label "Nota").
- Botón "Registrar pago" hace `updateTransaction(id, { status:'paid', paid_date, payment_method, payment_reference, payment_notes })`.

Tras éxito: cerrar panel, refrescar la lista y los KPIs, mostrar toast "Pago registrado".

### 5.5 Flujo de "Cancelar transacción"

`ConfirmModal` con `danger`. Mensaje: "¿Cancelar esta transacción? Pasará a estado Cancelada." Al confirmar: `deleteTransaction(id)`. Si BE devuelve 409 (estado no permitido), mostrar el mensaje del BE como toast de error.

### 5.6 Cobros recurrentes — desactivar

`DELETE /recurring-transactions/{id}` es soft delete y el BE hace cascada (cancela todas las `scheduled` futuras vinculadas). UI:
- Botón "Desactivar" abre `ConfirmModal` con mensaje: "Al desactivar, también se cancelarán todos los cobros futuros aún no vencidos. Las deudas vencidas y los pagos ya realizados no se tocan."
- Tras éxito: refrescar la lista de recurrencias y, si está abierta, la de transacciones también.

### 5.7 Auto-creación de cobros al crear estudiante

En `UserForm` cuando `mode='create'` y `role='student'`, agregar al final un bloque **"Configuración de cobros"** (colapsable por default abierto si la academia tiene `default_billing_day` configurado):

**Mensualidad** (siempre visible):
- Switch "Crear cobro mensual" (default on si academia tiene `default_billing_day`).
- Si activo: inputs `amount` (requerido, money), `billing_day` (default = `academy.default_billing_day` o 1, rango 1-28), `start_date` (default = hoy).

**Inscripción** (visible solo si `academy.enrollment_fee_mode !== 'none' && academy.enrollment_fee_amount`):
- Switch "Cobrar inscripción" (default on).
- Si `mode='annual_recurring'`: muestra "Cuota anual de $X cada mes Y" (informativo, no editable; usa los defaults de academia).
- Si `mode='one_time_on_signup'`: muestra "Cobro único de $X" (informativo).

**Orquestación tras `createUser`** (en `Students.tsx` o quien envuelva el flujo):
1. `createUser(payload)` → obtener `id`.
2. Si "Mensualidad" activa: `createRecurringTransaction({ kind:'sale', category:'tuition', frequency:'monthly', user_id:id, amount, billing_day, start_date, description:'Mensualidad' })`.
3. Si "Inscripción" activa y modo `annual_recurring`: `createRecurringTransaction({ kind:'sale', category:'enrollment_fee', frequency:'annual', user_id:id, amount: academy.enrollment_fee_amount, billing_day: 1, start_date: <primer día del mes academy.enrollment_fee_month>, description:'Cuota anual' })`.
4. Si "Inscripción" activa y modo `one_time_on_signup`: `createTransaction({ kind:'sale', category:'enrollment_fee', status:'pending', user_id:id, amount: academy.enrollment_fee_amount, transaction_date: hoy, description:'Inscripción' })`.

Si cualquiera de los pasos 2-4 falla pero el `createUser` ya pasó: mostrar toast de éxito por el alta + alerta no-bloqueante "El estudiante se creó, pero no se pudieron configurar los cobros. Configura desde el detalle." No revertir el alta.

### 5.8 Gestión de cobros recurrentes desde el detalle del estudiante

En `UserDetails`, cuando `user.role` es student (puede inferirse del contexto o pedirlo como prop), agregar dos bloques:

**Bloque "Cobros recurrentes"**:
- Listar `listRecurringTransactions({ user_id: id, active: true })`.
- Por cada recurrencia: mostrar categoría, frecuencia, monto, `billing_day`, fecha inicio/fin.
- Por recurrencia: botón "Editar" (abre side-panel con form) y "Desactivar" (ConfirmModal con mensaje de cascada).
- Switch "Crear mensualidad" si no existe ninguna `tuition` activa.
- Switch "Crear cuota anual" si no existe ninguna `enrollment_fee` activa y `academy.enrollment_fee_mode='annual_recurring'`.

**Bloque "Historial y deudas"**:
- Listar `pending_transactions` del `user` (ya viene en `UserRead`). Mostrar columnas: fecha, descripción, categoría, monto, status. Por fila pendiente/programada → botón "Pagar" (abre mini-panel de 5.4).
- (Opcional) Botón "Ver todo el historial" que abre el módulo de Ventas filtrado por `user_id`.

---

## 6. UI / flujos

### 6.1 Página principal `/ventas` — pestaña "Transacciones"

Top de la página (debajo del título): `.tab-group` con dos pestañas (cambia query param `?tab=`).

KPIs (admin):
```
| Ingresos totales | # Transacciones | Pagos recibidos | Pendientes      |
| $12,450.00       | 87              | $9,200.00       | $3,250.00       |
```

KPIs (receptionist): un solo card "Transacciones pendientes" con `summary.pending_count`.

Filtros:
- Búsqueda (search-input) por descripción / external_name.
- Tabs de status (`Todas` / `Pendientes` / `Pagadas` / `Programadas` / `Canceladas`).
- Selects de categoría, método de pago.
- Rango de fechas (dos date inputs `from_date`, `to_date`). Default: mes en curso.

Layout principal (grid 2 cols ≥1100px, 1 col abajo):
- Izquierda: tabla `users-table` (reusar clase) con columnas: Fecha, Cliente (user o `external_name` con badge "Externo"), Categoría, Descripción, Método, Monto, Estado (`StatusBadge` — puede que `Badges.tsx` no tenga los estados de transacción aún; agregarlos), Acciones.
- Derecha: `<aside>` con `.hbar-list` de "Ingresos por categoría" (oculto para receptionist).

Acciones por fila:
- Botón con `CheckIcon` "Registrar pago" (solo si `status ∈ {pending, scheduled}`).
- `EyeIcon` "Ver detalle".
- `PencilIcon` "Editar" (deshabilitado según reglas).
- `TrashIcon` "Cancelar" (deshabilitado según reglas).

Botón "Nueva transacción" en `Layout actions`.

Estados de la tabla: loading (`loading-row`), vacío (`empty-state` con mensaje "Sin transacciones en este rango"), error (`alert` arriba de la tabla).

### 6.2 Pestaña "Cobros recurrentes"

KPIs (admin): "Recurrencias activas" (count), "Monto mensual proyectado" (suma de las mensuales), "Cuotas anuales" (count). Oculto para receptionist.

Filtros: search, select de categoría, select de frecuencia, tabs "Activos" / "Inactivos" / "Todos".

Tabla `users-table` con columnas: Cliente, Categoría, Frecuencia, Día de cobro, Monto, Inicio, Fin, Acciones (Editar, Desactivar).

Botón "Nueva recurrencia" en `Layout actions` (solo admin).

### 6.3 Side-panels y modales

- **Nueva transacción** (admin y receptionist): form con toggle "Cliente registrado" / "Cliente externo". Si registrado, autocomplete sobre `listUsers({ role: 'student'|'instructor'|... })` (reusar `UserAutocomplete.tsx`). Si externo, input texto `external_name`. Resto de campos: `category` (filtrado por kind='sale'), `description`, `amount` (money input — ver `src/utils/money.ts`), `transaction_date`, `status` (default `pending`; si elige `paid`, requiere `paid_date` y `payment_method`).
- **Ver detalle**: read-only con `detail-list`. Incluir todos los campos.
- **Editar**: igual al form de crear pero con reglas de 5.2.
- **Nueva/Editar recurrencia**: form con cliente registrado o externo, `category`, `description`, `frequency`, `amount`, `billing_day` (requerido para freq != one_time según [SALES_BACKEND.md](SALES_BACKEND.md)), `start_date`, `end_date`.
- **Registrar pago**: ver 5.4.
- **Cancelar transacción/recurrencia**: `ConfirmModal danger`.

### 6.4 Modificaciones a Estudiantes (`UsersModule.tsx` / `Students.tsx`)

Como `UsersModule.tsx` está parametrizado y otros roles (instructor) no necesitan estas columnas, agregar dos props nuevas:

```ts
interface UsersModuleProps {
  ...existing,
  showDebtColumns?: boolean;   // true para Students
  debtFilter?: Debt | null;
  onDebtFilterChange?: (d: Debt | null) => void;
}
```

Y en `Students.tsx` pasar `showDebtColumns={true}` más el estado del filtro. Si `showDebtColumns`:

- Agregar columnas "Deuda" (formatMoney de `debt_amount` con `var(--color-danger)` si > 0) y "Próximo pago" (fecha + monto, dos líneas).
- Agregar a la fila botón con `CheckIcon` "Pagar" si `debt_amount > 0` (paga la transacción pendiente más antigua) o si hay `next_due_date` (con copy "Pagar próximo").
- Agregar al `.filter-bar` un select adicional "Cobros" con opciones: Todos / Al corriente / Con deuda / Mensualidad pendiente / Inscripción pendiente. Esto manda `debt_filter` al endpoint.

El bloque "Configuración de cobros" del 5.7 va dentro de `UserForm` (no de `UsersModule`).

El bloque "Cobros recurrentes" y "Historial y deudas" del 5.8 va dentro de `UserDetails`.

---

## 7. Ruta y navegación

- [src/App.tsx](src/App.tsx): agregar `<Route path="/ventas" element={<Sales />} />`.
- [src/components/Layout.tsx](src/components/Layout.tsx): dentro de `<nav className="sidebar__nav">`, agregar un `<NavLink to="/ventas">` con `<DollarIcon size={18} />` y label "Ventas", **inmediatamente después** del de Instructores y antes del de Clases. Ocultar el link si el rol no es admin ni receptionist.

---

## 8. Reglas y restricciones

- Todo en español.
- CSS solo en [src/styles.css](src/styles.css). Nada de inline ni librerías de UI.
- No instalar librerías de chart. El gráfico es barras horizontales hechas en HTML+CSS.
- Sin emojis en UI.
- Sin hex hardcodeados para primary/secondary/accent — usar tokens CSS.
- Toda lista con tres estados (loading, vacío, error). Mensajes en español.
- Toda acción destructiva pasa por `<ConfirmModal danger>`.
- Dinero en cents en API; usar `fromCents`, `toCents`, `formatMoney` de [src/utils/money.ts](src/utils/money.ts) (crear si no existe).
- Manejo de errores 422 con `ApiError.fieldErrors` para mostrar inline. 409 como alerta global del panel. 403 mostrar mensaje permiso.
- Hooks de filtros con debounce de 250ms para `search`.
- Cuando un filtro cambia, también se refrescan los KPIs (mismo rango de fechas).

---

## 9. Definition of Done

- [ ] [src/types.ts](src/types.ts) tiene todos los enums y schemas nuevos, sincronizados con [openapi.json](openapi.json).
- [ ] [src/api.ts](src/api.ts) tiene `getTransactionsSummary`, `listTransactions`, `getTransaction`, `createTransaction`, `updateTransaction`, `deleteTransaction` y los 5 equivalentes para `recurring-transactions`. `listUsers` acepta `debt_filter`.
- [ ] [src/brand.tsx](src/brand.tsx) tiene `DollarIcon`.
- [ ] [src/styles.css](src/styles.css) tiene `.hbar-list`, `.hbar`, `.hbar__label`, `.hbar__track`, `.hbar__fill`, `.hbar__value`. Layout de aside derecho responsive (≥1100px lado a lado, abajo en mobile).
- [ ] [src/utils/money.ts](src/utils/money.ts) con `fromCents`, `toCents`, `formatMoney` (usa `academy.currency`).
- [ ] [src/utils/salesLabels.ts](src/utils/salesLabels.ts) con los `label*` para cada enum.
- [ ] Página `src/pages/Sales.tsx` con dos pestañas (`?tab=` en URL), KPIs, filtros, tabla, gráfico de barras, side-panels de crear/ver/editar/registrar pago, ConfirmModal de cancelar.
- [ ] Pestaña "Cobros recurrentes" con su propia tabla y side-panels.
- [ ] Ruta en [src/App.tsx](src/App.tsx) y `NavLink` con gating de rol en [src/components/Layout.tsx](src/components/Layout.tsx).
- [ ] [src/pages/UsersModule.tsx](src/pages/UsersModule.tsx) con `showDebtColumns` y filtro de deuda.
- [ ] [src/pages/Students.tsx](src/pages/Students.tsx) pasa `showDebtColumns`.
- [ ] [src/components/UserForm.tsx](src/components/UserForm.tsx) con bloque "Configuración de cobros" en `mode='create' && role='student'`.
- [ ] [src/components/UserDetails.tsx](src/components/UserDetails.tsx) con bloques "Cobros recurrentes" y "Historial y deudas" para students.
- [ ] [src/components/Badges.tsx](src/components/Badges.tsx) soporta los 4 status de transacción (`scheduled`, `pending`, `paid`, `cancelled`) — agregar si no.
- [ ] `useAuth()` expone `role` (vía `getMe()` cacheado o como ya esté).
- [ ] Receptionist: KPIs monetarios ocultos, gráfico oculto, link visible en sidebar, no ve botones de cancelar/editar de recurrencias.
- [ ] Toda lista tiene estados loading/empty/error visibles.
- [ ] Errores 422 del BE se reflejan inline (`ApiError.fieldErrors`); 409 como alerta; 403 con mensaje de permisos.
- [ ] `npm run typecheck` pasa sin warnings.
- [ ] Probar manualmente en navegador los flujos: crear venta, registrar pago, cancelar transacción, crear recurrencia, desactivar recurrencia (cascada visible), crear estudiante con auto-cobros, pagar desde lista de estudiantes, login como receptionist y validar que los campos sensibles están ocultos.

---

## Apéndice — Errores conocidos del backend que el frontend debe manejar

| Endpoint | Caso | Código | Mensaje del BE | Acción FE |
|---|---|---|---|---|
| `PATCH /transactions/{id}` | Edita un campo bloqueado por status | 422 | `loc:["body","<field>"]` | Mostrar inline en ese campo |
| `PATCH /transactions/{id}` | Edita una cancelada | 409 | "La transacción ya está cancelada." | Alerta global del panel |
| `DELETE /transactions/{id}` | Intenta cancelar una paid | 409 | "No se puede cancelar una transacción pagada…" | Toast de error |
| Cualquiera | Receptionist intenta acción no permitida | 403 | (mensaje BE) | Toast: "No tienes permiso para esta acción." |
| `POST/PATCH` Transaction | `status=paid` sin `paid_date` o `payment_method` | 422 por campo | (Pydantic) | Inline |
| `POST/PATCH` Transaction | `user_id` y `external_name` ambos o ninguno | 422 | (Pydantic) | Inline en el toggle |
| `POST/PATCH` Recurring | `frequency != one_time` sin `billing_day` | 422 | (Pydantic) | Inline en `billing_day` |
