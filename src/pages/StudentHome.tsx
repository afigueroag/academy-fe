import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import StudentCourseDetail from '../components/StudentCourseDetail';
import { useAuth } from '../auth';
import { ApiError, getMeHome } from '../api';
import { formatMoney } from '../utils/money';
import { labelTransactionCategory } from '../utils/transactionLabels';
import { ArrowRightIcon, SpinnerIcon } from '../brand';
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
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
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

function formatLongDate(value: string): string {
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function schedulesPreview(schedules: { schedule_day: ScheduleDay; schedule_time: string }[]): string {
  if (!schedules.length) return 'Sin horarios';
  return schedules
    .slice(0, 3)
    .map((s) => `${DAY_SHORT[s.schedule_day]} ${s.schedule_time.slice(0, 5)}`)
    .join(' · ');
}

export default function StudentHome() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const currency = me?.academy.currency ?? null;

  const [home, setHome] = useState<HomeMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'pending' | 'scheduled'>('pending');
  const [panelCourse, setPanelCourse] = useState<CourseStudentRead | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMeHome();
        if (!cancelled) {
          setHome(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError) setError(err.message);
          else setError('Ocurrió un error, intenta de nuevo');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const enrolled = home.enrolled_courses;
  const pendingTx = home.pending_transactions.filter((t) => t.kind === 'sale');
  const scheduledTx = home.scheduled_transactions.filter(
    (t) => t.kind === 'sale',
  );
  const txs = tab === 'pending' ? pendingTx : scheduledTx;

  const next = home.next_session;
  const att = home.attendance_summary;

  return (
    <Layout title="Inicio">
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
            {att ? `${Math.round(att.pct_last_12)}%` : '—'}
          </div>
        </div>
      </div>

      <div className="home-grid" style={{ marginBottom: 24 }}>
        <div className="home-card">
          <h3 className="home-card__title">Mis pagos</h3>

          <div className="tab-group">
            <button
              type="button"
              className={
                'tab-group__item' +
                (tab === 'pending' ? ' tab-group__item--active' : '')
              }
              onClick={() => setTab('pending')}
            >
              Pendientes
            </button>
            <button
              type="button"
              className={
                'tab-group__item' +
                (tab === 'scheduled' ? ' tab-group__item--active' : '')
              }
              onClick={() => setTab('scheduled')}
            >
              Próximos
            </button>
          </div>

          {txs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__title">
                {tab === 'pending'
                  ? 'Sin pagos pendientes'
                  : 'Sin pagos programados'}
              </div>
            </div>
          ) : (
            <div>
              {txs.map((tx: TransactionRead) => (
                <div key={tx.id} className="payment-row">
                  <div className="payment-row__main">
                    <span className="payment-row__desc">{tx.description}</span>
                    <span className="payment-row__meta">
                      <span className="payment-row__category">
                        {labelTransactionCategory(tx.category)}
                      </span>
                      <span>{formatLongDate(tx.transaction_date)}</span>
                    </span>
                  </div>
                  <div className="payment-row__amount">
                    {formatMoney(tx.amount, currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="home-card">
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
      </div>

      {enrolled.length > 0 && (
        <div className="cta-explore">
          <h3 className="cta-explore__title">Explorar más clases</h3>
          <p className="cta-explore__text">
            Echa un vistazo al catálogo completo de la academia.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => navigate('/clases')}
          >
            Explorar clases <ArrowRightIcon />
          </button>
        </div>
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
    </Layout>
  );
}
