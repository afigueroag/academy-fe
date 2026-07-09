import { useEffect, useState } from 'react';
import { ApiError, getFinancePayroll } from '../../api';
import type {
  FinancePayrollRead,
  PayrollComputedRow,
  PayrollRole,
  UserPublic,
} from '../../types';
import { SpinnerIcon } from '../../brand';
import KpiCard from '../../components/charts/KpiCard';
import BarChart from '../../components/charts/BarChart';
import DonutChart from '../../components/charts/DonutChart';
import { TransactionStatusBadge } from '../../components/Badges';
import type { TransactionPrefill } from '../../components/TransactionForm';
import { formatMoney, fromCents } from '../../utils/money';
import { formatDayMonth, formatMonthLabel } from '../../utils/finance';
import { payrollRoleLabels } from '../../utils/salesLabels';

interface PayrollProps {
  month: number;
  year: number;
  currency: string | null;
  reloadToken: number;
  onGenerate: (prefill: TransactionPrefill) => void;
}

const userName = (u: UserPublic) => `${u.first_name} ${u.last_name}`;

// Celda de persona: nombre grande + rol pequeño debajo (optimización de espacio).
function UserCell({ user, role }: { user: UserPublic; role: PayrollRole }) {
  return (
    <div className="user-cell user-cell--stacked">
      <span className="user-cell__name">{userName(user)}</span>
      <span className="user-cell__role">{payrollRoleLabels(role)}</span>
    </div>
  );
}

const periodLabel = (start: string | null, end: string | null) =>
  start || end ? `${formatDayMonth(start)} – ${formatDayMonth(end)}` : '—';

export default function Payroll({
  month,
  year,
  currency,
  reloadToken,
  onGenerate,
}: PayrollProps) {
  const [data, setData] = useState<FinancePayrollRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getFinancePayroll(month, year)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((err) => {
        if (!active) return;
        setError(
          err instanceof ApiError
            ? err.message
            : 'No se pudo cargar la nómina.',
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
        <SpinnerIcon size={16} /> Cargando nómina…
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

  const { kpis, computed, transactions, distribution, by_month, upcoming } =
    data;
  const next = kpis.next_scheduled;

  const handleGenerate = (row: PayrollComputedRow) => {
    onGenerate({
      category: 'salary',
      user_id: row.user.id,
      user_label: userName(row.user),
      gross_amount: String(fromCents(row.computed_amount) ?? ''),
      description: `Nómina ${periodLabel(row.period_start, row.period_end)} — ${userName(row.user)}`,
      status: 'pending',
      period_start: row.period_start,
      period_end: row.period_end,
    });
  };

  return (
    <>
      <section className="summary-grid">
        <KpiCard
          label="Nómina total del mes"
          value={money(kpis.total_payroll.value)}
          delta={kpis.total_payroll.delta_pct}
        />
        <KpiCard
          label="Empleados pagados"
          // Conteo (entero, sin moneda).
          value={String(kpis.employees_paid.value)}
          delta={kpis.employees_paid.delta_pct}
        />
        <KpiCard
          label="Pago promedio por empleado"
          value={money(kpis.avg_per_employee.value)}
          delta={kpis.avg_per_employee.delta_pct}
        />
        <div className="kpi-card">
          <p className="kpi-card__label">Próximo pago programado</p>
          {next ? (
            <>
              <div className="kpi-card__value">{money(next.amount)}</div>
              <div className="kpi-card__delta kpi-card__delta--flat">
                {formatDayMonth(next.date)} · en {next.days_until} días
              </div>
            </>
          ) : (
            <div className="kpi-card__value kpi-card__value--muted">
              Sin pagos programados
            </div>
          )}
        </div>
      </section>

      <div className="dashboard-grid dashboard-grid--full">
        <div className="chart-card">
          <h2 className="chart-card__title">Calculado por asistencia</h2>
          <div className="table-wrapper">
            {computed.length ? (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Periodo</th>
                    <th style={{ textAlign: 'right' }}>Horas</th>
                    <th style={{ textAlign: 'right' }}>Monto calculado</th>
                    <th style={{ textAlign: 'right' }} />
                  </tr>
                </thead>
                <tbody>
                  {computed.map((row) => (
                    <tr key={row.user.id}>
                      <td>
                        <UserCell user={row.user} role={row.role} />
                      </td>
                      <td className="table-cell--nowrap">
                        {periodLabel(row.period_start, row.period_end)}
                      </td>
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        {row.hours}
                      </td>
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        {money(row.computed_amount)}
                      </td>
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        {row.already_created ? (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled
                          >
                            Ya generada
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => handleGenerate(row)}
                          >
                            Generar transacción
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p className="empty-state__title">
                  Sin nómina calculada en el periodo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid--full">
        <div className="chart-card">
          <h2 className="chart-card__title">Transacciones de nómina</h2>
          <div className="table-wrapper">
            {transactions.length ? (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Periodo</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                    <th>Estatus</th>
                    <th className="table-cell--nowrap">Fecha de pago</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <UserCell user={t.user} role={t.role} />
                      </td>
                      <td className="table-cell--nowrap">
                        {periodLabel(t.period_start, t.period_end)}
                      </td>
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        {money(t.amount)}
                      </td>
                      <td>
                        <TransactionStatusBadge status={t.status} />
                      </td>
                      <td className="table-cell--nowrap">
                        {formatDayMonth(t.paid_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <p className="empty-state__title">
                  Sin transacciones de nómina en el periodo
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="chart-card">
          <h2 className="chart-card__title">Distribución de nómina</h2>
          {distribution.instructor + distribution.other > 0 ? (
            <DonutChart
              data={[
                {
                  label: payrollRoleLabels('instructor'),
                  value: distribution.instructor,
                },
                { label: payrollRoleLabels('other'), value: distribution.other },
              ]}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin nómina en el periodo.</p>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Nómina por mes</h2>
          {by_month.length ? (
            <BarChart
              data={by_month.map((m) => ({
                label: formatMonthLabel(m.month),
                value: m.amount,
              }))}
              formatValue={money}
            />
          ) : (
            <p className="chart-empty">Sin nómina en el periodo.</p>
          )}
        </div>

        <div className="chart-card">
          <h2 className="chart-card__title">Próximos pagos programados</h2>
          {upcoming.length ? (
            <ul className="upcoming-list">
              {upcoming.map((p, i) => (
                <li className="upcoming-list__row" key={`${p.user.id}-${i}`}>
                  <div className="upcoming-list__main">
                    <div className="upcoming-list__desc">
                      {userName(p.user)}
                    </div>
                    <div className="upcoming-list__date">
                      {payrollRoleLabels(p.role)} · {formatDayMonth(p.date)}
                    </div>
                  </div>
                  <div className="upcoming-list__right">
                    <span className="upcoming-list__amount">
                      {money(p.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="chart-empty">Sin pagos programados.</p>
          )}
        </div>
      </div>
    </>
  );
}
