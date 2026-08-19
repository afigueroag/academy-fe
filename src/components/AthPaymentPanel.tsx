import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, createPayment, getTransaction } from '../api';
import { SpinnerIcon } from '../brand';
import { formatMoney } from '../utils/money';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos

type Phase = 'form' | 'waiting' | 'done' | 'timeout';

interface AthPaymentPanelProps {
  transactionId: number;
  description: string;
  amount: number; // cents
  currency: string | null;
  // Se llama cuando la transacción pasa a 'paid'. El padre refresca sus datos.
  onPaid: () => void;
  onClose: () => void;
}

export default function AthPaymentPanel({
  transactionId,
  description,
  amount,
  currency,
  onPaid,
  onClose,
}: AthPaymentPanelProps) {
  const [phase, setPhase] = useState<Phase>('form');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Ref para no re-disparar el efecto de poll si el padre no memoiza onPaid.
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  });

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setPhoneError('Requerido');
      return;
    }
    setPhoneError(null);
    setSubmitting(true);
    setError(null);
    try {
      await createPayment({
        transaction_id: transactionId,
        phone: phone.trim(),
        description: note.trim() || undefined,
      });
      setPhase('waiting');
    } catch (err) {
      // 409: pago en curso · 400: no pagable / sin cuenta · 404: inexistente
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo iniciar el pago, intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Poll a la transacción hasta que el backend la marque como pagada (el job
  // reconcile_payment_intents captura el pago tras la confirmación en la app).
  useEffect(() => {
    if (phase !== 'waiting') return;
    let cancelled = false;
    let timer = 0;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const tx = await getTransaction(transactionId);
        if (cancelled) return;
        if (tx.status === 'paid') {
          setPhase('done');
          onPaidRef.current();
          return;
        }
        if (tx.status === 'cancelled') {
          setError('La transacción fue anulada.');
          setPhase('form');
          return;
        }
      } catch (err) {
        if (cancelled) return;
        // 403 y 404 no son transitorios: desde que GET /transactions/{id} valida
        // quién pregunta, insistir hasta el timeout solo alarga la espera.
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setError('No se pudo consultar el estado del cobro.');
          setPhase('form');
          return;
        }
        // El resto (red, 5xx) sí puede ser pasajero: se reintenta.
      }
      if (cancelled) return;
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPhase('timeout');
        return;
      }
      timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    timer = window.setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [phase, transactionId]);

  if (phase === 'done') {
    return (
      <div>
        <div className="alert alert--success" role="status">
          ¡Pago confirmado! La transacción quedó registrada como pagada.
        </div>
        <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div>
        <div className="loading-row">
          <SpinnerIcon size={16} /> Esperando confirmación…
        </div>
        <p style={{ marginTop: 12 }}>
          Se envió una solicitud de pago al teléfono <strong>{phone.trim()}</strong>
          . Confirma el pago desde la app de ATH Móvil de ese número.
        </p>
        <p className="field__hint">
          En cuanto se confirme, esta pantalla se actualizará sola. Puedes cerrar
          esta ventana: el pago se seguirá procesando.
        </p>
        <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'timeout') {
    return (
      <div>
        <div className="alert" role="alert">
          Aún no recibimos la confirmación del pago. Si ya confirmaste en la app,
          puede tardar un momento en reflejarse.
        </div>
        <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setError(null);
              setPhase('waiting');
            }}
          >
            Seguir esperando
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handlePay} noValidate>
      {error && (
        <div className="alert" role="alert">
          {error}
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
          <span className="detail-item__label">Concepto</span>
          <span className="detail-item__value">{description}</span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Monto</span>
          <span className="detail-item__value">
            {formatMoney(amount, currency)}
          </span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ath-phone">
          Teléfono ATH Móvil del pagador{' '}
          <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          id="ath-phone"
          className="input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(787) 000-0000"
          autoComplete="off"
          aria-invalid={!!phoneError}
          autoFocus
        />
        <span className="field__error">{phoneError ?? ''}</span>
        <span className="field__hint">
          Le llegará una solicitud de pago a este número para confirmar en su app
          de ATH Móvil.
        </span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="ath-note">
          Concepto para el pagador
        </label>
        <input
          id="ath-note"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="opcional"
        />
      </div>

      <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClose}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting && <SpinnerIcon />}
          Pagar con ATH Móvil
        </button>
      </div>
    </form>
  );
}
