import type { CourseRecurrence, ScheduleCreate, ScheduleDay } from '../types';
import { PlusIcon, TrashIcon } from '../brand';

const DAY_OPTIONS: { value: ScheduleDay; label: string }[] = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
];

function normalizeTime(s: string): string {
  if (!s) return s;
  return s.length === 5 ? `${s}:00` : s;
}

function formatDate(value: string | null): string {
  if (!value) return 'Elige una fecha de inicio arriba';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

interface ScheduleRepeaterProps {
  recurrence: CourseRecurrence;
  value: ScheduleCreate[];
  onChange: (next: ScheduleCreate[]) => void;
  startDate: string | null;
  error?: string | null;
}

export default function ScheduleRepeater({
  recurrence,
  value,
  onChange,
  startDate,
  error,
}: ScheduleRepeaterProps) {
  const updateRow = (idx: number, patch: Partial<ScheduleCreate>) => {
    onChange(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onChange([...value, { schedule_day: 'monday', schedule_time: '18:00' }]);
  };

  if (recurrence === 'one_time') {
    const row = value[0] ?? { schedule_day: 'monday', schedule_time: '18:00' };
    return (
      <div className="repeater">
        <div className="repeater__row repeater__row--schedule">
          <div className="field">
            <label className="field__label">Fecha</label>
            <div
              className="input"
              style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}
              aria-readonly="true"
            >
              {formatDate(startDate)}
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sched-time-single">
              Hora
            </label>
            <input
              id="sched-time-single"
              type="time"
              className="input"
              value={row.schedule_time.slice(0, 5)}
              onChange={(e) =>
                onChange([
                  {
                    schedule_day: row.schedule_day,
                    schedule_time: normalizeTime(e.target.value),
                  },
                ])
              }
            />
          </div>
        </div>
        {error && <div className="field__error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="repeater">
      {value.length === 0 && (
        <p className="repeater__empty">Sin horarios. Agrega al menos uno.</p>
      )}
      {value.map((row, idx) => (
        <div key={idx} className="repeater__row repeater__row--schedule">
          <div className="field">
            <label className="field__label" htmlFor={`sched-day-${idx}`}>
              Día
            </label>
            <select
              id={`sched-day-${idx}`}
              className="select"
              value={row.schedule_day}
              onChange={(e) =>
                updateRow(idx, { schedule_day: e.target.value as ScheduleDay })
              }
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`sched-time-${idx}`}>
              Hora
            </label>
            <input
              id={`sched-time-${idx}`}
              type="time"
              className="input"
              value={row.schedule_time.slice(0, 5)}
              onChange={(e) =>
                updateRow(idx, { schedule_time: normalizeTime(e.target.value) })
              }
            />
          </div>
          <button
            type="button"
            className="repeater__delete"
            onClick={() => removeRow(idx)}
            aria-label="Eliminar horario"
            title="Eliminar horario"
          >
            <TrashIcon size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="repeater__add-btn" onClick={addRow}>
        <PlusIcon size={14} />
        Agregar horario
      </button>
      {error && <div className="field__error">{error}</div>}
    </div>
  );
}
