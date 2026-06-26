# Módulo Finanzas (Dashboard) — Parte 1: Resumen, Ingresos y Gastos

## 1. Contexto del proyecto
Cantera (SaaS de academias). Construir el módulo **Finanzas**, un conjunto de pantallas-dashboard de solo lectura (admin) que consumen endpoints de agregación ya servidos por el backend. **El frontend solo pinta: no recalcula totales ni variaciones.** Esta entrega cubre 3 de 6 pantallas: **Resumen**, **Ingresos** y **Gastos**. Las otras 3 (P&L, Nómina, Reportes) van en entregas posteriores: déjalas como pestañas deshabilitadas con leyenda "Próximamente".

Este módulo **NO** se parece a los CRUD de Students/Instructors: **no** parametrices `UsersModule.tsx`. Sigue la "Receta para un módulo CRUD nuevo" de STYLE_GUIDE.md como base estructural, pero el contenido son dashboards con gráficos.

**Antes de tocar código, lee**: [STYLE_GUIDE.md](STYLE_GUIDE.md), [openapi.json](openapi.json), [src/api.ts](src/api.ts), [src/types.ts](src/types.ts), [src/utils/money.ts](src/utils/money.ts).

## 2. Identidad visual
Sigue los tokens y clases de STYLE_GUIDE.md. Este módulo introduce **gráficos**, que no existen en el repo: barras verticales, barras horizontales, dona, y un visual "resumen del mes" tipo cascada. **No instales ninguna librería de gráficos** (va contra las reglas duras). Constrúyelos a mano en **SVG + CSS**, con todas las clases nuevas en [src/styles.css](src/styles.css) (`.chart-*`, `.kpi-card`, `.donut`, etc.). Sin estilos inline salvo valores calculados dinámicamente (alturas/anchos/offsets de barras y segmentos).

## 3. Enums y labels (español)
Crea `src/utils/transactionLabels.ts` con mapas `valor → label`:

**TransactionCategory**: `tuition`→"Mensualidad", `enrollment_fee`→"Matrícula", `material_sale`→"Venta de material", `exam_fee`→"Examen/Certificación", `private_class`→"Clase privada", `other_income`→"Otros ingresos", `rent`→"Renta", `utilities`→"Servicios", `salary`→"Nómina", `marketing`→"Marketing", `equipment`→"Equipo", `other_expense`→"Otros gastos".

**PaymentMethod**: `credit_card`→"Tarjeta de crédito", `debit_card`→"Tarjeta de débito", `paypal`→"PayPal", `bank_transfer`→"Transferencia", `cash`→"Efectivo", `other`→"Otro".

**TransactionStatus**: `scheduled`→"Programada", `pending`→"Pendiente", `paid`→"Pagada", `cancelled`→"Cancelada".

## 4. Sincronización de tipos y API service

### 4.1 `src/types.ts` — agregar (derivados de openapi.json, schemas `Finance*`)
```ts
export interface KpiValue { value: number; prev_value: number; delta_pct: number | null }
export interface CategoryBreakdown { category: TransactionCategory; amount: number; count: number; pct: number }
export interface MethodBreakdown { payment_method: PaymentMethod; amount: number; count: number; pct: number }
export interface UserBreakdown { user: string; amount: number; count: number; pct: number }
export interface IncomeMonthStacked { month: string; by_category: TransactionCategory; total: number }
export interface MonthOverview { income: number; expense: number; net_profit: number }
export interface PnL {
  service_income: number; cogs: number; gross_profit: number;
  operating_expenses: number; operating_profit: number;
  other_income: number; other_expense: number; net_profit: number; margin: number;
}
export interface UpcomingPayment { id: number; description: string; date: string; amount: number; kind: TransactionKind; status: TransactionStatus }
export interface ExpenseBudget { scheduled_total: number; used_total: number; used_pct: number }

export interface FinanceOverviewKpis { total_income: KpiValue; total_expense: KpiValue; net_profit: KpiValue; profit_margin: KpiValue }
export interface FinanceOverviewRead {
  kpis: FinanceOverviewKpis;
  income_by_category: CategoryBreakdown[];
  month_overview: MonthOverview;
  pnl: PnL;
  recent_expenses: TransactionRead[];
  upcoming_payments: UpcomingPayment[];
}
export interface FinanceIncomeKpis { total_income: KpiValue; transaction_count: KpiValue; avg_daily: KpiValue; ytd_income: KpiValue }
export interface FinanceIncomeRead {
  kpis: FinanceIncomeKpis;
  by_month: IncomeMonthStacked[];
  by_category: CategoryBreakdown[];
  by_user: UserBreakdown[];
  by_payment_method: MethodBreakdown[];
}
export interface FinanceExpensesKpis { total_expense: KpiValue; transaction_count: KpiValue; avg_daily: KpiValue; budget: ExpenseBudget }
export interface FinanceExpensesRead {
  kpis: FinanceExpensesKpis;
  by_category: CategoryBreakdown[];
  by_payment_method: MethodBreakdown[];
  recent: TransactionRead[];
}
```

### 4.2 `src/api.ts` — agregar (todas lanzan `ApiError`)
```ts
export async function getFinanceOverview(month: number, year: number): Promise<FinanceOverviewRead>
export async function getFinanceIncome(month: number, year: number): Promise<FinanceIncomeRead>
export async function getFinanceExpenses(month: number, year: number): Promise<FinanceExpensesRead>
```
Rutas reales: `GET /dashboards/overview`, `GET /dashboards/income`, `GET /dashboards/expenses`. Query: `month` (1-12), `year` (>=2025). **No se envía `group_category_id`**: el desglose de ingresos es por usuario, no por grupo.

La acción "Nueva transacción / Nuevo ingreso / Nuevo gasto" usa el **`createTransaction` existente** (`POST /transactions`). No agregues endpoints nuevos.

## 5. Reglas de negocio / formato
- **Montos en cents.** Formatear con `formatMoney`/`fromCents` de [src/utils/money.ts](src/utils/money.ts). `transaction_count.value` es un **conteo** (entero, sin moneda).
- **Variación de KPIs**: usar `delta_pct`. Mostrar chip ↑/↓ con color verde (positivo) / rojo (negativo) y "vs. mes anterior". Si `delta_pct == null` → mostrar "—".
- **OJO escala de `margin` y `delta_pct`** (no está claro en el contrato si vienen como fracción 0–1 o como porcentaje 0–100). Centraliza el formateo en **un solo helper** (`formatPct`) y deja un comentario `// TODO: confirmar escala con respuesta real del backend`, asumiendo de momento que `delta_pct` ya es porcentaje y `margin` es fracción (×100). Que sea trivial cambiarlo en un lugar.
- **Selector de periodo (mes + año)** compartido por las 3 pantallas, en la topbar: `◀ [Junio 2026] ▶` con `ArrowLeftIcon`/`ArrowRightIcon`, o dos `<select>`. Default = mes/año actuales. Año mínimo 2025. Al cambiar de pestaña se **conserva** el periodo seleccionado.

## 6. UI / estructura

### Contenedor (`src/pages/Dashboard.tsx`)
- Envuelve en `<Layout title="Finanzas" actions={...}>`.
- `actions` de la topbar: selector de periodo + botón **"Nueva transacción"** (`.btn--primary`, abre `NewTransactionPanel`) + botón **"Exportar"** (`.btn--ghost`, **deshabilitado**, con badge "Preview").
- Debajo, una barra de pestañas (`.tab-group`) con: **Resumen**, **Ingresos**, **Gastos** (activas) y **P&L**, **Nómina**, **Reportes** (deshabilitadas, "Próximamente"). Estado de pestaña activa en este componente; el periodo (`{month, year}`) también vive aquí y se pasa por props a cada sección.
- Renderiza la sección activa: `<Overview month year/>`, `<Income .../>`, `<Expenses .../>`.
- `if (!token) return <Navigate to="/login" replace />`.
- Cada sección maneja sus **tres estados** (loading con `SpinnerIcon`, vacío `.empty-state`, error `.alert`). Mensajes en español.

### Sección Resumen (`src/pages/dashboard/Overview.tsx`) — `getFinanceOverview`
- **KPIs** (`.summary-grid` con `<KpiCard>`): Ingresos totales, Gastos totales, Utilidad neta, Margen de utilidad. Cada uno con su `delta_pct`.
- **Barras verticales** "Ingresos por categoría" (`income_by_category`, label desde `transactionLabels`).
- **Resumen del mes** (`month_overview`): visual tipo **cascada** Ingresos → (−)Gastos → Utilidad neta (3 columnas/segmentos). Si la cascada resulta compleja, usa 3 barras comparativas con la utilidad resaltada.
- **Mini-P&L** (`pnl`): lista vertical (`.detail-list`) con Ingresos por servicios, Costo de ventas, Utilidad bruta, Gastos operativos, Utilidad operativa, Otros ingresos, Otros gastos, **Utilidad neta** (resaltada) y Margen. Respeta este orden.
- **Gastos recientes** (`recent_expenses`): tabla `.users-table` con Fecha, Descripción, Categoría, Método de pago, Monto.
- **Próximos pagos / pendientes** (`upcoming_payments`): lista con Descripción, Fecha, Monto (+ `<StatusBadge>`).
- **Acciones rápidas**: "Nuevo ingreso" y "Nuevo gasto" (abren `NewTransactionPanel` con `kind` preseleccionado); "Pago de nómina" y "Ver reportes" deshabilitados (pantallas pendientes).

### Sección Ingresos (`src/pages/dashboard/Income.tsx`) — `getFinanceIncome`
- **KPIs**: Ingresos totales, # de transacciones, Ingreso promedio diario, Ingreso acumulado (YTD).
- **Barras por mes** (`by_month`): **totales mensuales** (una serie con `total`). ⚠️ `by_category` del contrato es un solo enum, **no** un desglose; **no** intentes apilar por categoría — renderiza el total del mes. Deja comentario `// TODO: backend debería devolver by_category como mapa para apilar`.
- **Dona** de distribución por categoría (`by_category`, mostrar `pct`).
- **Barras horizontales** "Ingresos por usuario" (`by_user`; `user` ya viene como nombre string). Este es el desglose intencional del módulo (se agrupa por usuario, no por grupo).
- **Barras horizontales** por método de pago (`by_payment_method`, label desde `transactionLabels`).
- *(La tabla de detalle de ingresos queda pendiente: aún no hay endpoint `/dashboards/income/transactions`. Cuando exista, no llevará columna de grupo; si acaso, columna de usuario.)*

### Sección Gastos (`src/pages/dashboard/Expenses.tsx`) — `getFinanceExpenses`
- **KPIs**: Gastos totales, # de transacciones, Gasto promedio diario, y **Presupuesto** (`budget`): muestra `used_total` / `scheduled_total` con una barra de progreso y `used_pct`.
- **Gastos por categoría** (`by_category`): tabla con Categoría, Monto y una **barra que marca el `pct`** dentro de la celda.
- **Dona** por método de pago (`by_payment_method`, con `pct`).
- **Gastos recientes** (`recent`): lista con Descripción, Fecha, Monto, Método de pago.

### Componentes de gráfico (`src/components/charts/`) — presentacionales, reutilizables
- `KpiCard.tsx` (label, value formateado, delta opcional con ↑/↓).
- `BarChart.tsx` (barras verticales: data `{label, value}[]`).
- `HBarList.tsx` (barras horizontales con label + valor + %).
- `DonutChart.tsx` (SVG, segmentos con % y leyenda).
- `WaterfallBar.tsx` (o reutiliza `BarChart` para el "resumen del mes").
Todo el CSS en [src/styles.css](src/styles.css). Usa `color-mix(in srgb, var(--color-primary) N%, …)` para series/tintes; **sin hex hardcoded** para primary/secondary/accent.

### `NewTransactionPanel.tsx` (`src/components/`)
- `<SidePanel>` con formulario para `createTransaction`. Prop `defaultKind?: 'sale'|'expense'`.
- Campos: `kind` (venta/gasto), `category` (filtrada según kind), `status`, `description`, `transaction_date`, `amount` (con `toCents`), `payment_method`, y `user_id` opcional (no bloqueante; puedes dejar `external_name` como alternativa libre). Validaciones básicas con `.field__error`/`aria-invalid`.
- Al guardar con éxito: cerrar panel, toast `.alert.alert--success` (auto-dismiss 4s) y **refrescar** la sección activa. Errores: patrón `ApiError` de STYLE_GUIDE.

## 7. Ruta y navegación
- Nueva ruta `/dashboard` en [src/App.tsx](src/App.tsx) → `Dashboard.tsx` (las sub-secciones son estado interno, no sub-rutas).
- Link nuevo en `<nav className="sidebar__nav">` de [src/components/Layout.tsx](src/components/Layout.tsx), label **"Finanzas"**, ruta `/dashboard`. Si no hay un ícono adecuado en [src/brand.tsx](src/brand.tsx) (no existe uno de finanzas/gráfico), **agrega un ícono nuevo** a `brand.tsx` siguiendo el patrón SVG existente (p. ej. `ChartIcon` o `WalletIcon`); no instales librerías de íconos.

## 8. Reglas y restricciones
- Todo en español. Sin emojis.
- CSS solo en [src/styles.css](src/styles.css); sin `.css` por componente; sin inline salvo dimensiones calculadas de gráficos.
- Sin librerías nuevas (ni de UI, ni de íconos, ni de charts).
- Tokens CSS para colores de marca; nada de hex para primary/secondary/accent.
- Toda lista/gráfico con sus 3 estados (cargando/vacío/error) en español.
- Solo-admin: si `!token` → redirect a login.

## 9. Definition of Done
- [ ] `src/types.ts` con los schemas `Finance*`, `KpiValue`, `CategoryBreakdown`, `MethodBreakdown`, `UserBreakdown`, `IncomeMonthStacked`, `MonthOverview`, `PnL`, `UpcomingPayment`, `ExpenseBudget`.
- [ ] `src/api.ts` con `getFinanceOverview`, `getFinanceIncome`, `getFinanceExpenses`.
- [ ] `src/utils/transactionLabels.ts` con los 3 mapas de labels.
- [ ] `src/pages/Dashboard.tsx` (Layout + selector de periodo + tab-group + CTAs) y secciones `dashboard/Overview.tsx`, `dashboard/Income.tsx`, `dashboard/Expenses.tsx`.
- [ ] Componentes de gráfico en `src/components/charts/` + `NewTransactionPanel.tsx`.
- [ ] Ruta en [src/App.tsx](src/App.tsx) y link "Finanzas" en sidebar (con ícono nuevo en `brand.tsx` si hace falta).
- [ ] Pestañas P&L / Nómina / Reportes visibles pero deshabilitadas ("Próximamente").
- [ ] Estados loading/empty/error en cada sección.
- [ ] `npm run typecheck` pasa sin warnings.
