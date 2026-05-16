import type { CourseRead, ScheduleDay } from '../types';

export const CALENDAR_DEFAULT_START_HOUR = 8;
export const CALENDAR_DEFAULT_END_HOUR = 18;
export const HOUR_PX = 50;

export function computeHourRange(events: CalendarEvent[]): {
  startHour: number;
  endHour: number;
} {
  if (events.length === 0) {
    return {
      startHour: CALENDAR_DEFAULT_START_HOUR,
      endHour: CALENDAR_DEFAULT_END_HOUR,
    };
  }
  let minStart = Infinity;
  let maxEnd = -Infinity;
  for (const e of events) {
    if (e.startMin < minStart) minStart = e.startMin;
    const end = e.startMin + e.durationMin;
    if (end > maxEnd) maxEnd = end;
  }
  const startHour = Math.max(0, Math.floor(minStart / 60) - 1);
  const endHour = Math.min(24, Math.ceil(maxEnd / 60) + 1);
  return { startHour, endHour };
}

export const DAY_ORDER: ScheduleDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_FULL_LABEL: Record<ScheduleDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export const DAY_SHORT_LABEL: Record<ScheduleDay, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const JS_DAY_TO_SCHEDULE: ScheduleDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

export function dayFromDate(date: Date): ScheduleDay {
  return JS_DAY_TO_SCHEDULE[date.getDay()];
}

export function parseTimeMinutes(time: string): number {
  const [h = '0', m = '0'] = time.split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

export function formatTime(t: string): string {
  return t.slice(0, 5);
}

export function formatWeekRange(monday: Date, sunday: Date): string {
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  if (sameMonth && sameYear) {
    const monthName = monday.toLocaleDateString('es-MX', { month: 'long' });
    return `Semana del ${monday.getDate()} al ${sunday.getDate()} de ${monthName} de ${monday.getFullYear()}`;
  }
  if (sameYear) {
    const m1 = monday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    const m2 = sunday.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    return `Semana del ${m1} al ${m2} de ${monday.getFullYear()}`;
  }
  const m1 = monday.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const m2 = sunday.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `Semana del ${m1} al ${m2}`;
}

export function formatTodayHeading(date: Date): string {
  const long = date.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `Hoy — ${long}`;
}

export interface CalendarEvent {
  course: CourseRead;
  scheduleIndex: number;
  scheduleDay: ScheduleDay;
  startMin: number;
  durationMin: number;
}

export function buildWeekEvents(
  courses: CourseRead[],
  monday: Date,
): CalendarEvent[] {
  const weekEnd = addDays(monday, 6);
  weekEnd.setHours(23, 59, 59, 999);
  const events: CalendarEvent[] = [];
  for (const c of courses) {
    if (c.recurrence === 'one_time') {
      if (!c.start_date) continue;
      const d = parseDate(c.start_date);
      if (d < monday || d > weekEnd) continue;
      const day = dayFromDate(d);
      const sched = c.schedules[0];
      if (!sched) continue;
      events.push({
        course: c,
        scheduleIndex: 0,
        scheduleDay: day,
        startMin: parseTimeMinutes(sched.schedule_time),
        durationMin: c.duration_minutes,
      });
    } else {
      c.schedules.forEach((s, i) => {
        events.push({
          course: c,
          scheduleIndex: i,
          scheduleDay: s.schedule_day,
          startMin: parseTimeMinutes(s.schedule_time),
          durationMin: c.duration_minutes,
        });
      });
    }
  }
  return events;
}

export function groupEventsByDay(
  events: CalendarEvent[],
): Record<ScheduleDay, CalendarEvent[]> {
  const map: Record<ScheduleDay, CalendarEvent[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
  for (const e of events) map[e.scheduleDay].push(e);
  for (const day of DAY_ORDER) {
    map[day].sort((a, b) => a.startMin - b.startMin);
  }
  return map;
}

export interface PositionedEvent extends CalendarEvent {
  topPx: number;
  heightPx: number;
  col: number;
  totalCols: number;
}

export function layoutDayEvents(
  events: CalendarEvent[],
  startHour: number = CALENDAR_DEFAULT_START_HOUR,
): PositionedEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin);

  const colAssignments: number[] = [];
  const active: { endMin: number; col: number }[] = [];
  for (const e of sorted) {
    for (let j = active.length - 1; j >= 0; j--) {
      if (active[j].endMin <= e.startMin) active.splice(j, 1);
    }
    const used = new Set(active.map((a) => a.col));
    let col = 0;
    while (used.has(col)) col++;
    colAssignments.push(col);
    active.push({ endMin: e.startMin + e.durationMin, col });
  }

  const adj: number[][] = sorted.map(() => []);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].startMin < sorted[i].startMin + sorted[i].durationMin) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }
  const visited = new Array(sorted.length).fill(false);
  const clusterCols = new Array(sorted.length).fill(1);
  for (let i = 0; i < sorted.length; i++) {
    if (visited[i]) continue;
    const cluster: number[] = [];
    const queue = [i];
    visited[i] = true;
    while (queue.length) {
      const k = queue.shift() as number;
      cluster.push(k);
      for (const n of adj[k]) {
        if (!visited[n]) {
          visited[n] = true;
          queue.push(n);
        }
      }
    }
    const maxCol = Math.max(...cluster.map((k) => colAssignments[k]));
    for (const k of cluster) clusterCols[k] = maxCol + 1;
  }

  return sorted.map((e, i) => ({
    ...e,
    topPx: ((e.startMin - startHour * 60) / 60) * HOUR_PX,
    heightPx: Math.max(20, (e.durationMin / 60) * HOUR_PX),
    col: colAssignments[i],
    totalCols: clusterCols[i],
  }));
}
