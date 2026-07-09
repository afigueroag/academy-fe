import { useEffect, useState, type FormEvent } from 'react';
import type {
  PaymentMethod,
  TransactionCategory,
  TransactionCreate,
  TransactionKind,
  TransactionRead,
  TransactionStatus,
  TransactionUpdate,
} from '../types';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { SpinnerIcon } from '../brand';
import UserAutocomplete from './UserAutocomplete';
import { formatMoney, fromCents, toCents } from '../utils/money';
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

type DiscountKind = 'none' | 'fixed' | 'percentage';

interface FormState {
  client_type: 'registered' | 'external';
  user_id: number | null;
  user_label: string;
  external_name: string;
  category: TransactionCategory | '';
  description: string;
  gross_amount: string;
  discount_kind: DiscountKind;
  // Valor del descuento: monto en moneda si es fijo, porcentaje (0–100) si lo es.
  discount_value: string;
  discount_description: string;
  transaction_date: string;
  status: TransactionStatus;
  paid_date: string;
  payment_method: PaymentMethod | '';
  payment_reference: string;
  payment_notes: string;
}

// Valores para prellenar el formulario en modo "create" (p. ej. desde la CTA
// "Generar transacción" de Nómina). Todos opcionales.
export interface TransactionPrefill {
  category?: TransactionCategory;
  user_id?: number;
  user_label?: string;
  gross_amount?: string;
  description?: string;
  status?: TransactionStatus;
  period_start?: string | null;
  period_end?: string | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY = (): FormState => ({
  client_type: 'registered',
  user_id: null,
  user_label: '',
  external_name: '',
  category: '',
  description: '',
  gross_amount: '',
  discount_kind: 'none',
  discount_value: '',
  discount_description: '',
  transaction_date: todayIso(),
  status: 'pending',
  paid_date: '',
  payment_method: '',
  payment_reference: '',
  payment_notes: '',
});

function fromTransaction(tx: TransactionRead): FormState {
  const isRegistered = tx.user_id !== null;
  const discount_kind: DiscountKind =
    tx.discount_amount != null
      ? 'fixed'
      : tx.discount_percentage != null
        ? 'percentage'
        : 'none';
  const discount_value =
    discount_kind === 'fixed'
      ? String(fromCents(tx.discount_amount) ?? '')
      : discount_kind === 'percentage'
        ? String(tx.discount_percentage ?? '')
        : '';
  return {
    client_type: isRegistered ? 'registered' : 'external',
    user_id: tx.user_id,
    user_label: tx.user
      ? `${tx.user.first_name} ${tx.user.last_name}`
      : '',
    external_name: tx.external_name ?? '',
    category: tx.category,
    description: tx.description,
    gross_amount:
      tx.gross_amount !== null ? String(fromCents(tx.gross_amount) ?? '') : '',
    discount_kind,
    discount_value,
    discount_description: tx.discount_description ?? '',
    transaction_date: tx.transaction_date,
    status: tx.status,
    paid_date: tx.paid_date ?? '',
    payment_method: tx.payment_method ?? '',
    payment_reference: tx.payment_reference ?? '',
    payment_notes: tx.payment_notes ?? '',
  };
}

// Neto previsualizado en vivo (cents) a partir del bruto y el descuento. El
// backend recalcula este valor; aquí solo se muestra como referencia.
function previewNet(state: FormState): number | null {
  const gross = toCents(state.gross_amount);
  if (gross === null) return null;
  if (state.discount_kind === 'fixed') {
    const disc = toCents(state.discount_value) ?? 0;
    return gross - disc;
  }
  if (state.discount_kind === 'percentage') {
    const pct = parseFloat(state.discount_value);
    if (Number.isNaN(pct)) return gross;
    return Math.round(gross * (1 - pct / 100));
  }
  return gross;
}

interface BaseProps {
  kind?: TransactionKind;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

interface CreateProps extends BaseProps {
  mode: 'create';
  prefill?: TransactionPrefill;
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
  const kind = props.kind ?? 'sale';
  const isExpense = kind === 'expense';
  const { me } = useAuth();
  const currency = me?.academy.currency ?? null;

  const prefill = mode === 'create' ? props.prefill : undefined;

  const [state, setState] = useState<FormState>(() => {
    if (mode === 'edit') return fromTransaction(props.transaction);
    const base = EMPTY();
    if (prefill) {
      if (prefill.category) base.category = prefill.category;
      if (prefill.user_id != null) {
        base.client_type = 'registered';
        base.user_id = prefill.user_id;
        base.user_label = prefill.user_label ?? '';
      }
      if (prefill.gross_amount != null) base.gross_amount = prefill.gross_amount;
      if (prefill.description) base.description = prefill.description;
      if (prefill.status) base.status = prefill.status;
    }
    return base;
  });
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
  // Solo el backend setea discount_id (transacción generada desde un descuento
  // recurrente del estudiante). Si viene poblado lo mostramos para trazabilidad.
  const inheritedDiscountId =
    mode === 'edit' ? props.transaction.discount_id : null;

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
      next.user_id = isExpense
        ? 'Selecciona un usuario registrado'
        : 'Selecciona un cliente registrado';
    }
    if (state.client_type === 'external' && !state.external_name.trim()) {
      next.external_name = 'Requerido';
    }
    if (!state.category) next.category = 'Requerido';
    if (!state.description.trim()) next.description = 'Requerido';
    const gross = parseFloat(state.gross_amount);
    if (!state.gross_amount || Number.isNaN(gross) || gross <= 0) {
      next.gross_amount = 'Monto mayor a cero';
    }
    if (state.discount_kind === 'fixed') {
      const disc = parseFloat(state.discount_value);
      if (!state.discount_value || Number.isNaN(disc) || disc < 0) {
        next.discount_value = 'Descuento inválido';
      } else if (!Number.isNaN(gross) && disc > gross) {
        next.discount_value = 'El descuento no puede superar el bruto';
      }
    } else if (state.discount_kind === 'percentage') {
      const pct = parseFloat(state.discount_value);
      if (
        state.discount_value === '' ||
        Number.isNaN(pct) ||
        pct < 0 ||
        pct > 100
      ) {
        next.discount_value = 'Entre 0 y 100';
      }
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

    const grossCents = toCents(state.gross_amount);
    if (grossCents === null) return;

    const discount_amount =
      state.discount_kind === 'fixed' ? toCents(state.discount_value) : null;
    const discount_percentage =
      state.discount_kind === 'percentage'
        ? Math.round(parseFloat(state.discount_value))
        : null;
    const discount_description =
      state.discount_kind !== 'none' && state.discount_description.trim()
        ? state.discount_description.trim()
        : null;

    const payload: TransactionCreate = {
      kind,
      category: state.category as TransactionCategory,
      status: state.status,
      description: state.description.trim(),
      transaction_date: state.transaction_date,
      gross_amount: grossCents,
      user_id: state.client_type === 'registered' ? state.user_id : null,
      external_name:
        state.client_type === 'external' ? state.external_name.trim() : null,
      course_id: mode === 'edit' ? props.transaction.course_id : null,
      period_start:
        mode === 'edit'
          ? props.transaction.period_start
          : (prefill?.period_start ?? null),
      period_end:
        mode === 'edit'
          ? props.transaction.period_end
          : (prefill?.period_end ?? null),
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
      discount_amount,
      discount_percentage,
      discount_description,
      // Conserva el discount_id heredado en edición; null en alta manual.
      discount_id: inheritedDiscountId,
    };

    await props.onSubmit(payload);
  };

  const categories = categoriesForKind(kind);
  const netCents = previewNet(state);

  return (
    <form id="transaction-form" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert" role="alert">
          {serverError}
        </div>
      )}

      <div className="field">
        <label className="field__label">
          {isExpense ? 'Proveedor / Beneficiario' : 'Cliente'}
        </label>
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
            {isExpense ? 'Usuario registrado' : 'Cliente registrado'}
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
            {isExpense ? 'Externo' : 'Cliente externo'}
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
                  aria-label={isExpense ? 'Quitar usuario' : 'Quitar cliente'}
                >
                  ×
                </button>
              )}
            </div>
          ) : (
            <UserAutocomplete
              role={isExpense ? 'instructor' : 'student'}
              onSelect={(u) => {
                set('user_id', u.id);
                set('user_label', `${u.first_name} ${u.last_name}`);
              }}
              placeholder={
                isExpense
                  ? 'Buscar instructor por nombre'
                  : 'Buscar estudiante por nombre'
              }
            />
          )
        ) : (
          <input
            className="input"
            value={state.external_name}
            onChange={(e) => set('external_name', e.target.value)}
            placeholder={
              isExpense
                ? 'Nombre del proveedor o beneficiario'
                : 'Nombre del cliente externo'
            }
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
          placeholder={isExpense ? 'Ej. Renta de marzo' : 'Ej. Mensualidad de marzo'}
        />
        <span className="field__error">{errors.description ?? ''}</span>
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="tx-amount">
            Monto bruto <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="tx-amount"
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={state.gross_amount}
            onChange={(e) => set('gross_amount', e.target.value)}
            aria-invalid={!!errors.gross_amount}
            placeholder="0.00"
            disabled={readonly}
          />
          <span className="field__error">{errors.gross_amount ?? ''}</span>
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

      {inheritedDiscountId !== null && (
        <p className="field__hint" style={{ color: 'var(--color-text-muted)' }}>
          Descuento aplicado desde configuración del estudiante. Editar el
          descuento puntual lo sobreescribe.
        </p>
      )}

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="tx-discount-kind">
            Descuento
          </label>
          <select
            id="tx-discount-kind"
            className="select"
            value={state.discount_kind}
            onChange={(e) => {
              set('discount_kind', e.target.value as DiscountKind);
              set('discount_value', '');
            }}
            disabled={readonly}
          >
            <option value="none">Sin descuento</option>
            <option value="fixed">Fijo</option>
            <option value="percentage">Porcentual</option>
          </select>
          <span className="field__error" />
        </div>

        {state.discount_kind !== 'none' && (
          <div className="field">
            <label className="field__label" htmlFor="tx-discount-value">
              {state.discount_kind === 'fixed'
                ? 'Monto del descuento'
                : 'Porcentaje (%)'}{' '}
              <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="tx-discount-value"
              className="input"
              type="number"
              step={state.discount_kind === 'fixed' ? '0.01' : '1'}
              min="0"
              max={state.discount_kind === 'percentage' ? '100' : undefined}
              value={state.discount_value}
              onChange={(e) => set('discount_value', e.target.value)}
              aria-invalid={!!errors.discount_value}
              placeholder={state.discount_kind === 'fixed' ? '0.00' : '0'}
              disabled={readonly}
            />
            <span className="field__error">{errors.discount_value ?? ''}</span>
          </div>
        )}
      </div>

      {state.discount_kind !== 'none' && (
        <div className="field">
          <label className="field__label" htmlFor="tx-discount-desc">
            Motivo del descuento
          </label>
          <input
            id="tx-discount-desc"
            className="input"
            value={state.discount_description}
            onChange={(e) => set('discount_description', e.target.value)}
            placeholder="opcional"
            disabled={readonly}
          />
          <span className="field__error" />
        </div>
      )}

      <div className="amount-summary">
        <span className="amount-summary__label">Monto neto</span>
        <span className="amount-summary__value">
          {formatMoney(netCents, currency)}
        </span>
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
