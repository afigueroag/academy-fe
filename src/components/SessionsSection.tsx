import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AttendanceRead, CourseRead } from '../types';
import { ApiError, listAttendance } from '../api';
import { CalendarIcon, PencilIcon, SpinnerIcon } from '../brand';
import {
  attendanceOpensAt,
  countStudentsAndPresent,
  enumerateSessions,
  formatSessionDay,
  formatSessionTime,
  groupByDatetime,
  isInAttendanceWindow,
  isValidScheduledDatetime,
  normalizeDatetimeKey,
  parseScheduledDatetime,
} from '../utils/sessions';

type SessionTab = 'past' | 'all';

const TABS: { value: SessionTab; label: string }[] = [
  { value: 'past', label: 'Últimas 30 días' },
  { value: 'all', label: 'Todas' },
];

const PAST_DAYS = 30;
const ALL_CAP = 200;

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLong(value: string): string {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDayDelta(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function rangeForTab(
  tab: SessionTab,
  course: CourseRead,
): { from: Date; to: Date } | null {
  const todayEnd = endOfToday();

  if (tab === 'past') {
    const from = startOfDayDelta(-PAST_DAYS);
    return { from, to: todayEnd };
  }
  if (!course.start_date) return null;
  const from = new Date(`${course.start_date}T00:00:00`);
  if (Number.isNaN(from.getTime())) return null;
  const courseEnd = course.end_date
    ? new Date(`${course.end_date}T00:00:00`)
    : null;
  const to =
    courseEnd && !Number.isNaN(courseEnd.getTime()) && courseEnd < todayEnd
      ? courseEnd
      : todayEnd;
  if (to < from) return null;
  return { from, to };
}

interface SessionRow {
  scheduled_datetime: string;
  rows: AttendanceRead[];
}

interface SessionsSectionProps {
  course: CourseRead;
  refreshKey?: number;
  onOpenAttendance?: (datetime: string) => void;
}

export default function SessionsSection({
  course,
  refreshKey,
  onOpenAttendance,
}: SessionsSectionProps) {
  const [tab, setTab] = useState<SessionTab>('past');
  const [rows, setRows] = useState<AttendanceRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => rangeForTab(tab, course), [tab, course]);

  const fetchRows = useCallback(async () => {
    if (!range) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listAttendance({
        course_id: course.id,
        from_date: toIsoDate(range.from),
        to_date: toIsoDate(range.to),
        limit: 1000,
      });
      setRows(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las sesiones.';
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [course.id, range]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshKey]);

  const grouped = useMemo(() => groupByDatetime(rows), [rows]);
  const todayEnd = useMemo(() => endOfToday(), [tab, rows]);

  const sessions = useMemo<SessionRow[]>(() => {
    if (!range) return [];
    const candidates = enumerateSessions(course, range.from, range.to);
    const map = new Map<string, SessionRow>();
    for (const c of candidates) {
      const key = normalizeDatetimeKey(c.scheduled_datetime);
      map.set(key, {
        scheduled_datetime: c.scheduled_datetime,
        rows: grouped.get(key) ?? [],
      });
    }
    for (const [key, list] of grouped.entries()) {
      if (!map.has(key) && list.length > 0) {
        map.set(key, {
          scheduled_datetime: list[0].scheduled_datetime,
          rows: list,
        });
      }
    }
    const arr: SessionRow[] = [];
    for (const s of map.values()) {
      if (!isValidScheduledDatetime(s.scheduled_datetime)) continue;
      const dt = parseScheduledDatetime(s.scheduled_datetime);
      if (dt > todayEnd) continue;
      arr.push(s);
    }
    arr.sort((a, b) =>
      b.scheduled_datetime.localeCompare(a.scheduled_datetime),
    );
    return arr;
  }, [course, range, grouped, todayEnd]);

  const capped = tab === 'all' && sessions.length > ALL_CAP;
  const visible = capped ? sessions.slice(0, ALL_CAP) : sessions;

  const emptyMessage = useMemo(() => {
    if (course.schedules.length === 0) {
      return 'Este curso no tiene horarios definidos. Edítalo para agregar al menos uno.';
    }
    if (course.recurrence === 'one_time' && !course.start_date) {
      return 'Este curso de sesión única no tiene fecha de inicio. Edítalo para definirla.';
    }
    if (range && course.start_date) {
      const sd = new Date(`${course.start_date}T00:00:00`);
      if (!Number.isNaN(sd.getTime()) && sd > range.to) {
        return `El curso aún no comienza (inicia el ${formatDateLong(course.start_date)}).`;
      }
    }
    if (tab === 'past') {
      return 'Sin sesiones en los últimos 30 días.';
    }
    return 'Este curso no tiene sesiones registradas.';
  }, [course.schedules.length, course.recurrence, course.start_date, range, tab]);

  return (
    <section className="form-section">
      <h3
        className="form-section__title"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <CalendarIcon size={16} /> Sesiones
      </h3>

      <div className="tab-group" role="tablist" style={{ marginBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={
              'tab-group__item' +
              (tab === t.value ? ' tab-group__item--active' : '')
            }
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {capped && (
        <p
          className="attendance-row__hint"
          style={{ marginTop: 0, marginBottom: 8 }}
        >
          Mostrando las primeras {ALL_CAP} sesiones.
        </p>
      )}

      {loading ? (
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      ) : !range ? (
        <p
          className="empty-state__title"
          style={{ fontSize: 14, margin: '8px 0' }}
        >
          Define la fecha de inicio del curso para ver sus sesiones.
        </p>
      ) : visible.length === 0 ? (
        <p
          className="empty-state__title"
          style={{ fontSize: 14, margin: '8px 0' }}
        >
          {emptyMessage}
        </p>
      ) : (
        <div className="session-list">
          {visible.map((s) => {
            const taken = s.rows.length > 0;
            const { students, present } = countStudentsAndPresent(s.rows);
            const inWindow = isInAttendanceWindow(s.scheduled_datetime);
            const opensAt = attendanceOpensAt(s.scheduled_datetime);
            const opensLabel = `${String(opensAt.getHours()).padStart(2, '0')}:${String(opensAt.getMinutes()).padStart(2, '0')}`;
            const canOpen = !!onOpenAttendance && (taken || inWindow);
            return (
              <div className="session-row" key={s.scheduled_datetime}>
                <div className="session-row__when">
                  <span className="session-row__when-date">
                    {formatSessionDay(s.scheduled_datetime)}
                  </span>
                  <span className="session-row__when-time">
                    · {formatSessionTime(s.scheduled_datetime)}
                  </span>
                </div>
                <div
                  className={
                    'session-row__status' +
                    (taken ? ' session-row__status--taken' : '')
                  }
                >
                  {taken
                    ? `Tomada · ${present}/${students}`
                    : inWindow
                      ? 'Sin tomar'
                      : `Disponible desde ${opensLabel}`}
                </div>
                <button
                  type="button"
                  className={taken ? 'btn btn--ghost' : 'btn btn--primary'}
                  onClick={() => onOpenAttendance?.(s.scheduled_datetime)}
                  disabled={!canOpen}
                  title={
                    !taken && !inWindow
                      ? `Aún no puedes registrar esta sesión. Disponible desde ${opensLabel}.`
                      : undefined
                  }
                >
                  {taken ? (
                    <>
                      <PencilIcon size={14} /> Editar
                    </>
                  ) : (
                    'Tomar'
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
