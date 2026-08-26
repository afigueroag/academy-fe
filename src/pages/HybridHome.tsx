import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AttendanceSheet from '../components/AttendanceSheet';
import SidePanel from '../components/SidePanel';
import StudentCourseDetail from '../components/StudentCourseDetail';
import AthPaymentPanel from '../components/AthPaymentPanel';
import { useAuth } from '../auth';
import { ApiError, getActiveSession, getCourse, getMeHome } from '../api';
import { formatMoney } from '../utils/money';
import { formatPct } from '../utils/finance';
import { labelTransactionCategory } from '../utils/transactionLabels';
import { isValidScheduledDatetime } from '../utils/sessions';
import { TransactionStatusBadge } from '../components/Badges';
import { ArrowRightIcon, CheckIcon, SpinnerIcon } from '../brand';
import type {
  CourseRead,
  CourseRecurrence,
  CourseStatus,
  CourseStudentRead,
  HomeMe,
  Schedule,
  ScheduleDay,
  TransactionRead,
} from '../types';

const DAY_SHORT: Record<ScheduleDay, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const CAP = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function schedulesPreview(
  schedules: { schedule_day: ScheduleDay; schedule_time: string }[],
): string {
  if (!schedules.length) return 'Sin horarios';
  return schedules
    .slice(0, 3)
    .map((s) => `${DAY_SHORT[s.schedule_day]} ${s.schedule_time.slice(0, 5)}`)
    .join(' · ');
}

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

function formatShortDay(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}

function formatHour(iso: string): string | null {
  if (!iso.includes('T') && !iso.includes(' ')) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
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

function asStudentCourse(c: CourseRead): CourseStudentRead {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    status: (c.status ?? 'active') as CourseStatus,
    recurrence: (c.recurrence ?? 'weekly') as CourseRecurrence,
    duration_minutes: c.duration_minutes,
    individual_cost: c.individual_cost,
    location: c.location,
    start_date: c.start_date,
    end_date: c.end_date,
    schedules: c.schedules as unknown as Schedule[],
    instructor_links: c.instructor_links.map((l) => ({
      type: l.type,
      instructor: l.instructor,
    })),
    has_capacity: true,
    can_enroll: true,
    groups: c.groups,
  };
}

export default function HybridHome() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const currency = me?.academy.currency ?? null;
  // Pago en línea disponible solo si la academia tiene una cuenta de cobro activa.
  const athEnabled = me?.academy.has_active_payment_account === true;

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
  const [panelCourse, setPanelCourse] = useState<CourseStudentRead | null>(null);
  const [payTx, setPayTx] = useState<TransactionRead | null>(null);

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
  const enrolled = home.enrolled_courses;
  const next = home.next_session;
  const att = home.attendance_summary;

  // Lo que le paga la academia (funciones de instructor).
  const pendingPayouts = [
    ...(payouts?.pending ?? []),
    ...(payouts?.scheduled ?? []),
  ].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  // Lo que debe como estudiante. Los próximos entran junto a los pendientes:
  // el backend acepta cobrar una transacción `scheduled` para adelantarla.
  const debts = [
    ...home.pending_transactions,
    ...home.scheduled_transactions,
  ]
    .filter((t) => t.kind === 'sale')
    .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));

  // Cobros ya pagados. El backend solo llena paid_transactions para rol
  // student, así que el bloque se pinta únicamente si trae algo.
  const paidDebts = home.paid_transactions.filter((t) => t.kind === 'sale');

  return (
    <Layout title="Inicio">
      {attendanceError && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {attendanceError}
        </div>
      )}

      {/* Indicadores de instructor (prioritarios). */}
      <div className="summary-grid" style={{ marginBottom: 16 }}>
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

      {/* Indicadores de estudiante. */}
      <div className="summary-grid" style={{ marginBottom: 24 }}>
        <div className="summary-card">
          <div className="summary-card__label">Clases inscritas</div>
          <div className="summary-card__value">{enrolled.length}</div>
        </div>
        <div className="summary-card">
          <div className="summary-card__label">Próxima clase</div>
          {next ? (
            <div className="next-session-card">
              <div className="next-session-card__course">
                {truncate(next.course.name, 28)}
              </div>
              <div className="next-session-card__when">
                {formatShortDay(next.datetime)}
                {formatHour(next.datetime) && ` · ${formatHour(next.datetime)}`}
              </div>
            </div>
          ) : (
            <div className="summary-card__value summary-card__value--empty">
              Sin clases próximas
            </div>
          )}
        </div>
        <div className="summary-card">
          <div className="summary-card__label">Deuda</div>
          <div className="summary-card__value">
            {formatMoney(home.user.debt_amount ?? 0, currency)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card__label">Asistencia</div>
          <div className="summary-card__value">
            {att ? formatPct(att.pct_last_12, 0) : '—'}
          </div>
        </div>
      </div>

      <div className="home-grid">
        {/* Clases que imparte (con pasar lista) — prioritario. */}
        <section className="home-card home-classes-section">
          <h3 className="home-card__title">Mis clases (imparto)</h3>

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

        {/* Pagos: lo que me pagan y lo que debo. */}
        <section className="home-card home-payouts-section">
          <h3 className="home-card__title">Pagos</h3>

          <div>
            <p className="home-payouts-section__title">Pago pendiente (a cobrar)</p>
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
            <p className="home-payouts-section__title">Mis cobros (a pagar)</p>
            {debts.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">No tienes cobros pendientes.</p>
              </div>
            ) : (
              debts.map((tx) => (
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
                  {athEnabled && (
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => setPayTx(tx)}
                    >
                      Pagar
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {paidDebts.length > 0 && (
            <div>
              <p className="home-payouts-section__title">Mis cobros pagados</p>
              {paidDebts.map((tx) => (
                <div key={tx.id} className="home-payouts-row">
                  <TransactionStatusBadge status={tx.status} />
                  <div className="home-payouts-row__main">
                    <span className="home-payouts-row__desc">
                      {payoutDesc(tx)}
                    </span>
                    <span className="home-payouts-row__meta">
                      {/* Un pago adelantado conserva su transaction_date
                          futura: aquí manda paid_date. */}
                      Pagado el{' '}
                      {formatShortDate(tx.paid_date ?? tx.transaction_date)}
                    </span>
                  </div>
                  <span className="home-payouts-row__amount">
                    {formatMoney(tx.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Clases inscritas como estudiante. */}
      <div className="home-card" style={{ marginTop: 24 }}>
        <h3 className="home-card__title">Mis clases inscritas</h3>

        {enrolled.length === 0 ? (
          <>
            <div className="empty-state">
              <div className="empty-state__title">
                Aún no estás inscrito en ninguna clase
              </div>
            </div>
            <div className="cta-explore">
              <h3 className="cta-explore__title">Explorar clases</h3>
              <p className="cta-explore__text">
                Descubre las clases disponibles en tu academia.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate('/clases')}
              >
                Explorar clases <ArrowRightIcon />
              </button>
            </div>
          </>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {enrolled.map((c) => (
              <li key={c.id} className="payment-row">
                <div className="payment-row__main">
                  <span className="payment-row__desc">{c.name}</span>
                  <span className="payment-row__meta">
                    <span>{schedulesPreview(c.schedules)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setPanelCourse(asStudentCourse(c))}
                >
                  Ver detalle
                </button>
              </li>
            ))}
          </ul>
        )}
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

      <SidePanel
        open={!!panelCourse}
        title="Detalle de la clase"
        subtitle={panelCourse?.name}
        onClose={() => setPanelCourse(null)}
      >
        {panelCourse && (
          <StudentCourseDetail course={panelCourse} currency={currency} />
        )}
      </SidePanel>

      <SidePanel
        open={!!payTx}
        title="Pagar con ATH Móvil"
        subtitle={payTx?.description}
        onClose={() => setPayTx(null)}
      >
        {payTx && (
          <AthPaymentPanel
            transactionId={payTx.id}
            description={payTx.description}
            amount={payTx.amount}
            currency={currency}
            onPaid={loadHome}
            onClose={() => setPayTx(null)}
          />
        )}
      </SidePanel>
    </Layout>
  );
}
