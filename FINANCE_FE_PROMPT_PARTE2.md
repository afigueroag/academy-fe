# Módulo Finanzas (Dashboard) — Parte 2: P&L, Nómina y Reportes

## 0. Prerrequisito
Esta entrega **continúa** el módulo Finanzas ya construido en la Parte 1 (ver `FINANCE_FE_PROMPT_PARTE1.md`). Reutiliza sin reescribir: `src/pages/Dashboard.tsx` (Layout + selector de periodo `{month, year}` + `.tab-group` + CTAs), los componentes de `src/components/charts/` (`KpiCard`, `BarChart`, `HBarList`, `DonutChart`), `src/components/NewTransactionPanel.tsx`, el helper `formatPct` y `src/utils/transactionLabels.ts`. Aquí se **habilitan** las 3 pestañas que estaban en "Próximamente": **P&L**, **Nómina** y **Reportes**.

**Antes de tocar código, lee**: [STYLE_GUIDE.md](STYLE_GUIDE.md), [openapi.json](openapi.json), [src/api.ts](src/api.ts), [src/types.ts](src/types.ts), [src/utils/money.ts](src/utils/money.ts), y el código de la Parte 1.

## 1. Contexto
Cantera (SaaS de academias). Completar el módulo **Finanzas** con las 3 pantallas-dashboard restantes (solo-admin, lectura + una acción de registro en Nómina). El frontend solo pinta lo que sirven los endpoints de agregación; no recalcula. Endpoints de esta parte: `GET /dashboards/pnl` y `GET /dashboards/payroll`. **Reportes no tiene endpoint** (stand-by): se construye como placeholder estático.

## 2. Identidad visual
Mismos tokens y reglas de STYLE_GUIDE.md y de la Parte 1. Se agrega **un tipo de gráfico nuevo**: **línea** (evolución de utilidad neta por mes). Constrúyelo a mano en SVG (`LineChart.tsx`), CSS en [src/styles.css](src/styles.css) (`.chart-line*`). Sin librerías de gráficos. Sin hex para primary/secondary/accent (usar tokens / `color-mix`).

## 3. Enums y labels (español)

### 3.1 Categoría nueva `class_fee`
El enum `TransactionCategory` del backend ahora incluye **`class_fee`** (además de las de la Parte 1). Agrégalo:
- En `src/types.ts` al union `TransactionCategory` (valor `class_fee`).
- En `src/utils/transactionLabels.ts`: `class_fee`→"Cuota de clase". (Aplica también retroactivamente a las pantallas de la Parte 1.)

### 3.2 Roles de nómina (`PayrollRole`)
El enum del backend es **solo** `instructor | other` (no existe `assistant`). Crea el mapa:
`instructor`→"Instructor", `other`→"Otros".
(Ponlo en `transactionLabels.ts` como `payrollRoleLabels` o similar.)

## 4. Sincronización de tipos y API service

### 4.1 `src/types.ts` — agregar
```ts
export interface MonthPoint { month: string; amount: number } // month: "YYYY-MM"

// ---- P&L ----
export interface FinancePnlKpis { income: KpiValue; expense: KpiValue; payroll: KpiValue; net_profit: KpiValue }
export interface FinancePnlRead {
  kpis: FinancePnlKpis;
  income_by_category: CategoryBreakdown[];
  expense_by_category: CategoryBreakdown[];
  pnl: PnL;                       // reutiliza el tipo PnL de la Parte 1
  net_profit_trend: MonthPoint[]; // 12 meses hasta el mes seleccionado
}

// ---- Nómina ----
export type PayrollRole = 'instructor' | 'other';
export interface NextScheduledPayment { date: string; days_until: number; amount: number }
export interface PayrollComputedRow {
  user: UserPublic; role: PayrollRole;
  period_start: string; period_end: string;
  hours: number; computed_amount: number; already_created: boolean;
}
export interface PayrollTransactionRow {
  id: number; user: UserPublic; role: PayrollRole;
  period_start: string | null; period_end: string | null;
  amount: number; status: TransactionStatus; paid_date: string | null;
}
export interface PayrollDistribution { instructor: number; other: number }
export interface UpcomingPayrollRow { user: UserPublic; role: PayrollRole; date: string; amount: number }
export interface FinancePayrollKpis {
  total_payroll: KpiValue; employees_paid: KpiValue; avg_per_employee: KpiValue;
  next_scheduled: NextScheduledPayment | null;
}
export interface FinancePayrollRead {
  kpis: FinancePayrollKpis;
  computed: PayrollComputedRow[];
  transactions: PayrollTransactionRow[];
  distribution: PayrollDistribution;
  by_month: MonthPoint[];
  upcoming: UpcomingPayrollRow[];
}
```
> `KpiValue`, `CategoryBreakdown`, `PnL`, `TransactionStatus`, `UserPublic` ya existen (Parte 1 / repo). No los redefinas.

### 4.2 `src/api.ts` — agregar (lanzan `ApiError`)
```ts
export async function getFinancePnl(month: number, year: number): Promise<FinancePnlRead>
export async function getFinancePayroll(month: number, year: number): Promise<FinancePayrollRead>
```
Rutas: `GET /dashboards/pnl`, `GET /dashboards/payroll`. Query: `month` (1-12), `year` (>=2025).

La acción "Generar transacción" de Nómina usa el **`createTransaction` existente** (`POST /transactions`). Sin endpoints nuevos.

## 5. Reglas de negocio / formato
- Montos en **cents** → `formatMoney`/`fromCents`. Conteos (`employees_paid.value`, `transaction_count`) como enteros sin moneda.
- Variación de KPIs con `delta_pct` (chip ↑/↓ verde/rojo, "vs. mes anterior"; `null`→"—"). Reutiliza `KpiCard` y `formatPct` de la Parte 1.
- **Escala de `margin` y `delta_pct`**: sigue el mismo `formatPct` centralizado con el `// TODO: confirmar escala` de la Parte 1 (asumir `delta_pct` como porcentaje, `margin` como fracción ×100).
- Periodo compartido (mismo `{month, year}` del contenedor); al cambiar de pestaña se conserva.
- **Optimización de espacio en tablas** (solicitud del usuario): la columna de persona muestra **nombre grande + rol pequeño debajo** en una sola celda (usa el patrón `.user-cell` con nombre y subtítulo de rol). Aplícalo en las tablas de Nómina.

## 6. UI / estructura

### Cambio en el contenedor (`src/pages/Dashboard.tsx`)
- Habilitar las pestañas **P&L**, **Nómina**, **Reportes** (quitar `disabled`/"Próximamente"). Renderizar la sección activa con el `{month, year}` compartido.

### Sección P&L (`src/pages/dashboard/Pnl.tsx`) — `getFinancePnl`
- **KPIs** (`.summary-grid` / `KpiCard`): Ingresos del mes (`kpis.income`), Gastos del mes (`kpis.expense`), Nómina del mes (`kpis.payroll`), Utilidad neta del mes (`kpis.net_profit`) — cada uno con `delta_pct`.
- **Bloque de 3 columnas**: (izq) tabla **Ingresos por categoría** (`income_by_category`: categoría→label, monto) con fila de **Total**; (centro) tabla **Gastos por categoría** (`expense_by_category`) con **Total**; (der) tarjeta resaltada con **Utilidad Neta** (`pnl.net_profit`) y **Margen** (`pnl.margin`). En responsive se apilan.
- **Gráfico de línea** "Evolución de la utilidad neta por mes" (`net_profit_trend: MonthPoint[]`) → nuevo `LineChart` (SVG).
- **Resumen del mes (P&L)** (`pnl`): lista vertical (`.detail-list`) en este **orden exacto**, con subtotales resaltados:
  1. Ingresos por servicios (`service_income`)
  2. (−) Costo de ventas (`cogs`)
  3. **= Utilidad bruta** (`gross_profit`)
  4. (−) Gastos operativos (`operating_expenses`)
  5. **= Utilidad operativa** (`operating_profit`)
  6. (+) Otros ingresos (`other_income`)
  7. (−) Otros gastos (`other_expense`)
  8. **= Utilidad neta** (`net_profit`) — destacada
  9. Margen (`margin`)

### Sección Nómina (`src/pages/dashboard/Payroll.tsx`) — `getFinancePayroll`
- **KPIs**: Nómina total del mes (`total_payroll`), Empleados pagados (`employees_paid`, conteo), Pago promedio por empleado (`avg_per_employee`), y **Próximo pago programado** (`next_scheduled`): tarjeta especial con monto + fecha + "en {days_until} días"; si `next_scheduled == null` → "Sin pagos programados".
- **Tabla 1 — Calculado por asistencia** (`computed`): columnas Usuario (nombre + rol pequeño), Periodo (`period_start`–`period_end`), Horas (`hours`), Monto calculado (`computed_amount`), y CTA **"Generar transacción"** por fila. Si `already_created === true`, deshabilitar el botón y mostrar "Ya generada". El CTA abre `NewTransactionPanel` **prellenado**: `kind='expense'`, `category='salary'`, `user_id=user.id`, `amount=computed_amount`, `period_start/period_end`, `description` sugerida (p. ej. "Nómina {periodo} — {nombre}"), `status` default `pending`. Al éxito: cerrar, toast de éxito y **refrescar** la sección.
- **Tabla 2 — Transacciones de nómina** (`transactions`): Usuario (nombre + rol), Periodo, Monto, Estatus (`<StatusBadge>`), Fecha de pago (`paid_date`).
- **Distribución de nómina** (`distribution`: `{ instructor, other }`) → `DonutChart` o barras: **Instructor / Otros** (labels desde `payrollRoleLabels`).
- **Barras por mes** de nómina (`by_month: MonthPoint[]`) → `BarChart`.
- **Próximos pagos programados** (`upcoming`): lista con Usuario (nombre + rol), Fecha, Monto.

### Sección Reportes (`src/pages/dashboard/Reports.tsx`) — placeholder estático (sin API)
- Grid de tarjetas de reporte: **Resumen Financiero**, **Ingresos por Categoría**, **Gastos por Categoría**, **P&L**, **Flujo de Efectivo**. Cada tarjeta: título, descripción breve y botón **"Generar PDF"** **deshabilitado** con badge "Preview".
- Nota superior: "Generación de reportes en preparación." Sin llamadas al API.

### Componente nuevo (`src/components/charts/LineChart.tsx`)
- Gráfico de línea en SVG: recibe `MonthPoint[]` (o `{label, value}[]`), dibuja eje base, línea y puntos, con tooltips/labels de mes. CSS en `styles.css` (`.chart-line*`). Maneja el caso de todos-cero y de un solo punto.

## 7. Ruta y navegación
- No hay rutas nuevas: las 3 secciones viven dentro de `/dashboard` como pestañas del contenedor existente. Solo habilitarlas.

## 8. Reglas y restricciones
- Todo en español. Sin emojis.
- CSS solo en [src/styles.css](src/styles.css); sin `.css` por componente; sin inline salvo dimensiones calculadas de gráficos.
- Sin librerías nuevas (UI, íconos, charts).
- Tokens CSS para colores de marca.
- Cada lista/gráfico con sus 3 estados (cargando/vacío/error) en español. En Reportes no hay fetch, pero cuida el estado deshabilitado.
- Solo-admin: `!token` → redirect a login (heredado del contenedor).

## 9. Definition of Done
- [ ] `src/types.ts`: `MonthPoint`, `FinancePnl*`, `FinancePayroll*`, `PayrollRole` y afines; `class_fee` agregado a `TransactionCategory`.
- [ ] `src/api.ts`: `getFinancePnl`, `getFinancePayroll`.
- [ ] `src/utils/transactionLabels.ts`: `class_fee`→"Cuota de clase" y `payrollRoleLabels` (instructor/other).
- [ ] `src/pages/dashboard/Pnl.tsx`, `Payroll.tsx`, `Reports.tsx`.
- [ ] `src/components/charts/LineChart.tsx` (+ CSS en styles.css).
- [ ] Pestañas P&L / Nómina / Reportes habilitadas en `Dashboard.tsx`.
- [ ] CTA "Generar transacción" en Nómina reusa `NewTransactionPanel` (prellenado) y refresca al éxito; deshabilitado si `already_created`.
- [ ] Distribución de nómina refleja **Instructor / Otros** (sin asistente).
- [ ] Estados loading/empty/error en P&L y Nómina; Reportes con botones en "Preview" deshabilitados.
- [ ] `npm run typecheck` pasa sin warnings.
