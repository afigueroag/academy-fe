import { useEffect, useState, type FormEvent } from 'react';
import type {
  PaymentMethod,
  TransactionCategory,
  TransactionCreate,
  TransactionRead,
  TransactionStatus,
  TransactionUpdate,
} from '../types';
import { ApiError } from '../api';
import { SpinnerIcon } from '../brand';
import UserAutocomplete from './UserAutocomplete';
import { fromCents, toCents } from '../utils/money';
import {
  categoriesForKind,
  labelPaymentMethod,
  labelTransactionCategory,
  labelTransactionStatus,
} from '../utils/salesLabels';

const PAYMENT_OPTIONS: PaymentMethod[] = [
  'credit_card',
  'debit_card',
  'bank_transfer',
  'paypal',
  'cash',
  'other',
];

const STATUS_OPTIONS: TransactionStatus[] = [
  'scheduled',
  'pending',
  'paid',
];

interface FormState {
  client_type: 'registered' | 'external';
  user_id: number | null;
  user_label: string;
  external_name: string;
  category: TransactionCategory | '';
  description: string;
  amount: string;
  transaction_date: string;
  status: TransactionStatus;
  paid_date: string;
  payment_method: PaymentMethod | '';
  payment_reference: string;
  payment_notes: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY = (): FormState => ({
  client_type: 'registered',
  user_id: null,
  user_label: '',
  external_name: '',
  category: '',
  description: '',
  amount: '',
  transaction_date: todayIso(),
  status: 'pending',
  paid_date: '',
  payment_method: '',
  payment_reference: '',
  payment_notes: '',
});

function fromTransaction(tx: TransactionRead): FormState {
  const isRegistered = tx.user_id !== null;
  return {
    client_type: isRegistered ? 'registered' : 'external',
    user_id: tx.user_id,
    user_label: tx.user
      ? `${tx.user.first_name} ${tx.user.last_name}`
      : '',
    external_name: tx.external_name ?? '',
    category: tx.category,
    description: tx.description,
    amount: tx.amount !== null ? String(fromCents(tx.amount) ?? '') : '',
    transaction_date: tx.transaction_date,
    status: tx.status,
    paid_date: tx.paid_date ?? '',
    payment_method: tx.payment_method ?? '',
    payment_reference: tx.payment_reference ?? '',
    payment_notes: tx.payment_notes ?? '',
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
  onSubmit: (payload: TransactionCreate) => Promise<void>;
}

interface EditProps extends BaseProps {
  mode: 'edit';
  transaction: TransactionRead;
  onSubmit: (payload: TransactionUpdate) => Promise<void>;
}

type TransactionFormProps = CreateProps | EditProps;

export default function TransactionForm(props: TransactionFormProps) {
  const { mode, onCancel, submitting, serverError, apiError } = props;

  const [state, setState] = useState<FormState>(() =>
    mode === 'edit' ? fromTransaction(props.transaction) : EMPTY(),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === 'edit') setState(fromTransaction(props.transaction));
  }, [mode, mode === 'edit' ? props.transaction.id : null]);

  useEffect(() => {
    if (apiError?.fieldErrors) {
      setErrors((prev) => ({ ...prev, ...apiError.fieldErrors }));
    }
  }, [apiError]);

  const readonly = mode === 'edit' && props.transaction.status === 'paid';

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
    if (!state.transaction_date) next.transaction_date = 'Requerido';
    if (state.status === 'paid') {
      if (!state.paid_date) next.paid_date = 'Requerido cuando es pagada';
      if (!state.payment_method) next.payment_method = 'Requerido cuando es pagada';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const amountCents = toCents(state.amount);
    if (amountCents === null) return;

    const payload: TransactionCreate = {
      kind: 'sale',
      category: state.category as TransactionCategory,
      status: state.status,
      description: state.description.trim(),
      transaction_date: state.transaction_date,
      amount: amountCents,
      user_id: state.client_type === 'registered' ? state.user_id : null,
      external_name:
        state.client_type === 'external' ? state.external_name.trim() : null,
      course_id: mode === 'edit' ? props.transaction.course_id : null,
      period_start: mode === 'edit' ? props.transaction.period_start : null,
      period_end: mode === 'edit' ? props.transaction.period_end : null,
      paid_date: state.status === 'paid' ? state.paid_date || null : null,
      payment_method:
        state.status === 'paid'
          ? (state.payment_method as PaymentMethod) || null
          : state.payment_method
            ? (state.payment_method as PaymentMethod)
            : null,
      recurring_id: mode === 'edit' ? props.transaction.recurring_id : null,
      payment_reference: state.payment_reference.trim() || null,
      payment_notes: state.payment_notes.trim() || null,
    };

    if (mode === 'create') {
      await props.onSubmit(payload);
    } else {
      await props.onSubmit(payload);
    }
  };

  const categories = categoriesForKind('sale');

  return (
    <form id="transaction-form" onSubmit={handleSubmit} noValidate>
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
            disabled={readonly}
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
            disabled={readonly}
          >
            Cliente externo
          </button>
        </div>

        {state.client_type === 'registered' ? (
          state.user_id && state.user_label ? (
            <div className="autocomplete-chip">
              <span>{state.user_label}</span>
              {!readonly && (
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
              )}
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
            disabled={readonly}
          />
        )}
        <span className="field__error">
          {errors.user_id || errors.external_name || ''}
        </span>
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="tx-category">
            Categoría <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select
            id="tx-category"
            className="select"
            value={state.category}
            onChange={(e) =>
              set('category', e.target.value as TransactionCategory | '')
            }
            aria-invalid={!!errors.category}
            disabled={readonly}
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
          <label className="field__label" htmlFor="tx-date">
            Fecha <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="tx-date"
            className="input"
            type="date"
            value={state.transaction_date}
            onChange={(e) => set('transaction_date', e.target.value)}
            aria-invalid={!!errors.transaction_date}
            disabled={readonly}
          />
          <span className="field__error">{errors.transaction_date ?? ''}</span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="tx-desc">
          Descripción <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          id="tx-desc"
          className="input"
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          aria-invalid={!!errors.description}
          placeholder="Ej. Mensualidad de marzo"
        />
        <span className="field__error">{errors.description ?? ''}</span>
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="tx-amount">
            Monto <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="tx-amount"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={state.amount}
            onChange={(e) => set('amount', e.target.value)}
            aria-invalid={!!errors.amount}
            placeholder="0.00"
            disabled={readonly}
          />
          <span className="field__error">{errors.amount ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tx-status">
            Estado <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select
            id="tx-status"
            className="select"
            value={state.status}
            onChange={(e) => set('status', e.target.value as TransactionStatus)}
            aria-invalid={!!errors.status}
            disabled={readonly}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {labelTransactionStatus(s)}
              </option>
            ))}
          </select>
          <span className="field__error">{errors.status ?? ''}</span>
        </div>
      </div>

      {state.status === 'paid' && (
        <div className="field--row">
          <div className="field">
            <label className="field__label" htmlFor="tx-paid-date">
              Fecha de pago <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="tx-paid-date"
              className="input"
              type="date"
              value={state.paid_date}
              onChange={(e) => set('paid_date', e.target.value)}
              aria-invalid={!!errors.paid_date}
            />
            <span className="field__error">{errors.paid_date ?? ''}</span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="tx-method">
              Método de pago <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <select
              id="tx-method"
              className="select"
              value={state.payment_method}
              onChange={(e) =>
                set('payment_method', e.target.value as PaymentMethod | '')
              }
              aria-invalid={!!errors.payment_method}
            >
              <option value="">— Selecciona —</option>
              {PAYMENT_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {labelPaymentMethod(m)}
                </option>
              ))}
            </select>
            <span className="field__error">{errors.payment_method ?? ''}</span>
          </div>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="tx-ref">
          Número de comprobante
        </label>
        <input
          id="tx-ref"
          className="input"
          value={state.payment_reference}
          onChange={(e) => set('payment_reference', e.target.value)}
          placeholder="opcional"
        />
        <span className="field__error">{errors.payment_reference ?? ''}</span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="tx-notes">
          Nota
        </label>
        <textarea
          id="tx-notes"
          className="textarea"
          value={state.payment_notes}
          onChange={(e) => set('payment_notes', e.target.value)}
          placeholder="opcional"
        />
        <span className="field__error">{errors.payment_notes ?? ''}</span>
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
