import { useEffect, useState, type FormEvent } from 'react';
import type {
  RecurringTransactionCreate,
  RecurringTransactionRead,
  RecurringTransactionUpdate,
  TransactionCategory,
  TransactionFrequency,
} from '../types';
import { ApiError } from '../api';
import { SpinnerIcon } from '../brand';
import UserAutocomplete from './UserAutocomplete';
import { fromCents, toCents } from '../utils/money';
import {
  categoriesForKind,
  labelTransactionCategory,
  labelTransactionFrequency,
} from '../utils/salesLabels';

const FREQUENCIES: TransactionFrequency[] = [
  'weekly',
  'monthly',
  'quarterly',
  'semester',
  'annual',
  'one_time',
];

const REQUIRES_BILLING_DAY = new Set<TransactionFrequency>([
  'monthly',
  'quarterly',
  'semester',
  'annual',
]);

const todayIso = () => new Date().toISOString().slice(0, 10);

interface FormState {
  client_type: 'registered' | 'external';
  user_id: number | null;
  user_label: string;
  external_name: string;
  category: TransactionCategory | '';
  description: string;
  frequency: TransactionFrequency;
  amount: string;
  billing_day: string;
  start_date: string;
  end_date: string;
}

export interface RecurringFormDefaults {
  user?: { id: number; first_name: string; last_name: string };
  category?: TransactionCategory;
  frequency?: TransactionFrequency;
  description?: string;
  billing_day?: number;
}

const EMPTY = (defaults?: RecurringFormDefaults): FormState => ({
  client_type: defaults?.user ? 'registered' : 'registered',
  user_id: defaults?.user?.id ?? null,
  user_label: defaults?.user
    ? `${defaults.user.first_name} ${defaults.user.last_name}`
    : '',
  external_name: '',
  category: defaults?.category ?? '',
  description: defaults?.description ?? '',
  frequency: defaults?.frequency ?? 'monthly',
  amount: '',
  billing_day:
    defaults?.billing_day !== undefined ? String(defaults.billing_day) : '1',
  start_date: todayIso(),
  end_date: '',
});

function fromRecurring(r: RecurringTransactionRead): FormState {
  const isRegistered = r.user_id !== null;
  return {
    client_type: isRegistered ? 'registered' : 'external',
    user_id: r.user_id,
    user_label: r.user ? `${r.user.first_name} ${r.user.last_name}` : '',
    external_name: r.external_name ?? '',
    category: r.category,
    description: r.description,
    frequency: r.frequency,
    amount: String(fromCents(r.amount) ?? ''),
    billing_day: r.billing_day !== null ? String(r.billing_day) : '',
    start_date: r.start_date ?? '',
    end_date: r.end_date ?? '',
  };
}

interface BaseProps {
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

interface CreateProps extends BaseProps {
  mode: 'create';
  defaults?: RecurringFormDefaults;
  onSubmit: (payload: RecurringTransactionCreate) => Promise<void>;
}

interface EditProps extends BaseProps {
  mode: 'edit';
  recurring: RecurringTransactionRead;
  onSubmit: (payload: RecurringTransactionUpdate) => Promise<void>;
}

type RecurringFormProps = CreateProps | EditProps;

export default function RecurringForm(props: RecurringFormProps) {
  const { mode, onCancel, submitting, serverError, apiError } = props;

  const [state, setState] = useState<FormState>(() => {
    if (mode === 'edit') return fromRecurring(props.recurring);
    return EMPTY(props.defaults);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit') setState(fromRecurring(props.recurring));
  }, [mode, mode === 'edit' ? props.recurring.id : null]);

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

  const needsBillingDay = REQUIRES_BILLING_DAY.has(state.frequency);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (state.client_type === 'registered' && !state.user_id) {
      next.user_id = 'Selecciona un cliente registrado';
    }
    if (state.client_type === 'external' && !state.external_name.trim()) {
      next.external_name = 'Requerido';
    }
    if (!state.category) next.category = 'Requerido';
    if (!state.description.trim()) next.description = 'Requerido';
    const amt = parseFloat(state.amount);
    if (!state.amount || Number.isNaN(amt) || amt <= 0) {
      next.amount = 'Monto mayor a cero';
    }
    if (needsBillingDay) {
      const bd = parseInt(state.billing_day, 10);
      if (!state.billing_day || Number.isNaN(bd) || bd < 1 || bd > 28) {
        next.billing_day = 'Entre 1 y 28';
      }
    }
    if (state.start_date && state.end_date && state.end_date <= state.start_date) {
      next.end_date = 'Debe ser posterior al inicio';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const amountCents = toCents(state.amount);
    if (amountCents === null) return;

    const payload: RecurringTransactionCreate = {
      kind: 'sale',
      category: state.category as TransactionCategory,
      description: state.description.trim(),
      frequency: state.frequency,
      amount: amountCents,
      user_id: state.client_type === 'registered' ? state.user_id : null,
      external_name:
        state.client_type === 'external' ? state.external_name.trim() : null,
      course_id: mode === 'edit' ? props.recurring.course_id : null,
      billing_day: needsBillingDay
        ? parseInt(state.billing_day, 10) || null
        : null,
      start_date: state.start_date || null,
      end_date: state.end_date || null,
    };

    await props.onSubmit(payload);
  };

  const categories = categoriesForKind('sale');

  return (
    <form id="recurring-form" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert" role="alert">
          {serverError}
        </div>
      )}

      <div className="field">
        <label className="field__label">Cliente</label>
        <div className="tab-group" role="tablist" style={{ marginBottom: 8 }}>
          <button
            type="button"
            role="tab"
            aria-selected={state.client_type === 'registered'}
            className={
              'tab-group__item' +
              (state.client_type === 'registered'
                ? ' tab-group__item--active'
                : '')
            }
            onClick={() => set('client_type', 'registered')}
          >
            Cliente registrado
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={state.client_type === 'external'}
            className={
              'tab-group__item' +
              (state.client_type === 'external'
                ? ' tab-group__item--active'
                : '')
            }
            onClick={() => set('client_type', 'external')}
          >
            Cliente externo
          </button>
        </div>

        {state.client_type === 'registered' ? (
          state.user_id && state.user_label ? (
            <div className="autocomplete-chip">
              <span>{state.user_label}</span>
              <button
                type="button"
                className="autocomplete-chip__clear"
                onClick={() => {
                  set('user_id', null);
                  set('user_label', '');
                }}
                aria-label="Quitar cliente"
              >
                ×
              </button>
            </div>
          ) : (
            <UserAutocomplete
              role="student"
              onSelect={(u) => {
                set('user_id', u.id);
                set('user_label', `${u.first_name} ${u.last_name}`);
              }}
              placeholder="Buscar estudiante por nombre"
            />
          )
        ) : (
          <input
            className="input"
            value={state.external_name}
            onChange={(e) => set('external_name', e.target.value)}
            placeholder="Nombre del cliente externo"
            aria-invalid={!!errors.external_name}
          />
        )}
        <span className="field__error">
          {errors.user_id || errors.external_name || ''}
        </span>
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="rec-category">
            Categoría <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select
            id="rec-category"
            className="select"
            value={state.category}
            onChange={(e) =>
              set('category', e.target.value as TransactionCategory | '')
            }
            aria-invalid={!!errors.category}
          >
            <option value="">— Selecciona —</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {labelTransactionCategory(c)}
              </option>
            ))}
          </select>
          <span className="field__error">{errors.category ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="rec-freq">
            Frecuencia <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select
            id="rec-freq"
            className="select"
            value={state.frequency}
            onChange={(e) =>
              set('frequency', e.target.value as TransactionFrequency)
            }
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {labelTransactionFrequency(f)}
              </option>
            ))}
          </select>
          <span className="field__error">{errors.frequency ?? ''}</span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="rec-desc">
          Descripción <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          id="rec-desc"
          className="input"
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          aria-invalid={!!errors.description}
          placeholder="Ej. Mensualidad"
        />
        <span className="field__error">{errors.description ?? ''}</span>
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="rec-amount">
            Monto <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="rec-amount"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={state.amount}
            onChange={(e) => set('amount', e.target.value)}
            aria-invalid={!!errors.amount}
            placeholder="0.00"
          />
          <span className="field__error">{errors.amount ?? ''}</span>
        </div>

        {needsBillingDay && (
          <div className="field">
            <label className="field__label" htmlFor="rec-bday">
              Día de cobro{' '}
              <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="rec-bday"
              className="input"
              type="number"
              min="1"
              max="28"
              value={state.billing_day}
              onChange={(e) => set('billing_day', e.target.value)}
              aria-invalid={!!errors.billing_day}
            />
            <span className="field__error">{errors.billing_day ?? ''}</span>
          </div>
        )}
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="rec-start">
            Fecha de inicio
          </label>
          <input
            id="rec-start"
            className="input"
            type="date"
            value={state.start_date}
            onChange={(e) => set('start_date', e.target.value)}
            aria-invalid={!!errors.start_date}
          />
          <span className="field__error">{errors.start_date ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="rec-end">
            Fecha de fin
          </label>
          <input
            id="rec-end"
            className="input"
            type="date"
            value={state.end_date}
            onChange={(e) => set('end_date', e.target.value)}
            aria-invalid={!!errors.end_date}
          />
          <span className="field__error">{errors.end_date ?? ''}</span>
        </div>
      </div>

      <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting && <SpinnerIcon />}
          {mode === 'create' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
