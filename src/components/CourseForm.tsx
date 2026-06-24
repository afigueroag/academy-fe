import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CourseCreate,
  CourseInstructorLinkCreate,
  CourseRead,
  CourseRecurrence,
  CourseStatus,
  CourseUpdate,
  GroupRead,
  ScheduleCreate,
  ScheduleDay,
} from '../types';
import { ApiError } from '../api';
import { SpinnerIcon, WarningIcon } from '../brand';
import { fromCents, toCents } from '../utils/money';
import { findFormConflicts } from '../utils/conflicts';
import ScheduleRepeater from './ScheduleRepeater';
import GroupPicker from './GroupPicker';
import InstructorChecklist, {
  type InstructorRow,
} from './InstructorChecklist';

const DAY_FROM_DATE: ScheduleDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function dayFromDate(date: string): ScheduleDay {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'monday';
  return DAY_FROM_DATE[d.getDay()] ?? 'monday';
}

const nullable = (s: string): string | null => {
  const t = s.trim();
  return t === '' ? null : t;
};

interface FormState {
  name: string;
  description: string;
  location: string;
  recurrence: CourseRecurrence;
  duration_minutes: string;
  start_date: string;
  end_date: string;
  max_students: string;
  individual_cost: string;
  schedules: ScheduleCreate[];
  instructors: InstructorRow[];
  groups: GroupRead[];
  status: CourseStatus;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  location: '',
  recurrence: 'weekly',
  duration_minutes: '60',
  start_date: '',
  end_date: '',
  max_students: '',
  individual_cost: '',
  schedules: [],
  instructors: [],
  groups: [],
  status: 'active',
};

function fromCourse(c: CourseRead): FormState {
  return {
    name: c.name,
    description: c.description ?? '',
    location: c.location ?? '',
    recurrence: c.recurrence ?? 'weekly',
    duration_minutes: String(c.duration_minutes ?? ''),
    start_date: c.start_date ?? '',
    end_date: c.end_date ?? '',
    max_students: c.max_students !== null ? String(c.max_students) : '',
    individual_cost:
      c.individual_cost !== null ? String(fromCents(c.individual_cost)) : '',
    schedules: c.schedules.map((s) => ({ ...s })),
    instructors: c.instructor_links.map((link) => ({
      instructor_id: link.instructor_id,
      instructor_name: `${link.instructor.first_name} ${link.instructor.last_name}`,
      type: link.type,
      hourly_rate:
        link.hourly_rate !== null ? String(fromCents(link.hourly_rate)) : '',
      userEditedRate: true,
    })),
    groups: c.groups,
    status: c.status ?? 'active',
  };
}

interface CreateProps {
  mode: 'create';
  onSubmit: (payload: CourseCreate) => Promise<void>;
}

interface EditProps {
  mode: 'edit';
  course: CourseRead;
  onSubmit: (payload: CourseUpdate) => Promise<void>;
}

type CourseFormProps = (CreateProps | EditProps) & {
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
  defaultInstructorRate: number | null;
  defaultAssistantRate: number | null;
  currency: string | null;
  allCourses: CourseRead[];
};

export default function CourseForm(props: CourseFormProps) {
  const {
    mode,
    onCancel,
    submitting,
    serverError,
    apiError,
    defaultInstructorRate,
    defaultAssistantRate,
    currency,
    allCourses,
  } = props;

  const currentCourseId = mode === 'edit' ? props.course.id : null;

  const [state, setState] = useState<FormState>(() =>
    mode === 'edit' ? fromCourse(props.course) : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit') setState(fromCourse(props.course));
  }, [mode, mode === 'edit' ? props.course : null]);

  useEffect(() => {
    if (apiError?.fieldErrors) {
      setErrors((prev) => ({ ...prev, ...apiError.fieldErrors }));
    }
  }, [apiError]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setState((s) => ({ ...s, [k]: v }));
    if (errors[k as string]) {
      setErrors((er) => {
        const next = { ...er };
        delete next[k as string];
        return next;
      });
    }
  };

  const symbolPrefix = useMemo(
    () => (currency ?? 'USD').toUpperCase(),
    [currency],
  );

  const conflicts = useMemo(() => {
    const durationMin = parseInt(state.duration_minutes, 10);
    if (Number.isNaN(durationMin) || durationMin <= 0) return [];
    return findFormConflicts({
      schedules: state.schedules,
      durationMin,
      location: state.location,
      instructors: state.instructors
        .filter((r) => r.instructor_id !== null)
        .map((r) => ({
          id: r.instructor_id as number,
          name: r.instructor_name,
        })),
      currentCourseId,
      allCourses,
    });
  }, [
    state.schedules,
    state.duration_minutes,
    state.location,
    state.instructors,
    currentCourseId,
    allCourses,
  ]);

  const hasConflicts = conflicts.length > 0;

  const handleReview = () => {
    const first = conflicts[0];
    if (!first) return;
    const el = document.querySelector(
      `[data-conflict-anchor="${first.category}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLButtonElement
    ) {
      el.focus();
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!state.name.trim()) next.name = 'Requerido';
    const dur = parseInt(state.duration_minutes, 10);
    if (!state.duration_minutes.trim() || Number.isNaN(dur) || dur <= 0) {
      next.duration_minutes = 'Ingresa una duración válida en minutos';
    }
    if (state.recurrence === 'weekly' && state.schedules.length === 0) {
      next.schedules = 'Agrega al menos un horario';
    }
    if (state.recurrence === 'one_time' && !state.start_date.trim()) {
      next.start_date = 'Requerido para sesión única';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    let schedules: ScheduleCreate[] = state.schedules;
    if (state.recurrence === 'one_time') {
      const time = state.schedules[0]?.schedule_time ?? '18:00:00';
      schedules = [
        {
          schedule_day: state.start_date
            ? dayFromDate(state.start_date)
            : (state.schedules[0]?.schedule_day ?? 'monday'),
          schedule_time: time.length === 5 ? `${time}:00` : time,
        },
      ];
    }

    const instructor_links: CourseInstructorLinkCreate[] = state.instructors
      .filter((row) => row.instructor_id !== null)
      .map((row) => ({
        instructor_id: row.instructor_id as number,
        type: row.type,
        hourly_rate: toCents(row.hourly_rate),
      }));

    const base = {
      name: state.name.trim(),
      description: nullable(state.description),
      recurrence: state.recurrence,
      duration_minutes: parseInt(state.duration_minutes, 10),
      max_students:
        state.max_students.trim() === ''
          ? null
          : parseInt(state.max_students, 10),
      individual_cost: toCents(state.individual_cost),
      location: nullable(state.location),
      start_date: nullable(state.start_date),
      end_date: nullable(state.end_date),
      schedules,
      instructor_links,
      // Mapea la forma de lectura (GroupRead, con `category`) a la de escritura
      // (Group, con academy_id) que esperan CourseCreate/CourseUpdate.
      groups: state.groups.map((g) => ({
        id: g.id,
        name: g.name,
        category_id: g.category_id,
        rank: g.rank,
        academy_id: g.academy_id ?? null,
      })),
    };

    if (mode === 'create') {
      const payload: CourseCreate = { ...base, status: 'active' };
      await props.onSubmit(payload);
    } else {
      const payload: CourseUpdate = { ...base, status: state.status };
      await props.onSubmit(payload);
    }
  };

  return (
    <form id="course-form" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert" role="alert">
          {serverError}
        </div>
      )}

      {hasConflicts && (
        <div className="alert alert--warning" role="status">
          <div className="alert__head">
            <WarningIcon size={14} />
            {conflicts.length === 1
              ? 'Se detectó un conflicto:'
              : `Se detectaron ${conflicts.length} conflictos:`}
          </div>
          <ul className="alert__list">
            {conflicts.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="form-section">
        <h3 className="form-section__title">Información general</h3>

        <div className="field">
          <label className="field__label" htmlFor="cf-name">
            Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="cf-name"
            className="input"
            value={state.name}
            onChange={(e) => set('name', e.target.value)}
            aria-invalid={!!errors.name}
            autoFocus
          />
          <span className="field__error">{errors.name ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="cf-desc">
            Descripción
          </label>
          <textarea
            id="cf-desc"
            className="textarea"
            value={state.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Notas sobre la clase, nivel, requisitos…"
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="cf-location">
            Ubicación
          </label>
          <input
            id="cf-location"
            className="input"
            value={state.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Salón, dirección, sala…"
            data-conflict-anchor="location"
          />
        </div>

        <div className="field">
          <span className="field__label">Recurrencia</span>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input
                type="radio"
                name="recurrence"
                value="weekly"
                checked={state.recurrence === 'weekly'}
                onChange={() => set('recurrence', 'weekly')}
              />
              Semanal
            </label>
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <input
                type="radio"
                name="recurrence"
                value="one_time"
                checked={state.recurrence === 'one_time'}
                onChange={() => {
                  set('recurrence', 'one_time');
                  if (state.schedules.length === 0) {
                    set('schedules', [
                      { schedule_day: 'monday', schedule_time: '18:00:00' },
                    ]);
                  } else if (state.schedules.length > 1) {
                    set('schedules', [state.schedules[0]]);
                  }
                }}
              />
              Sesión única
            </label>
          </div>
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Programación</h3>

        <div className="field--row">
          <div className="field">
            <label className="field__label" htmlFor="cf-duration">
              Duración <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <div className="input-affix" aria-invalid={!!errors.duration_minutes}>
              <input
                id="cf-duration"
                type="number"
                min="1"
                step="1"
                className="input"
                value={state.duration_minutes}
                onChange={(e) => set('duration_minutes', e.target.value)}
              />
              <span className="input-affix__suffix">minutos</span>
            </div>
            <span className="field__error">{errors.duration_minutes ?? ''}</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="cf-start">
              Fecha de inicio
              {state.recurrence === 'one_time' && (
                <span style={{ color: 'var(--color-danger)' }}> *</span>
              )}
            </label>
            <input
              id="cf-start"
              type="date"
              className="input"
              value={state.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              placeholder="Elige una fecha"
              aria-invalid={!!errors.start_date}
            />
            <span className="field__error">{errors.start_date ?? ''}</span>
          </div>
        </div>

        {state.recurrence === 'weekly' && (
          <div className="field">
            <label className="field__label" htmlFor="cf-end">
              Fecha de fin
            </label>
            <input
              id="cf-end"
              type="date"
              className="input"
              value={state.end_date}
              onChange={(e) => set('end_date', e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <span className="field__label">
            Horarios
            {state.recurrence === 'weekly' && (
              <span style={{ color: 'var(--color-danger)' }}> *</span>
            )}
          </span>
          <ScheduleRepeater
            recurrence={state.recurrence}
            value={state.schedules}
            onChange={(next) => set('schedules', next)}
            startDate={nullable(state.start_date)}
            error={errors.schedules ?? null}
          />
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Capacidad y costo</h3>

        <div className="field--row">
          <div className="field">
            <label className="field__label" htmlFor="cf-max">
              Cupo máximo
            </label>
            <input
              id="cf-max"
              type="number"
              min="1"
              step="1"
              className="input"
              value={state.max_students}
              onChange={(e) => set('max_students', e.target.value)}
            />
            <span className="field__hint">Dejar vacío para cupo ilimitado</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="cf-cost">
              Costo individual
            </label>
            <div className="input-affix">
              <span className="input-affix__prefix">{symbolPrefix}</span>
              <input
                id="cf-cost"
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={state.individual_cost}
                onChange={(e) => set('individual_cost', e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="form-section" data-conflict-anchor="instructor">
        <h3 className="form-section__title">Instructores</h3>
        <InstructorChecklist
          value={state.instructors}
          onChange={(next) => set('instructors', next)}
          defaultInstructorRate={defaultInstructorRate}
          defaultAssistantRate={defaultAssistantRate}
          currency={currency}
        />
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Grupos</h3>
        <div className="field">
          <span className="field__hint">
            Restringe quién puede inscribir esta clase. Sin grupos, la clase
            queda abierta para todos.
          </span>
          <GroupPicker
            value={state.groups}
            onChange={(next) => set('groups', next)}
          />
        </div>
      </section>

      {mode === 'edit' && (
        <section className="form-section">
          <h3 className="form-section__title">Estado</h3>
          <div className="field">
            <label className="field__label" htmlFor="cf-status">
              Estado de la clase
            </label>
            <select
              id="cf-status"
              className="select"
              value={state.status}
              onChange={(e) => set('status', e.target.value as CourseStatus)}
            >
              <option value="active">Activa</option>
              <option value="draft">Borrador</option>
              <option value="archived">Archivada</option>
            </select>
          </div>
        </section>
      )}

      <div className="form-actions form-actions--end" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
        {hasConflicts && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleReview}
            disabled={submitting}
          >
            Revisar
          </button>
        )}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting && <SpinnerIcon />}
          {(() => {
            if (mode === 'create') {
              return hasConflicts ? 'Crear de todas formas' : 'Crear clase';
            }
            return hasConflicts
              ? 'Guardar de todas formas'
              : 'Guardar cambios';
          })()}
        </button>
      </div>
    </form>
  );
}
