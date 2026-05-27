import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AttendanceRead } from '../types';
import { ApiError, listAttendance } from '../api';
import { CalendarIcon, SpinnerIcon } from '../brand';
import { labelAttendanceStatus } from '../utils/attendanceLabels';
import {
  formatSessionDay,
  formatSessionTime,
  studentStats,
} from '../utils/sessions';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface StudentAttendanceSectionProps {
  studentId: number;
}

export default function StudentAttendanceSection({
  studentId,
}: StudentAttendanceSectionProps) {
  const [rows, setRows] = useState<AttendanceRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<number | 'all'>('all');

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from, to };
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAttendance({
        user_id: studentId,
        attendance_role: 'student',
        from_date: toIsoDate(range.from),
        to_date: toIsoDate(range.to),
        limit: 1000,
      });
      setRows(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo cargar la asistencia.',
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, range]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filtered = useMemo(
    () =>
      courseFilter === 'all'
        ? rows
        : rows.filter((r) => r.course.id === courseFilter),
    [rows, courseFilter],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        b.scheduled_datetime.localeCompare(a.scheduled_datetime),
      ),
    [filtered],
  );

  const stats = useMemo(() => studentStats(filtered), [filtered]);

  const courses = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) map.set(r.course.id, r.course.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  return (
    <section className="form-section" style={{ marginTop: 16 }}>
      <h4
        className="form-section__title"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <CalendarIcon size={16} /> Asistencia (últimos 30 días)
      </h4>

      <div
        className="summary-grid"
        style={{
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          marginBottom: 12,
        }}
      >
        <div className="summary-card">
          <p
            className="summary-card__label"
            title="% calculado sobre sesiones donde se esperaba asistencia (excluye justificadas)."
          >
            % asistencia
          </p>
          <div className="summary-card__value">
            {stats.percent === null ? '—' : `${stats.percent}%`}
          </div>
        </div>
        <div className="summary-card">
          <p className="summary-card__label">Sesiones</p>
          <div className="summary-card__value">{filtered.length}</div>
        </div>
      </div>

      {courses.length > 1 && (
        <div className="field">
          <label className="field__label" htmlFor="att-course">
            Filtrar por curso
          </label>
          <select
            id="att-course"
            className="select"
            value={courseFilter}
            onChange={(e) =>
              setCourseFilter(
                e.target.value === 'all' ? 'all' : Number(e.target.value),
              )
            }
          >
            <option value="all">Todos los cursos</option>
            {courses.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      ) : sorted.length === 0 ? (
        <p
          className="empty-state__title"
          style={{ fontSize: 14, margin: '8px 0' }}
        >
          Sin registros de asistencia en este rango.
        </p>
      ) : (
        <div className="session-list">
          {sorted.map((r) => (
            <div
              className="session-row"
              key={`${r.scheduled_datetime}|${r.course_id}`}
            >
              <div className="session-row__when">
                <span className="session-row__when-date">
                  {formatSessionDay(r.scheduled_datetime)}
                </span>
                <span className="session-row__when-time">
                  · {formatSessionTime(r.scheduled_datetime)} · {r.course.name}
                </span>
              </div>
              <div className="session-row__status session-row__status--taken">
                {labelAttendanceStatus(r.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
