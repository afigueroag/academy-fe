import type {
  AttendanceRead,
  CourseRead,
  ScheduleCreate,
  ScheduleDay,
} from '../types';

const DAY_BY_INDEX: ScheduleDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function dayOfWeek(date: Date): ScheduleDay {
  return DAY_BY_INDEX[date.getDay()];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function normalizeTime(time: string): string {
  const parts = time.split(':');
  const h = parts[0] ?? '00';
  const m = parts[1] ?? '00';
  const s = parts[2] ?? '00';
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}`;
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function buildScheduledDatetime(date: string, time: string): string {
  return `${date}T${normalizeTime(time)}`;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function parseScheduledDatetime(value: string): Date {
  return new Date(value);
}

export interface SessionCandidate {
  course_id: number;
  scheduled_datetime: string;
  schedule: ScheduleCreate;
}

export function enumerateSessions(
  course: CourseRead,
  from: Date,
  to: Date,
): SessionCandidate[] {
  if (course.schedules.length === 0) return [];

  const start = course.start_date ? parseDateOnly(course.start_date) : null;
  const end = course.end_date ? parseDateOnly(course.end_date) : null;

  const rangeStart = new Date(from);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(to);
  rangeEnd.setHours(23, 59, 59, 999);

  if (course.recurrence === 'one_time') {
    if (!start) return [];
    if (start < rangeStart || start > rangeEnd) return [];
    const schedule = course.schedules[0];
    return [
      {
        course_id: course.id,
        scheduled_datetime: buildScheduledDatetime(
          course.start_date as string,
          schedule.schedule_time,
        ),
        schedule,
      },
    ];
  }

  const schedulesByDay = new Map<ScheduleDay, ScheduleCreate[]>();
  for (const s of course.schedules) {
    const list = schedulesByDay.get(s.schedule_day) ?? [];
    list.push(s);
    schedulesByDay.set(s.schedule_day, list);
  }

  const results: SessionCandidate[] = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    if ((!start || cursor >= start) && (!end || cursor <= end)) {
      const matches = schedulesByDay.get(dayOfWeek(cursor));
      if (matches) {
        const dateStr = formatLocalDate(cursor);
        for (const schedule of matches) {
          const scheduled_datetime = buildScheduledDatetime(
            dateStr,
            schedule.schedule_time,
          );
          if (!isValidScheduledDatetime(scheduled_datetime)) {
            console.warn(
              '[sessions] candidata descartada por datetime inválido. dateStr=',
              dateStr,
              'schedule_time=',
              schedule.schedule_time,
              'resultado=',
              scheduled_datetime,
            );
            continue;
          }
          results.push({
            course_id: course.id,
            scheduled_datetime,
            schedule,
          });
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  results.sort((a, b) =>
    a.scheduled_datetime.localeCompare(b.scheduled_datetime),
  );
  return results;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

export function isInAttendanceWindow(
  scheduledDatetime: string,
  now: Date = new Date(),
): boolean {
  const dt = parseScheduledDatetime(scheduledDatetime);
  return now.getTime() >= dt.getTime() - ONE_HOUR_MS;
}

export function attendanceOpensAt(scheduledDatetime: string): Date {
  const dt = parseScheduledDatetime(scheduledDatetime);
  return new Date(dt.getTime() - ONE_HOUR_MS);
}

const DAY_LABEL_SHORT: Record<ScheduleDay, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const DAY_LABEL_LONG: Record<ScheduleDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

function formatDatePart(d: Date, opts: 'short' | 'long'): string {
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: opts,
    year: 'numeric',
  });
}

export function isValidScheduledDatetime(value: string): boolean {
  const d = parseScheduledDatetime(value);
  return !Number.isNaN(d.getTime());
}

export function formatSessionDay(
  scheduledDatetime: string,
  variant: 'short' | 'long' = 'short',
): string {
  const dt = parseScheduledDatetime(scheduledDatetime);
  if (Number.isNaN(dt.getTime())) {
    console.warn('[sessions] scheduled_datetime inválido:', scheduledDatetime);
    return scheduledDatetime;
  }
  const day = DAY_BY_INDEX[dt.getDay()];
  const dayLabel =
    variant === 'short' ? DAY_LABEL_SHORT[day] : DAY_LABEL_LONG[day];
  return `${dayLabel} ${formatDatePart(dt, variant === 'short' ? 'short' : 'long')}`;
}

export function formatSessionTime(scheduledDatetime: string): string {
  const dt = parseScheduledDatetime(scheduledDatetime);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export function formatSessionCompact(scheduledDatetime: string): string {
  const dt = parseScheduledDatetime(scheduledDatetime);
  if (Number.isNaN(dt.getTime())) return scheduledDatetime;
  const day = DAY_BY_INDEX[dt.getDay()];
  const dayLabel = DAY_LABEL_SHORT[day];
  const datePart = dt.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  });
  return `${dayLabel} ${datePart} · ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export function formatTimeFromString(time: string): string {
  return time.slice(0, 5);
}

export interface StudentAttendanceStats {
  present: number;
  total: number;
  percent: number | null;
}

export function studentStats(rows: AttendanceRead[]): StudentAttendanceStats {
  let present = 0;
  let total = 0;
  for (const r of rows) {
    if (r.attendance_role !== 'student') continue;
    if (r.status === 'excused') continue;
    total += 1;
    if (r.status === 'present') present += 1;
  }
  return {
    present,
    total,
    percent: total === 0 ? null : Math.round((present / total) * 100),
  };
}

export function normalizeDatetimeKey(value: string): string {
  return value.slice(0, 19);
}

export function groupByDatetime(
  rows: AttendanceRead[],
): Map<string, AttendanceRead[]> {
  const map = new Map<string, AttendanceRead[]>();
  for (const r of rows) {
    const key = normalizeDatetimeKey(r.scheduled_datetime);
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return map;
}

export function countStudentsAndPresent(rows: AttendanceRead[]): {
  students: number;
  present: number;
} {
  let students = 0;
  let present = 0;
  for (const r of rows) {
    if (r.attendance_role !== 'student') continue;
    students += 1;
    if (r.status === 'present') present += 1;
  }
  return { students, present };
}
