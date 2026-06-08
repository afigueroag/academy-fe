import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AttendanceSheet from '../components/AttendanceSheet';
import { useAuth } from '../auth';
import { ApiError, getActiveSession, getCourse, getMeHome } from '../api';
import { formatMoney } from '../utils/money';
import { labelTransactionCategory } from '../utils/transactionLabels';
import { isValidScheduledDatetime } from '../utils/sessions';
import { TransactionStatusBadge } from '../components/Badges';
import { ArrowRightIcon, CheckIcon, SpinnerIcon } from '../brand';
import type { CourseRead, HomeMe, TransactionRead } from '../types';

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const CAP = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function formatNextSession(iso: string | null): string {
  if (!iso) return 'Sin próxima sesión';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin próxima sesión';

  const time = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(d) - startOf(new Date())) / 86400000);

  if (dayDiff === 0) return `Hoy ${time}`;
  if (dayDiff === 1) return `Mañana ${time}`;

  const date = d.toLocaleDateString('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${CAP(date)} ${time}`;
}

function formatShortDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function payoutDesc(tx: TransactionRead): string {
  return tx.description?.trim() || labelTransactionCategory(tx.category);
}

export default function InstructorHome() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const currency = me?.academy.currency ?? null;

  const [home, setHome] = useState<HomeMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openingCourseId, setOpeningCourseId] = useState<number | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<{
    course: CourseRead;
    datetime: string;
  } | null>(null);
  const [attendanceDirty, setAttendanceDirty] = useState(false);

  const loadHome = useCallback(async () => {
    try {
      const data = await getMeHome();
      setHome(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  const handleTakeAttendance = useCallback(async (courseId: number) => {
    setOpeningCourseId(courseId);
    setAttendanceError(null);
    try {
      const [active, raw] = await Promise.all([
        getActiveSession(courseId),
        getCourse(courseId),
      ]);
      const dt = active.scheduled_datetime;
      if (!dt || !isValidScheduledDatetime(dt)) {
        setAttendanceError('No hay una sesión activa en este momento.');
        return;
      }
      const course: CourseRead = {
        ...raw,
        instructor_links: raw.instructor_links.map((l) => ({
          ...l,
          instructor_id: l.instructor.id,
        })),
      };
      setAttendanceTarget({ course, datetime: dt });
    } catch (err) {
      setAttendanceError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo abrir la sesión, intenta de nuevo',
      );
    } finally {
      setOpeningCourseId(null);
    }
  }, []);

  const closeAttendance = useCallback(() => {
    setAttendanceTarget(null);
    if (attendanceDirty) {
      setAttendanceDirty(false);
      void loadHome();
    }
  }, [attendanceDirty, loadHome]);

  if (loading) {
    return (
      <Layout title="Inicio">
        <div className="loading-row">
          <SpinnerIcon /> Cargando…
        </div>
      </Layout>
    );
  }

  if (error || !home) {
    return (
      <Layout title="Inicio">
        <div className="alert" role="alert">
          {error ?? 'No se pudo cargar tu inicio.'}
        </div>
      </Layout>
    );
  }

  const kpis = home.instructor_kpis;
  const assigned = home.assigned_courses ?? [];
  const payouts = home.payouts;

  const pendingPayouts = [
    ...(payouts?.pending ?? []),
    ...(payouts?.scheduled ?? []),
  ].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  const paidPayouts = [...(payouts?.paid_recent ?? [])].sort((a, b) =>
    (b.paid_date ?? '').localeCompare(a.paid_date ?? ''),
  );

  return (
    <Layout title="Inicio">
      {attendanceError && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {attendanceError}
        </div>
      )}

      <div className="summary-grid" style={{ marginBottom: 24 }}>
        <div className="summary-card">
          <div className="summary-card__label">Clases activas</div>
          <div className="summary-card__value">{kpis?.active_courses ?? 0}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card__label">Total alumnos</div>
          <div className="summary-card__value">{kpis?.total_students ?? 0}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card__label">Horas del mes</div>
          <div className="summary-card__value">
            {(kpis?.hours_this_month ?? 0).toFixed(1)} h
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card__label">Pago pendiente</div>
          <div className="summary-card__value">
            {formatMoney(kpis?.pending_amount ?? 0, currency)}
          </div>
        </div>
      </div>

      <div className="home-grid">
        <section className="home-card home-classes-section">
          <h3 className="home-card__title">Mis clases</h3>

          {assigned.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">No tienes clases asignadas.</p>
            </div>
          ) : (
            assigned.map((ac) => (
              <div key={ac.course.id} className="home-classes-card">
                <div className="home-classes-card__main">
                  <span className="home-classes-card__title">
                    {truncate(ac.course.name, 30)}
                  </span>
                  <span className="home-classes-card__time">
                    {formatNextSession(ac.next_session_datetime)}
                  </span>
                </div>
                {ac.has_active_session ? (
                  <button
                    type="button"
                    className="btn btn--primary home-classes-card__cta"
                    onClick={() => handleTakeAttendance(ac.course.id)}
                    disabled={openingCourseId === ac.course.id}
                  >
                    {openingCourseId === ac.course.id ? (
                      <SpinnerIcon />
                    ) : (
                      <CheckIcon />
                    )}
                    Pasar lista
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary home-classes-card__cta"
                    disabled
                  >
                    Próxima sesión
                  </button>
                )}
              </div>
            ))
          )}

          <div style={{ marginTop: 'auto' }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => navigate('/clases')}
            >
              Ver mis clases <ArrowRightIcon />
            </button>
          </div>
        </section>

        <section className="home-card home-payouts-section">
          <h3 className="home-card__title">Pagos</h3>

          <div>
            <p className="home-payouts-section__title">Pago pendiente</p>
            {pendingPayouts.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">No tienes pagos pendientes.</p>
              </div>
            ) : (
              pendingPayouts.map((tx) => (
                <div key={tx.id} className="home-payouts-row">
                  <TransactionStatusBadge status={tx.status} />
                  <div className="home-payouts-row__main">
                    <span className="home-payouts-row__desc">
                      {payoutDesc(tx)}
                    </span>
                    <span className="home-payouts-row__meta">
                      {formatShortDate(tx.transaction_date)}
                    </span>
                  </div>
                  <span className="home-payouts-row__amount">
                    {formatMoney(tx.amount, currency)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div>
            <p className="home-payouts-section__title">Pagos realizados</p>
            {paidPayouts.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">Aún no hay pagos registrados.</p>
              </div>
            ) : (
              paidPayouts.map((tx) => (
                <div key={tx.id} className="home-payouts-row">
                  <TransactionStatusBadge status={tx.status} />
                  <div className="home-payouts-row__main">
                    <span className="home-payouts-row__desc">
                      {payoutDesc(tx)}
                    </span>
                    <span className="home-payouts-row__meta">
                      {formatShortDate(tx.paid_date ?? tx.transaction_date)}
                    </span>
                  </div>
                  <span className="home-payouts-row__amount">
                    {formatMoney(tx.amount, currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {attendanceTarget && (
        <AttendanceSheet
          open={!!attendanceTarget}
          course={attendanceTarget.course}
          scheduledDatetime={attendanceTarget.datetime}
          onClose={closeAttendance}
          onSaved={() => setAttendanceDirty(true)}
        />
      )}
    </Layout>
  );
}
