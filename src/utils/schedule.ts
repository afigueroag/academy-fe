import type { ScheduleDay } from '../types';

const DAY_SHORT: Record<ScheduleDay, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

const DAY_ORDER: ScheduleDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

interface ScheduleLike {
  schedule_day: ScheduleDay;
  schedule_time: string;
}

function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const total = (h * 60 + m + minutes) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Resumen compacto de horarios: agrupa días por hora de inicio.
 * Ej. "Lun/Mié 18:00–19:30 · Vie 10:00–11:00".
 */
export function formatScheduleSummary(
  schedules: ScheduleLike[],
  durationMinutes?: number,
): string {
  if (!schedules.length) return 'Sin horarios';

  const byTime = new Map<string, ScheduleDay[]>();
  for (const s of schedules) {
    const time = s.schedule_time.slice(0, 5);
    const list = byTime.get(time) ?? [];
    list.push(s.schedule_day);
    byTime.set(time, list);
  }

  return [...byTime.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, days]) => {
      const daysLabel = days
        .slice()
        .sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
        .map((d) => DAY_SHORT[d])
        .join('/');
      const end =
        durationMinutes && durationMinutes > 0
          ? `–${addMinutes(time, durationMinutes)}`
          : '';
      return `${daysLabel} ${time}${end}`;
    })
    .join(' · ');
}
