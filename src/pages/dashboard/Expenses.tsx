import { useEffect, useState } from 'react';
import { ApiError, getFinanceExpenses } from '../../api';
import type { FinanceExpensesRead } from '../../types';
import { SpinnerIcon } from '../../brand';
import KpiCard from '../../components/charts/KpiCard';
import DonutChart from '../../components/charts/DonutChart';
import { formatMoney } from '../../utils/money';
import { formatPct, formatDayMonth, pctBarWidth } from '../../utils/finance';
import {
  labelPaymentMethod,
  labelTransactionCategory,
} from '../../utils/salesLabels';

interface ExpensesProps {
  month: number;
  year: number;
  currency: string | null;
  reloadToken: number;
}

export default function Expenses({
  month,
  year,
  currency,
  reloadToken,
}: ExpensesProps) {
  const [data, setData] = useState<FinanceExpensesRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getFinanceExpenses(month, year)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudieron cargar los gastos.',
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
        <SpinnerIcon size={16} /> Cargando gastos…
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

  const { kpis, by_category, by_payment_method, recent } = data;
  const budget = kpis.budget;
  const catMax = Math.max(1, ...by_category.map((c) => c.amount));

  return (
    <>
      <section className="summary-grid">
        <KpiCard
          label="Gastos totales"
          value={money(kpis.total_expense.value)}
          delta={kpis.total_expense.delta_pct}
        />
        <KpiCard
          label="# de transacciones"
          value={String(kpis.transaction_count.value)}
          delta={kpis.transaction_count.delta_pct}
        />
        <KpiCard
          label="Gasto promedio diario"
          value={money(kpis.avg_daily.value)}
          delta={kpis.avg_daily.delta_pct}
        />
        <div className="kpi-card">
          <p className="kpi-card__label">Presupuesto</p>
          <div className="kpi-card__value">
            {money(budget.used_total)}
            <span
              style={{
                fontSize: 14,
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-body)',
              }}
            >
              {' '}
              / {money(budget.scheduled_total)}
            </span>
          </div>
          <div className="progress">
            <div
              className={
                'progress__fill' +
                (budget.used_pct > 1 ? ' progress__fill--over' : '')
              }
              style={{ width: `${pctBarWidth(budget.used_pct)}%` }}
            />
          </div>
          <div className="kpi-card__delta kpi-card__delta--flat">
            {formatPct(budget.used_pct)} usado
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h2 className="chart-card__title">Gastos por categoría</h2>
          <div className="table-wrapper">
            {by_category.length ? (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th>Distribución</th>
                  </tr>
                </thead>
                <tbody>
                  {by_category.map((c) => (
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
                      <td>
                        <div className="bar-cell">
                          <div className="bar-cell__track">
                            <div
                              className="bar-cell__fill"
                              style={{ width: `${(c.amount / catMax) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p className="empty-state__title">Sin gastos en el periodo</p>
              </div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Gastos por método de pago</h2>
          {by_payment_method.length ? (
            <DonutChart
              data={by_payment_method.map((m) => ({
                label: labelPaymentMethod(m.payment_method),
                value: m.amount,
                pct: m.pct,
              }))}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin datos de métodos de pago.</p>
          )}
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--full">
        <div className="chart-card">
          <h2 className="chart-card__title">Gastos recientes</h2>
          <div className="table-wrapper">
            {recent.length ? (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th className="table-cell--nowrap">Fecha</th>
                    <th>Método de pago</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td>{t.description}</td>
                      <td className="table-cell--nowrap">
                        {formatDayMonth(t.transaction_date)}
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
