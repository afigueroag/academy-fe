import { useEffect, useState } from 'react';
import { ApiError, getFinanceIncome } from '../../api';
import type { FinanceIncomeRead } from '../../types';
import { SpinnerIcon } from '../../brand';
import KpiCard from '../../components/charts/KpiCard';
import BarChart from '../../components/charts/BarChart';
import HBarList from '../../components/charts/HBarList';
import DonutChart from '../../components/charts/DonutChart';
import { formatMoney } from '../../utils/money';
import { formatMonthLabel } from '../../utils/finance';
import {
  labelPaymentMethod,
  labelTransactionCategory,
} from '../../utils/salesLabels';

interface IncomeProps {
  month: number;
  year: number;
  currency: string | null;
  reloadToken: number;
}

export default function Income({
  month,
  year,
  currency,
  reloadToken,
}: IncomeProps) {
  const [data, setData] = useState<FinanceIncomeRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getFinanceIncome(month, year)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudieron cargar los ingresos.',
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
        <SpinnerIcon size={16} /> Cargando ingresos…
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

  const { kpis, by_month, by_category, by_user, by_payment_method } = data;

  return (
    <>
      <section className="summary-grid">
        <KpiCard
          label="Ingresos totales"
          value={money(kpis.total_income.value)}
          delta={kpis.total_income.delta_pct}
        />
        <KpiCard
          label="# de transacciones"
          // transaction_count es un conteo (entero, sin moneda).
          value={String(kpis.transaction_count.value)}
          delta={kpis.transaction_count.delta_pct}
        />
        <KpiCard
          label="Ingreso promedio diario"
          value={money(kpis.avg_daily.value)}
          delta={kpis.avg_daily.delta_pct}
        />
        <KpiCard
          label="Ingreso acumulado (YTD)"
          value={money(kpis.ytd_income.value)}
          delta={kpis.ytd_income.delta_pct}
        />
      </section>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h2 className="chart-card__title">Ingresos por mes</h2>
          {/* by_category del contrato es un solo enum, no un desglose: pintamos
              el total mensual.
              TODO: backend debería devolver by_category como mapa para apilar. */}
          {by_month.length ? (
            <BarChart
              data={by_month.map((m) => ({
                label: formatMonthLabel(m.month),
                value: m.total,
              }))}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin ingresos en el periodo.</p>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Distribución por categoría</h2>
          {by_category.length ? (
            <DonutChart
              data={by_category.map((c) => ({
                label: labelTransactionCategory(c.category),
                value: c.amount,
                pct: c.pct,
              }))}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin ingresos en el periodo.</p>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Ingresos por usuario</h2>
          {by_user.length ? (
            <HBarList
              data={by_user.map((u) => ({
                label: u.user,
                value: u.amount,
                pct: u.pct,
              }))}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin ingresos por usuario.</p>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Ingresos por método de pago</h2>
          {by_payment_method.length ? (
            <HBarList
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
    </>
  );
}
