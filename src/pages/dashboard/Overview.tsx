import { useEffect, useState } from 'react';
import { ApiError, getFinanceOverview } from '../../api';
import type { FinanceOverviewRead, TransactionKind } from '../../types';
import { SpinnerIcon } from '../../brand';
import KpiCard from '../../components/charts/KpiCard';
import BarChart from '../../components/charts/BarChart';
import WaterfallBar from '../../components/charts/WaterfallBar';
import { TransactionStatusBadge } from '../../components/Badges';
import { formatMoney } from '../../utils/money';
import { formatPct, formatDayMonth } from '../../utils/finance';
import {
  labelPaymentMethod,
  labelTransactionCategory,
} from '../../utils/salesLabels';

interface OverviewProps {
  month: number;
  year: number;
  currency: string | null;
  reloadToken: number;
  onNewTransaction: (kind: TransactionKind) => void;
}

export default function Overview({
  month,
  year,
  currency,
  reloadToken,
  onNewTransaction,
}: OverviewProps) {
  const [data, setData] = useState<FinanceOverviewRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getFinanceOverview(month, year)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo cargar el resumen financiero.',
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
        <SpinnerIcon size={16} /> Cargando resumen…
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

  const { kpis, income_by_category, month_overview, pnl } = data;

  const pnlRows: { label: string; value: number; strong?: boolean }[] = [
    { label: 'Ingresos por servicios', value: pnl.service_income },
    { label: 'Costo de ventas', value: pnl.cogs },
    { label: 'Utilidad bruta', value: pnl.gross_profit },
    { label: 'Gastos operativos', value: pnl.operating_expenses },
    { label: 'Utilidad operativa', value: pnl.operating_profit },
    { label: 'Otros ingresos', value: pnl.other_income },
    { label: 'Otros gastos', value: pnl.other_expense },
    { label: 'Utilidad neta', value: pnl.net_profit, strong: true },
  ];

  return (
    <>
      <section className="summary-grid">
        <KpiCard
          label="Ingresos totales"
          value={money(kpis.total_income.value)}
          delta={kpis.total_income.delta_pct}
        />
        <KpiCard
          label="Gastos totales"
          value={money(kpis.total_expense.value)}
          delta={kpis.total_expense.delta_pct}
        />
        <KpiCard
          label="Utilidad neta"
          value={money(kpis.net_profit.value)}
          delta={kpis.net_profit.delta_pct}
        />
        <KpiCard
          label="Margen de utilidad"
          value={formatPct(kpis.profit_margin.value)}
          delta={kpis.profit_margin.delta_pct}
        />
      </section>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h2 className="chart-card__title">Ingresos por categoría</h2>
          {income_by_category.length ? (
            <BarChart
              data={income_by_category.map((c) => ({
                label: labelTransactionCategory(c.category),
                value: c.amount,
              }))}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin ingresos en este periodo.</p>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Resumen del mes</h2>
          <WaterfallBar
            income={month_overview.income}
            expense={month_overview.expense}
            netProfit={month_overview.net_profit}
            formatValue={money}
          />
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Estado de resultados</h2>
          <div className="detail-list">
            {pnlRows.map((r) => (
              <div
                className={
                  'detail-item' + (r.strong ? ' detail-item--strong' : '')
                }
                key={r.label}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <span className="detail-item__label" style={{ textTransform: 'none' }}>
                  {r.label}
                </span>
                <span className="detail-item__value">{money(r.value)}</span>
              </div>
            ))}
            <div
              className="detail-item"
              style={{ flexDirection: 'row', justifyContent: 'space-between' }}
            >
              <span className="detail-item__label" style={{ textTransform: 'none' }}>
                Margen
              </span>
              <span className="detail-item__value">
                {formatPct(pnl.margin)}
              </span>
            </div>
          </div>
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Próximos pagos</h2>
          {data.upcoming_payments.length ? (
            <ul className="upcoming-list">
              {data.upcoming_payments.map((p) => (
                <li className="upcoming-list__row" key={p.id}>
                  <div className="upcoming-list__main">
                    <div className="upcoming-list__desc">{p.description}</div>
                    <div className="upcoming-list__date">
                      {formatDayMonth(p.date)}
                    </div>
                  </div>
                  <div className="upcoming-list__right">
                    <span className="upcoming-list__amount">
                      {money(p.amount)}
                    </span>
                    <TransactionStatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="chart-empty">Sin pagos próximos ni pendientes.</p>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Acciones rápidas</h2>
          <div className="quick-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onNewTransaction('sale')}
            >
              Nuevo ingreso
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => onNewTransaction('expense')}
            >
              Nuevo gasto
            </button>
            <button type="button" className="btn btn--ghost" disabled>
              Pago de nómina
            </button>
            <button type="button" className="btn btn--ghost" disabled>
              Ver reportes
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--full">
        <div className="chart-card">
          <h2 className="chart-card__title">Gastos recientes</h2>
          <div className="table-wrapper">
            {data.recent_expenses.length ? (
              <table className="users-table">
                <thead>
                  <tr>
                    <th className="table-cell--nowrap">Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Método de pago</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_expenses.map((t) => (
                    <tr key={t.id}>
                      <td className="table-cell--nowrap">
                        {formatDayMonth(t.transaction_date)}
                      </td>
                      <td>{t.description}</td>
                      <td className="table-cell--nowrap">
                        {labelTransactionCategory(t.category)}
                      </td>
                      <td className="table-cell--nowrap">
                        {t.payment_method
                          ? labelPaymentMethod(t.payment_method)
                          : '—'}
                      </td>
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        {money(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p className="empty-state__title">Sin gastos recientes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
