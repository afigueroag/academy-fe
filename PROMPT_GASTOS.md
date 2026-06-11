# Prompt — Módulo de Gastos

> Pegar este prompt a Claude Code. Antes de tocar código, leer
> [STYLE_GUIDE.md](STYLE_GUIDE.md), [openapi.json](openapi.json),
> [src/api.ts](src/api.ts) y [src/types.ts](src/types.ts).

---

## 1. Contexto del proyecto

Cantera (SaaS de gestión de academias). Construir el módulo de **Gastos**: el
admin/recepcionista registra los **egresos** de la academia (renta, servicios,
salarios, marketing, equipo, otros), ve su historial filtrable y gestiona gastos
recurrentes.

**Gastos es el espejo exacto del módulo de Ventas** ([src/pages/Sales.tsx](src/pages/Sales.tsx)),
con `kind = 'expense'` en lugar de `'sale'`. El backend ya lo soporta al 100%:
mismos endpoints, schemas agnósticos al tipo. **No parametrizar `UsersModule.tsx`**
(no es un CRUD de personas); el patrón de referencia es `Sales.tsx`.

**Hecho clave ya verificado contra `openapi.json`:**
- `TransactionKind = ['sale', 'expense']` ya existe.
- Las categorías de gasto ya están en el enum y mapeadas en
  [src/utils/salesLabels.ts](src/utils/salesLabels.ts): `categoriesForKind('expense')`
  devuelve `rent, utilities, salary, marketing, equipment, other_expense`.
- Todos los endpoints (`/transactions`, `/transactions/summary`,
  `/recurring-transactions` y sus `{id}`) aceptan `kind` como filtro y/o en el body.
- ➡️ **CERO cambios de backend. CERO cambios en [src/api.ts](src/api.ts) y
  [src/types.ts](src/types.ts)** — ya están sincronizados con el OpenAPI.

El trabajo es 100% frontend: (a) parametrizar 4 componentes compartidos por `kind`,
(b) nueva página `Gastos.tsx`, (c) ruta + link de sidebar + ícono nuevo,
(d) pequeños ajustes de copy.

## 2. Identidad visual

Seguir los tokens y clases de [STYLE_GUIDE.md](STYLE_GUIDE.md) sin desviaciones.
Reutilizar exactamente la misma estructura visual de `Sales.tsx`
(`summary-grid`, `filter-bar-stack`, `module-tabs`, `table-wrapper > table.users-table`,
`SidePanel`, `ConfirmModal`, `TransactionStatusBadge`). **No** se introducen clases CSS
nuevas; si algún ajuste lo requiriera, agregarlo a [src/styles.css](src/styles.css) con
clase semántica (improbable: el módulo es visualmente idéntico a Ventas).

## 3. Enums

Todos ya existen en [src/types.ts](src/types.ts); no se agregan enums. Para Gastos
solo se usan estas categorías (vía `categoriesForKind('expense')`):

| Enum | Valor | Label (ya en `salesLabels.ts`) |
|------|-------|--------------------------------|
| `TransactionCategory` | `rent` | "Renta" |
| | `utilities` | "Servicios" |
| | `salary` | "Salario" |
| | `marketing` | "Marketing" |
| | `equipment` | "Equipo" |
| | `other_expense` | "Otro gasto" |
| `TransactionKind` | `expense` | "Gasto" |

`TransactionStatus`, `TransactionFrequency` y `PaymentMethod` son compartidos con
Ventas y se usan tal cual.

## 4. Sincronización de tipos y API service

**Nada que agregar.** Ya verificado: `src/types.ts` y `src/api.ts` están al día con
`openapi.json`. `listTransactions`, `getTransactionsSummary`, `createTransaction`,
`updateTransaction`, `deleteTransaction`, `listRecurringTransactions`,
`createRecurringTransaction`, `updateRecurringTransaction`,
`deleteRecurringTransaction` ya aceptan `kind`. Si al implementar detectas un faltante
real contra el OpenAPI, corrígelo; de lo contrario, no toques estos archivos.

## 5. Modelo de datos / reglas de negocio

- Un gasto es una `Transaction` con `kind = 'expense'`. Mismos campos, estados y
  flujo de pago que una venta.
- **Monto** en *cents* (entero, > 0); usar `fromCents`/`toCents`/`formatMoney` de
  [src/utils/money.ts](src/utils/money.ts).
- **Categoría** obligatoria, restringida a las de gasto (`categoriesForKind('expense')`).
- **Estados** idénticos a Ventas: `scheduled` / `pending` / `paid` / `cancelled`.
  Registrar pago, editar y cancelar funcionan igual. Borrar = cancelar (vía
  `deleteTransaction`), pasando por `ConfirmModal danger`.
- **Proveedor / Beneficiario**: se conserva el mismo mecanismo dual de Ventas
  (usuario registrado **o** `external_name` de texto libre), pero **relabel**: la
  columna y el campo se llaman **"Proveedor / Beneficiario"** en lugar de "Cliente".
  Caso de uso: un `salary` puede ligarse al instructor (usuario registrado); una
  renta se captura como texto externo.
- **Gastos recurrentes**: espejo de los cobros recurrentes (misma `RecurringTransaction`
  con `kind='expense'`, mismas frecuencias y `billing_day`).
- **Alcance excluido por ahora** (NO implementar): adjuntar comprobantes/facturas,
  reembolsos como flujo de aprobación (un reembolso se registra como gasto manual),
  reportes y exportación (irán en el módulo de Finanzas).

## 6. UI / flujos

### 6.1 Parametrizar los componentes compartidos por `kind` (DRY, no duplicar)

Hoy estos componentes hardcodean `kind: 'sale'`, `categoriesForKind('sale')` y la
etiqueta "Cliente". Agregar un prop **`kind: TransactionKind`** (default `'sale'` para
no romper Ventas) que controle: el `kind` del payload, `categoriesForKind(kind)`, la
categoría default válida, y la etiqueta de persona ("Cliente" si `sale`,
"Proveedor / Beneficiario" si `expense`).

- [src/components/TransactionForm.tsx](src/components/TransactionForm.tsx)
  (ver [:173](src/components/TransactionForm.tsx#L173), [:204](src/components/TransactionForm.tsx#L204), [:215](src/components/TransactionForm.tsx#L215)).
- [src/components/RecurringForm.tsx](src/components/RecurringForm.tsx)
  (ver [:181](src/components/RecurringForm.tsx#L181), [:200](src/components/RecurringForm.tsx#L200), [:211](src/components/RecurringForm.tsx#L211)).
- [src/components/RegisterPaymentForm.tsx](src/components/RegisterPaymentForm.tsx) y
  [src/components/TransactionDetails.tsx](src/components/TransactionDetails.tsx):
  relabel de "Cliente" → "Proveedor / Beneficiario" según `kind`.

`Sales.tsx` debe seguir funcionando idéntico (pasa `kind="sale"` explícito o usa el default).

### 6.2 Nueva página `src/pages/Gastos.tsx`

Clonar la estructura de `Sales.tsx` cambiando `kind: 'sale'` → `'expense'` en las 4
llamadas (`listTransactions`, `getTransactionsSummary`, `listRecurringTransactions`
list + active) y ajustando el copy. Dos pestañas: **Transacciones** y
**Gastos recurrentes**.

**Vista lista (pestaña Transacciones):**
- KPIs (`summary-grid`), relabel:
  - Admin/recepcionista no-recepcionista: **"Egresos totales"** (`summary.total`),
    **"# Gastos"** (`total_count`), **"Pagos realizados"** (`paid`),
    **"Pendientes"** (`pending`).
  - Recepcionista: **"Gastos pendientes"** (`pending_count`), igual que en Ventas.
- Filtros idénticos: búsqueda (placeholder **"Buscar por descripción o proveedor"**),
  select de categoría (`categoriesForKind('expense')`), select de método de pago, tabs
  de estado, rango de fechas + atajos.
- Tabla: columnas Fecha, **Proveedor / Beneficiario**, Categoría, Descripción, Método,
  Monto, Estado, Acciones (registrar pago, ver, editar, cancelar) — misma lógica de
  permisos por estado/rol que Ventas.
- Tres estados: cargando / vacío ("Sin gastos en este rango") / error, mensajes en español.

**Vista lista (pestaña Gastos recurrentes):**
- KPIs: **"Recurrencias activas"**, **"Egreso mensual proyectado"**, **"Cuotas anuales"**.
- Tabla con columna **"Día de pago"** (en vez de "Día de cobro").
- Crear/editar recurrencia (solo admin) vía `SidePanel` + `RecurringForm kind="expense"`.

**Paneles (`SidePanel`):**
- Crear: título **"Nuevo gasto"** → `TransactionForm kind="expense" mode="create"`.
- Ver detalle: `TransactionDetails kind="expense"` (read-only, `detail-list`).
- Editar: **"Editar gasto"** → `TransactionForm kind="expense" mode="edit"`.
- Registrar pago: `RegisterPaymentForm`.
- Crear/editar recurrencia: **"Nuevo gasto recurrente"** / **"Editar gasto recurrente"**.

**Confirmaciones (`ConfirmModal danger`):** cancelar gasto y desactivar gasto
recurrente, con los mismos mensajes adaptados a "gasto".

**Toasts de éxito** (`.alert.alert--success`, auto-dismiss 4s): "Gasto creado",
"Gasto actualizado", "Pago registrado", "Gasto cancelado", "Gasto recurrente creado",
"Gasto recurrente actualizado", "Gasto recurrente desactivado".

Header del `Layout` con `title="Gastos"` y botón de acción **"Nuevo gasto"** /
**"Nuevo gasto recurrente"** según la pestaña (admin para recurrentes).

## 7. Ruta y navegación

- **Ruta** en [src/App.tsx](src/App.tsx): `/gastos` con
  `<RoleRoute allow={['admin', 'receptionist']}>` (espejo de `/ventas`).
- **Sidebar** en [src/components/Layout.tsx](src/components/Layout.tsx): añadir el link
  justo después de "Ventas", con el mismo gate `(me?.role === 'admin' || me?.role === 'receptionist')`:
  `to="/gastos"`, label **"Gastos"**, ícono `WalletIcon`.
- **Ícono nuevo** en [src/brand.tsx](src/brand.tsx): agregar `WalletIcon` (SVG propio,
  estilo consistente con los demás íconos: acepta `size` default 16 y `color` default
  `currentColor`). No instalar librerías de íconos.

## 8. Reglas y restricciones

- Todo el texto/UI en **español**.
- CSS solo en [src/styles.css](src/styles.css); sin inline ni `.css` por componente.
- Sin dependencias nuevas (ni UI ni íconos).
- Dinero en cents vía `utils/money.ts`. Sin hex hardcodeado para primary/secondary/accent.
- Toda lista con estados cargando/vacío/error. Acciones destructivas con `ConfirmModal danger`.
- Sin emojis en UI.
- **No** duplicar `TransactionForm`/`RecurringForm`/`RegisterPaymentForm`/`TransactionDetails`:
  parametrizarlos por `kind` y mantener Ventas funcionando igual.

## 9. Definition of Done

- [ ] `TransactionForm`, `RecurringForm`, `RegisterPaymentForm` y `TransactionDetails`
      aceptan prop `kind` (default `'sale'`) que controla categorías, payload y label de persona.
- [ ] `Sales.tsx` sigue funcionando idéntico (sin regresiones).
- [ ] `src/pages/Gastos.tsx` con dos pestañas (Transacciones / Gastos recurrentes),
      KPIs, filtros, tabla, paneles de crear/editar/ver/pagar y recurrencias.
- [ ] Todas las llamadas a API usan `kind: 'expense'`.
- [ ] Columna y campo de persona dicen "Proveedor / Beneficiario".
- [ ] Ruta `/gastos` en `App.tsx` (admin + recepcionista) y link en el sidebar con `WalletIcon`.
- [ ] `WalletIcon` agregado a `brand.tsx`.
- [ ] Estados loading/empty/error visibles en ambas listas; mensajes en español.
- [ ] Sin cambios en `src/api.ts` ni `src/types.ts` (salvo que se detecte un faltante real vs OpenAPI).
- [ ] `npm run typecheck` pasa sin warnings.
