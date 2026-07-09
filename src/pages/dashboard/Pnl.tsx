import { useEffect, useState } from 'react';
import { ApiError, getFinancePnl } from '../../api';
import type { CategoryBreakdown, FinancePnlRead } from '../../types';
import { SpinnerIcon } from '../../brand';
import KpiCard from '../../components/charts/KpiCard';
import LineChart from '../../components/charts/LineChart';
import { formatMoney } from '../../utils/money';
import { formatPct, formatMonthLabel } from '../../utils/finance';
import { labelTransactionCategory } from '../../utils/salesLabels';

interface PnlProps {
  month: number;
  year: number;
  currency: string | null;
  reloadToken: number;
}

export default function Pnl({ month, year, currency, reloadToken }: PnlProps) {
  const [data, setData] = useState<FinancePnlRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getFinancePnl(month, year)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo cargar el P&L.',
        );
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month, year, reloadToken]);

  const money = (n: number) => formatMoney(n, currency);

  if (loading) {
    return (
      <div className="loading-row">
        <SpinnerIcon size={16} /> Cargando P&L…
      </div>
    );
  }
  if (error) {
    return (
      <div className="alert" role="alert">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { kpis, income_by_category, expense_by_category, pnl, net_profit_trend } =
    data;

  const total = (rows: CategoryBreakdown[]) =>
    rows.reduce((s, r) => s + r.amount, 0);

  const pnlRows: { label: string; value: number; strong?: boolean }[] = [
    { label: 'Ingresos por servicios', value: pnl.service_income },
    { label: '(−) Costo de ventas', value: pnl.cogs },
    { label: '= Utilidad bruta', value: pnl.gross_profit, strong: true },
    { label: '(−) Gastos operativos', value: pnl.operating_expenses },
    { label: '= Utilidad operativa', value: pnl.operating_profit, strong: true },
    { label: '(+) Otros ingresos', value: pnl.other_income },
    { label: '(−) Otros gastos', value: pnl.other_expense },
    { label: '= Utilidad neta', value: pnl.net_profit, strong: true },
  ];

  const categoryTable = (
    title: string,
    rows: CategoryBreakdown[],
    emptyMsg: string,
  ) => (
    <div className="chart-card">
      <h2 className="chart-card__title">{title}</h2>
      <div className="table-wrapper">
        {rows.length ? (
          <table className="users-table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.category}>
                  <td className="table-cell--nowrap">
                    {labelTransactionCategory(c.category)}
                  </td>
                  <td
                    className="table-cell--nowrap"
                    style={{ textAlign: 'right' }}
                  >
                    {money(c.amount)}
                  </td>
                </tr>
              ))}
              <tr className="users-table__total">
                <td className="table-cell--nowrap">Total</td>
                <td
                  className="table-cell--nowrap"
                  style={{ textAlign: 'right' }}
                >
                  {money(total(rows))}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p className="empty-state__title">{emptyMsg}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <section className="summary-grid">
        <KpiCard
          label="Ingresos del mes"
          value={money(kpis.income.value)}
          delta={kpis.income.delta_pct}
        />
        <KpiCard
          label="Gastos del mes"
          value={money(kpis.expense.value)}
          delta={kpis.expense.delta_pct}
        />
        <KpiCard
          label="Nómina del mes"
          value={money(kpis.payroll.value)}
          delta={kpis.payroll.delta_pct}
        />
        <KpiCard
          label="Utilidad neta del mes"
          value={money(kpis.net_profit.value)}
          delta={kpis.net_profit.delta_pct}
        />
      </section>

      <div className="dashboard-grid">
        {categoryTable(
          'Ingresos por categoría',
          income_by_category,
          'Sin ingresos en el periodo',
        )}
        {categoryTable(
          'Gastos por categoría',
          expense_by_category,
          'Sin gastos en el periodo',
        )}

        <div className="chart-card pnl-net">
          <h2 className="chart-card__title">Utilidad Neta</h2>
          <div className="pnl-net__value">{money(pnl.net_profit)}</div>
          <div className="pnl-net__margin">
            Margen{' '}
            <span className="pnl-net__margin-value">
              {formatPct(pnl.margin, true)}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--full">
        <div className="chart-card">
          <h2 className="chart-card__title">
            Evolución de la utilidad neta por mes
          </h2>
          {net_profit_trend.length ? (
            <LineChart
              data={net_profit_trend.map((p) => ({
                label: formatMonthLabel(p.month),
                value: p.amount,
              }))}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin datos de evolución en el periodo.</p>
          )}
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--full">
        <div className="chart-card">
          <h2 className="chart-card__title">Resumen del mes (P&L)</h2>
          <div className="detail-list">
            {pnlRows.map((r) => (
              <div
                className={
                  'detail-item' + (r.strong ? ' detail-item--strong' : '')
                }
                key={r.label}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <span
                  className="detail-item__label"
                  style={{ textTransform: 'none' }}
                >
                  {r.label}
                </span>
                <span className="detail-item__value">{money(r.value)}</span>
              </div>
            ))}
            <div
              className="detail-item"
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <span
                className="detail-item__label"
                style={{ textTransform: 'none' }}
              >
                Margen
              </span>
              <span className="detail-item__value">
                {formatPct(pnl.margin, true)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
