import { useCallback, useEffect, useState, type ReactNode } from 'react';
import SidePanel from './SidePanel';
import { CourseStatusBadge } from './Badges';
import { ApiError, getCourseAttendanceMatrix } from '../api';
import { formatScheduleSummary } from '../utils/schedule';
import { instructorTypeLabel } from '../utils/instructorTypeLabels';
import { labelAttendanceStatus } from '../utils/attendanceLabels';
import { SpinnerIcon } from '../brand';
import type { AttendanceMatrixRead, AttendanceStatus } from '../types';

interface InstructorCourseDetailProps {
  courseId: number;
  open: boolean;
  onClose: () => void;
}

const CELL_CLASS: Record<AttendanceStatus, string> = {
  present: 'attendance-matrix__cell--present',
  absent: 'attendance-matrix__cell--absent',
  excused: 'attendance-matrix__cell--excused',
};

const CELL_SHORT: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  excused: 'J',
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatSessionShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function Item({ label, value }: { label: string; value: string | null | ReactNode }) {
  const isEmpty =
    value === null || value === undefined || value === '' || value === '—';
  return (
    <div className="detail-item">
      <span className="detail-item__label">{label}</span>
      <span
        className={
          'detail-item__value' + (isEmpty ? ' detail-item__value--empty' : '')
        }
      >
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
}

export default function InstructorCourseDetail({
  courseId,
  open,
  onClose,
}: InstructorCourseDetailProps) {
  const [matrix, setMatrix] = useState<AttendanceMatrixRead | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(
    async (params: { from_date?: string; to_date?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCourseAttendanceMatrix(courseId, params);
        setMatrix(data);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un error, intenta de nuevo',
        );
        setMatrix(null);
      } finally {
        setLoading(false);
      }
    },
    [courseId],
  );

  useEffect(() => {
    if (!open) return;
    setFromDate('');
    setToDate('');
    void load({});
  }, [open, load]);

  const applyRange = () => {
    void load({
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    });
  };

  const course = matrix?.course;
  const recurrenceLabel =
    course?.recurrence === 'one_time' ? 'Sesión única' : 'Semanal';

  return (
    <SidePanel
      open={open}
      title="Detalle de la clase"
      subtitle={course?.name}
      onClose={onClose}
    >
      {loading ? (
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      ) : error ? (
        <div className="alert" role="alert">
          {error}
        </div>
      ) : !matrix || !course ? (
        <div className="alert" role="alert">
          No se pudo cargar el detalle.
        </div>
      ) : (
        <div>
          <section className="form-section">
            <h3 className="form-section__title">Información general</h3>
            <div className="detail-list">
              <Item label="Nombre" value={course.name} />
              <Item label="Descripción" value={course.description} />
              <Item label="Ubicación" value={course.location} />
              <Item label="Recurrencia" value={recurrenceLabel} />
              <Item
                label="Estado"
                value={<CourseStatusBadge status={course.status} />}
              />
              <Item
                label="Duración"
                value={`${course.duration_minutes} min`}
              />
              <Item
                label="Cupo"
                value={`${matrix.capacity.enrolled} / ${matrix.capacity.max}`}
              />
              <Item
                label="Fecha de inicio"
                value={formatDate(course.start_date)}
              />
              {course.recurrence !== 'one_time' && (
                <Item label="Fecha de fin" value={formatDate(course.end_date)} />
              )}
              <Item
                label="Horario"
                value={formatScheduleSummary(
                  course.schedules,
                  course.duration_minutes,
                )}
              />
            </div>
          </section>

          <section className="form-section">
            <h3 className="form-section__title">Instructores</h3>
            {course.instructor_links.length === 0 ? (
              <p
                className="detail-item__value detail-item__value--empty"
                style={{ marginTop: 4 }}
              >
                Sin instructores asignados.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {course.instructor_links.map((link, i) => (
                  <li
                    key={`${link.instructor.id}-${i}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>
                      {link.instructor.first_name} {link.instructor.last_name}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {instructorTypeLabel(link.type)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="form-section">
            <h3 className="form-section__title">Asistencia</h3>

            <div className="field--row" style={{ marginBottom: 12 }}>
              <div className="field">
                <label className="field__label" htmlFor="att-from">
                  Desde
                </label>
                <input
                  id="att-from"
                  className="input"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="att-to">
                  Hasta
                </label>
                <input
                  id="att-to"
                  className="input"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={applyRange}
                >
                  Aplicar
                </button>
              </div>
            </div>

            {matrix.sessions.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">
                  Aún no hay sesiones registradas en este curso.
                </p>
              </div>
            ) : (
              <div className="attendance-matrix-wrapper">
                <table className="attendance-matrix">
                  <thead>
                    <tr>
                      <th className="attendance-matrix__student">Alumno</th>
                      {matrix.sessions.map((s) => (
                        <th key={s}>{formatSessionShort(s)}</th>
                      ))}
                      <th>% Asistencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.students.map((row) => {
                      const byDate = new Map(
                        row.attendance.map((a) => [a.scheduled_datetime, a.status]),
                      );
                      return (
                        <tr key={row.id}>
                          <td className="attendance-matrix__student">
                            <div className="attendance-matrix__student-name">
                              {row.first_name} {row.last_name}
                            </div>
                            {row.special_conditions && (
                              <span
                                className="attendance-matrix__conditions"
                                title={row.special_conditions}
                              >
                                Condiciones: {truncate(row.special_conditions, 60)}
                              </span>
                            )}
                          </td>
                          {matrix.sessions.map((s) => {
                            const status = byDate.get(s);
                            return (
                              <td
                                key={s}
                                className={
                                  status
                                    ? `attendance-matrix__cell ${CELL_CLASS[status]}`
                                    : 'attendance-matrix__empty'
                                }
                                title={status ? labelAttendanceStatus(status) : ''}
                              >
                                {status ? CELL_SHORT[status] : '—'}
                              </td>
                            );
                          })}
                          <td className="attendance-matrix__pct">
                            {row.attendance_pct === null
                              ? '—'
                              : `${Math.round(row.attendance_pct)}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </SidePanel>
  );
}
