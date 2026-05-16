import { useEffect, useState } from 'react';
import type { InstructorType, UserRead } from '../types';
import { ApiError, listUsers } from '../api';
import { SpinnerIcon } from '../brand';
import { formatMoney, fromCents } from '../utils/money';

export interface InstructorRow {
  instructor_id: number | null;
  instructor_name: string;
  type: InstructorType;
  hourly_rate: string;
  userEditedRate: boolean;
}

const TYPE_LABEL: Record<InstructorType, string> = {
  instructor: 'Instructor',
  assistant: 'Asistente',
};

function rateForType(
  type: InstructorType,
  defInstr: number | null,
  defAsst: number | null,
): string {
  const cents = type === 'instructor' ? defInstr : defAsst;
  const n = fromCents(cents);
  if (n === null) return '';
  return String(n);
}

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

interface InstructorChecklistProps {
  value: InstructorRow[];
  onChange: (next: InstructorRow[]) => void;
  defaultInstructorRate: number | null;
  defaultAssistantRate: number | null;
  currency: string | null;
}

export default function InstructorChecklist({
  value,
  onChange,
  defaultInstructorRate,
  defaultAssistantRate,
  currency,
}: InstructorChecklistProps) {
  const [instructors, setInstructors] = useState<UserRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listUsers({ role: 'instructor', status: 'active', limit: 200 })
      .then((data) => {
        if (!cancelled) setInstructors(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'No se pudieron cargar los instructores.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const findRow = (id: number) => value.find((r) => r.instructor_id === id);

  const toggle = (instr: UserRead) => {
    if (findRow(instr.id)) {
      onChange(value.filter((r) => r.instructor_id !== instr.id));
    } else {
      onChange([
        ...value,
        {
          instructor_id: instr.id,
          instructor_name: `${instr.first_name} ${instr.last_name}`,
          type: 'instructor',
          hourly_rate: rateForType(
            'instructor',
            defaultInstructorRate,
            defaultAssistantRate,
          ),
          userEditedRate: false,
        },
      ]);
    }
  };

  const updateRow = (id: number, patch: Partial<InstructorRow>) => {
    onChange(
      value.map((r) => (r.instructor_id === id ? { ...r, ...patch } : r)),
    );
  };

  const symbol = (currency ?? 'USD').toUpperCase();

  const term = search.trim().toLowerCase();
  const visible = term
    ? instructors.filter((u) =>
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(term),
      )
    : instructors;

  if (loading) {
    return (
      <div className="loading-row" style={{ padding: 16 }}>
        <SpinnerIcon size={14} /> Cargando instructores…
      </div>
    );
  }
  if (error) {
    return (
      <div className="alert" role="alert">
        {error}
      </div>
    );
  }
  if (instructors.length === 0) {
    return (
      <p className="checklist__empty">
        No hay instructores activos. Invita instructores desde su módulo.
      </p>
    );
  }

  return (
    <div className="checklist">
      <input
        type="search"
        className="input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar instructor"
        aria-label="Buscar instructor"
        style={{ marginBottom: 6 }}
      />
      <div className="checklist__list">
        {visible.length === 0 ? (
          <p className="checklist__empty">Sin coincidencias.</p>
        ) : (
          visible.map((instr) => {
            const row = findRow(instr.id);
            const checked = !!row;
            const defaultCents =
              row?.type === 'assistant'
                ? defaultAssistantRate
                : defaultInstructorRate;
            const hint =
              row && defaultCents !== null && defaultCents !== undefined
                ? row.userEditedRate
                  ? `Tarifa por defecto de ${TYPE_LABEL[row.type].toLowerCase()}: ${formatMoney(defaultCents, currency)}/h.`
                  : `Tarifa por defecto de ${TYPE_LABEL[row.type].toLowerCase()}: ${formatMoney(defaultCents, currency)}/h. Cámbiala si esta clase usa otra.`
                : null;

            return (
              <div
                key={instr.id}
                className={
                  'checklist__item' +
                  (checked ? ' checklist__item--checked' : '')
                }
              >
                <label className="checklist__label">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(instr)}
                  />
                  <span
                    className="avatar-stack__item"
                    style={{ marginLeft: 0 }}
                    aria-hidden="true"
                  >
                    {initials(instr.first_name, instr.last_name)}
                  </span>
                  <span className="checklist__name">
                    {instr.first_name} {instr.last_name}
                  </span>
                </label>

                {checked && row && (
                  <div className="checklist__details">
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label
                        className="field__label"
                        htmlFor={`inst-type-${instr.id}`}
                      >
                        Tipo
                      </label>
                      <select
                        id={`inst-type-${instr.id}`}
                        className="select"
                        value={row.type}
                        onChange={(e) => {
                          const nextType = e.target.value as InstructorType;
                          const patch: Partial<InstructorRow> = {
                            type: nextType,
                          };
                          if (!row.userEditedRate) {
                            patch.hourly_rate = rateForType(
                              nextType,
                              defaultInstructorRate,
                              defaultAssistantRate,
                            );
                          }
                          updateRow(instr.id, patch);
                        }}
                      >
                        <option value="instructor">Instructor</option>
                        <option value="assistant">Asistente</option>
                      </select>
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                      <label
                        className="field__label"
                        htmlFor={`inst-rate-${instr.id}`}
                      >
                        Tarifa por hora
                      </label>
                      <div className="input-affix">
                        <span className="input-affix__prefix">{symbol}</span>
                        <input
                          id={`inst-rate-${instr.id}`}
                          type="number"
                          step="0.01"
                          min="0"
                          className="input"
                          value={row.hourly_rate}
                          placeholder="0.00"
                          onChange={(e) =>
                            updateRow(instr.id, {
                              hourly_rate: e.target.value,
                              userEditedRate: true,
                            })
                          }
                        />
                      </div>
                      {hint && <span className="field__hint">{hint}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
