import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import InstructorCourseDetail from '../components/InstructorCourseDetail';
import { useAuth } from '../auth';
import { ApiError, getInstructorPmt, getMeHome } from '../api';
import { formatMoney } from '../utils/money';
import { labelAttendanceRole } from '../utils/attendanceLabels';
import { EyeIcon, SpinnerIcon } from '../brand';
import type {
  AssignedCourseRead,
  CoursePmtRead,
} from '../types';

interface ClassRow {
  courseId: number;
  name: string;
  nextSession: string | null;
  pmt: CoursePmtRead | null;
}

function currentMonthRange(): { from_date: string; to_date: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  return {
    from_date: iso(new Date(y, m, 1)),
    to_date: iso(new Date(y, m + 1, 0)),
  };
}

function formatNextSession(iso: string | null): string {
  if (!iso) return 'Sin próxima sesión';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} · ${time}`;
}

export default function InstructorClasses() {
  const { me } = useAuth();
  const currency = me?.academy.currency ?? null;

  const [assigned, setAssigned] = useState<AssignedCourseRead[]>([]);
  const [byCourse, setByCourse] = useState<CoursePmtRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelCourse, setPanelCourse] = useState<number | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      try {
        const [home, pmt] = await Promise.all([
          getMeHome(),
          getInstructorPmt(me.id, currentMonthRange()),
        ]);
        if (cancelled) return;
        setAssigned(home.assigned_courses ?? []);
        setByCourse(pmt.by_course ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Ocurrió un error, intenta de nuevo',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  const rows = useMemo<ClassRow[]>(() => {
    const map = new Map<number, ClassRow>();
    for (const ac of assigned) {
      map.set(ac.course.id, {
        courseId: ac.course.id,
        name: ac.course.name,
        nextSession: ac.next_session_datetime,
        pmt: null,
      });
    }
    for (const pmt of byCourse) {
      const existing = map.get(pmt.course_id);
      if (existing) {
        existing.pmt = pmt;
      } else {
        map.set(pmt.course_id, {
          courseId: pmt.course_id,
          name: pmt.course_name,
          nextSession: null,
          pmt,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assigned, byCourse]);

  // Auto-abrir el detalle si venimos del CTA "Pasar lista" de Inicio.
  useEffect(() => {
    const courseParam = searchParams.get('course');
    if (!loading && courseParam) {
      const id = Number(courseParam);
      if (!Number.isNaN(id)) setPanelCourse(id);
    }
  }, [loading, searchParams]);

  const closePanel = () => {
    setPanelCourse(null);
    if (searchParams.has('course')) {
      searchParams.delete('course');
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  };

  return (
    <Layout title="Mis clases">
      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="table-wrapper">
        {loading ? (
          <div className="loading-row">
            <SpinnerIcon size={16} /> Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No tienes clases asignadas.</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Curso</th>
                <th>Rol</th>
                <th className="table-cell--nowrap">Próxima sesión</th>
                <th style={{ textAlign: 'right' }}>Sesiones (mes)</th>
                <th style={{ textAlign: 'right' }}>Horas (mes)</th>
                <th style={{ textAlign: 'right' }}>Tarifa/hr</th>
                <th style={{ textAlign: 'right' }}>Pago acumulado</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.courseId}>
                  <td>
                    <span className="user-cell__name">{row.name}</span>
                  </td>
                  <td>
                    {row.pmt ? labelAttendanceRole(row.pmt.attendance_role) : '—'}
                  </td>
                  <td className="table-cell--nowrap">
                    {formatNextSession(row.nextSession)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{row.pmt?.sessions ?? 0}</td>
                  <td style={{ textAlign: 'right' }}>
                    {(row.pmt?.hours ?? 0).toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {row.pmt ? formatMoney(row.pmt.hourly_rate, currency) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {row.pmt ? formatMoney(row.pmt.payment, currency) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setPanelCourse(row.courseId)}
                      title="Ver detalle"
                      aria-label="Ver detalle"
                    >
                      <EyeIcon size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {panelCourse !== null && (
        <InstructorCourseDetail
          courseId={panelCourse}
          open={panelCourse !== null}
          onClose={closePanel}
        />
      )}
    </Layout>
  );
}
