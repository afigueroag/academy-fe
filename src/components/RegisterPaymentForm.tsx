import { useEffect, useState, type FormEvent } from 'react';
import type {
  PaymentMethod,
  TransactionRead,
  TransactionUpdate,
} from '../types';
import { ApiError } from '../api';
import { SpinnerIcon } from '../brand';
import { fromCents } from '../utils/money';
import {
  labelPaymentMethod,
  labelTransactionCategory,
  requiresPaymentReference,
} from '../utils/salesLabels';

const PAYMENT_OPTIONS: PaymentMethod[] = [
  'credit_card',
  'debit_card',
  'bank_transfer',
  'paypal',
  'cash',
  'other',
];

const todayIso = () => new Date().toISOString().slice(0, 10);

interface RegisterPaymentFormProps {
  transaction: TransactionRead;
  defaultMethod: PaymentMethod | null;
  currency: string | null;
  onSubmit: (payload: TransactionUpdate) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

export default function RegisterPaymentForm({
  transaction,
  defaultMethod,
  currency,
  onSubmit,
  onCancel,
  submitting,
  serverError,
  apiError,
}: RegisterPaymentFormProps) {
  const [paidDate, setPaidDate] = useState<string>(todayIso());
  const [method, setMethod] = useState<PaymentMethod | ''>(defaultMethod ?? '');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (apiError?.fieldErrors) {
      setErrors((prev) => ({ ...prev, ...apiError.fieldErrors }));
    }
  }, [apiError]);

  const showReference =
    method !== '' && requiresPaymentReference(method as PaymentMethod);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!paidDate) next.paid_date = 'Requerido';
    if (!method) next.payment_method = 'Requerido';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: TransactionUpdate = {
      kind: transaction.kind,
      category: transaction.category,
      status: 'paid',
      description: transaction.description,
      transaction_date: transaction.transaction_date,
      amount: transaction.amount,
      user_id: transaction.user_id,
      external_name: transaction.external_name,
      course_id: transaction.course_id,
      period_start: transaction.period_start,
      period_end: transaction.period_end,
      recurring_id: transaction.recurring_id,
      paid_date: paidDate,
      payment_method: method as PaymentMethod,
      payment_reference: reference.trim() || null,
      payment_notes: notes.trim() || null,
    };
    await onSubmit(payload);
  };

  const formatted = new Intl.NumberFormat(navigator.language, {
    style: 'currency',
    currency: currency ?? 'USD',
  }).format((fromCents(transaction.amount) ?? 0));

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert" role="alert">
          {serverError}
        </div>
      )}

      <div
        className="detail-list"
        style={{
          background: 'var(--color-bg)',
          padding: 12,
          borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}
      >
        <div className="detail-item">
          <span className="detail-item__label">Descripción</span>
          <span className="detail-item__value">{transaction.description}</span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Categoría</span>
          <span className="detail-item__value">
            {labelTransactionCategory(transaction.category)}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Monto</span>
          <span className="detail-item__value">{formatted}</span>
        </div>
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="rp-date">
            Fecha de pago <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="rp-date"
            className="input"
            type="date"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            aria-invalid={!!errors.paid_date}
            autoFocus
          />
          <span className="field__error">{errors.paid_date ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="rp-method">
            Método de pago <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select
            id="rp-method"
            className="select"
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
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

      {showReference && (
        <div className="field">
          <label className="field__label" htmlFor="rp-ref">
            Número de comprobante
          </label>
          <input
            id="rp-ref"
            className="input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="opcional"
          />
          <span className="field__error">{errors.payment_reference ?? ''}</span>
        </div>
      )}

      <div className="field">
        <label className="field__label" htmlFor="rp-notes">
          Nota
        </label>
        <textarea
          id="rp-notes"
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
          Registrar pago
        </button>
      </div>
    </form>
  );
}
