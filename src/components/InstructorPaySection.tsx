import { useCallback, useEffect, useMemo, useState } from 'react';
import type { InstructorPmtRead } from '../types';
import { ApiError, getInstructorPmt } from '../api';
import { ClockIcon, SpinnerIcon } from '../brand';
import { formatMoney } from '../utils/money';
import { labelAttendanceRole } from '../utils/attendanceLabels';

type Preset = 'this_month' | 'last_month' | 'last_30' | 'custom';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function presetRange(p: Exclude<Preset, 'custom'>): {
  from: string;
  to: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (p === 'this_month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }
  if (p === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toIsoDate(from), to: toIsoDate(to) };
  }
  const from = new Date(today);
  from.setDate(from.getDate() - 30);
  return { from: toIsoDate(from), to: toIsoDate(today) };
}

interface InstructorPaySectionProps {
  instructorId: number;
  currency: string | null;
}

export default function InstructorPaySection({
  instructorId,
  currency,
}: InstructorPaySectionProps) {
  const [preset, setPreset] = useState<Preset>('this_month');
  const initial = useMemo(() => presetRange('this_month'), []);
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);

  const [data, setData] = useState<InstructorPmtRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') {
      const r = presetRange(p);
      setFromDate(r.from);
      setToDate(r.to);
    }
  };

  const fetchData = useCallback(async () => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getInstructorPmt(instructorId, {
        from_date: fromDate,
        to_date: toDate,
      });
      setData(result);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo cargar el pago del instructor.',
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [instructorId, fromDate, toDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isEmpty = !data || data.by_course.length === 0;
  const totalHours = data ? data.total_hours.toFixed(1) : '0.0';
  const totalPay = formatMoney(data?.total_payment ?? 0, currency);

  return (
    <section className="form-section" style={{ marginTop: 16 }}>
      <h4
        className="form-section__title"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <ClockIcon size={16} /> Horas y pago
      </h4>

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <select
          className="select"
          value={preset}
          onChange={(e) => handlePreset(e.target.value as Preset)}
          aria-label="Rango"
          style={{ flex: '0 0 180px' }}
        >
          <option value="this_month">Mes en curso</option>
          <option value="last_month">Mes pasado</option>
          <option value="last_30">Últimos 30 días</option>
          <option value="custom">Personalizado</option>
        </select>
        <input
          type="date"
          className="input"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPreset('custom');
          }}
          aria-label="Desde"
          style={{ flex: '0 0 150px' }}
        />
        <input
          type="date"
          className="input"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPreset('custom');
          }}
          aria-label="Hasta"
          style={{ flex: '0 0 150px' }}
        />
      </div>

      <div
        className="summary-grid"
        style={{
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          marginBottom: 12,
        }}
      >
        <div className="summary-card">
          <p className="summary-card__label">Horas</p>
          <div className="summary-card__value">{totalHours}</div>
        </div>
        <div className="summary-card">
          <p className="summary-card__label">Pago</p>
          <div className="summary-card__value">{totalPay}</div>
        </div>
      </div>

      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      ) : isEmpty ? (
        <p
          className="empty-state__title"
          style={{ fontSize: 14, margin: '8px 0' }}
        >
          Sin sesiones registradas en este rango.
        </p>
      ) : (
        <div className="table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Rol</th>
                <th
                  className="table-cell--nowrap"
                  style={{ textAlign: 'right' }}
                >
                  Sesiones
                </th>
                <th
                  className="table-cell--nowrap"
                  style={{ textAlign: 'right' }}
                >
                  Horas
                </th>
                <th
                  className="table-cell--nowrap"
                  style={{ textAlign: 'right' }}
                >
                  Tarifa
                </th>
                <th
                  className="table-cell--nowrap"
                  style={{ textAlign: 'right' }}
                >
                  Pago
                </th>
              </tr>
            </thead>
            <tbody>
              {data!.by_course.map((c) => (
                <tr key={`${c.course_id}|${c.attendance_role}`}>
                  <td>{c.course_name}</td>
                  <td className="table-cell--nowrap">
                    {labelAttendanceRole(c.attendance_role)}
                  </td>
                  <td
                    className="table-cell--nowrap"
                    style={{ textAlign: 'right' }}
                  >
                    {c.sessions}
                  </td>
                  <td
                    className="table-cell--nowrap"
                    style={{ textAlign: 'right' }}
                  >
                    {c.hours.toFixed(1)}
                  </td>
                  <td
                    className="table-cell--nowrap"
                    style={{ textAlign: 'right' }}
                  >
                    {formatMoney(c.hourly_rate, currency)}/h
                  </td>
                  <td
                    className="table-cell--nowrap"
                    style={{ textAlign: 'right' }}
                  >
                    {formatMoney(c.payment, currency)}
                  </td>
                </tr>
              ))}
              <tr>
                <td
                  colSpan={5}
                  style={{ textAlign: 'right', fontWeight: 600 }}
                >
                  Total
                </td>
                <td
                  className="table-cell--nowrap"
                  style={{ textAlign: 'right', fontWeight: 600 }}
                >
                  {totalPay}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
