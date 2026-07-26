import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, getPaymentAccountTest, testPaymentAccount } from '../api';
import { SpinnerIcon, WarningIcon } from '../brand';
import { formatMoney } from '../utils/money';
import type { PaymentAccountRead } from '../types';

const POLL_INTERVAL_MS = 3000;
// La solicitud de ATH Móvil expira sola (~10 min). Cortamos antes y dejamos que
// el admin decida si sigue esperando.
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

// El monto lo fija el backend; aquí solo se usa para el texto de la UI.
const TEST_AMOUNT = 100; // cents
const TEST_CURRENCY = 'USD';

type Phase = 'checking' | 'form' | 'waiting' | 'done' | 'rejected' | 'timeout';

interface PaymentAccountTestPanelProps {
  account: PaymentAccountRead;
  // Se llama cuando la prueba se completa, para refrescar la lista y que
  // last_tested_at quede al día.
  onCompleted: () => void;
  onBack: () => void;
  onClose: () => void;
}

export default function PaymentAccountTestPanel({
  account,
  onCompleted,
  onBack,
  onClose,
}: PaymentAccountTestPanelProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCompletedRef = useRef(onCompleted);
  useEffect(() => {
    onCompletedRef.current = onCompleted;
  });

  // Al abrir, retomar una prueba que quedara en curso (el backend responde 409
  // si se intenta otra, así que hay que engancharse a la existente en vez de
  // ofrecer un formulario que va a fallar).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const last = await getPaymentAccountTest(account.id);
        if (cancelled) return;
        setPhase(
          last && (last.status === 'open' || last.status === 'confirm')
            ? 'waiting'
            : 'form',
        );
      } catch {
        if (!cancelled) setPhase('form');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account.id]);

  const handleStart = async (e: FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setPhoneError('Requerido');
      return;
    }
    setPhoneError(null);
    setSubmitting(true);
    setError(null);
    try {
      await testPaymentAccount(account.id, { phone: phone.trim() });
      setPhase('waiting');
    } catch (err) {
      // 400 trae el mensaje de ATH Móvil tal cual (token mal copiado, cuenta de
      // negocio mal configurada); 409 prueba en curso; 429 límite por hora.
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo iniciar el cobro de prueba, intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Poll hasta que el job del backend capture el pago (completed) o la prueba
  // expire/se cancele (cancel).
  useEffect(() => {
    if (phase !== 'waiting') return;
    let cancelled = false;
    let timer = 0;
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const test = await getPaymentAccountTest(account.id);
        if (cancelled) return;
        if (test?.status === 'completed') {
          setPhase('done');
          onCompletedRef.current();
          return;
        }
        if (test?.status === 'cancel') {
          setPhase('rejected');
          return;
        }
      } catch {
        // Errores transitorios de red durante el poll: se reintenta.
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
  }, [phase, account.id]);

  if (phase === 'checking') {
    return (
      <div className="loading-row">
        <SpinnerIcon size={16} /> Cargando…
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div>
        <div className="alert alert--success" role="status">
          Token verificado. Se cobraron{' '}
          {formatMoney(TEST_AMOUNT, TEST_CURRENCY)} y el dinero entró a tu cuenta
          de ATH Business.
        </div>
        <p className="field__hint">
          Ya puedes dejar esta cuenta como predeterminada. Si quieres, devuelve
          el dólar desde la app de ATH Business.
        </p>
        <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Volver a la cuenta
          </button>
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
          <SpinnerIcon size={16} /> Esperando la aprobación…
        </div>
        <p>
          Se envió una solicitud de {formatMoney(TEST_AMOUNT, TEST_CURRENCY)}
          {phone.trim() ? (
            <>
              {' '}
              al número <strong>{phone.trim()}</strong>
            </>
          ) : (
            ' al teléfono de la prueba'
          )}
          . Ahí debe aparecer el cobro en la app de ATH Móvil para aprobarlo.
        </p>
        <p className="field__hint">
          Al aprobarlo, el pago se hace a tu cuenta de ATH Business y esta
          pantalla se actualiza sola. Puedes cerrar esta ventana: la prueba se
          seguirá procesando.
        </p>
        <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'rejected') {
    return (
      <div>
        <div className="alert" role="alert">
          El cobro de prueba no se completó: se rechazó en la app de ATH Móvil o
          expiró sin aprobarse.
        </div>
        <p className="field__hint">
          Esto no significa que el token esté mal: si lo estuviera, la solicitud
          ni se habría enviado. Vuelve a intentarlo y aprueba el cobro desde el
          teléfono.
        </p>
        <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Volver a la cuenta
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setError(null);
              setPhase('form');
            }}
          >
            Probar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'timeout') {
    return (
      <div>
        <div className="alert" role="alert">
          Aún no recibimos la confirmación. Si ya aprobaste el cobro en la app,
          puede tardar un momento en reflejarse.
        </div>
        <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Volver a la cuenta
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setPhase('waiting')}
          >
            Seguir esperando
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleStart} noValidate>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}

      <p>
        Se enviará un cobro de {formatMoney(TEST_AMOUNT, TEST_CURRENCY)} a un
        número de ATH Móvil usando el public token de esta cuenta. En ese
        teléfono aparecerá el cobro en la app de ATH Móvil para aprobarlo, y al
        aprobarlo el pago entra a tu cuenta de ATH Business. Así confirmas que el
        token es correcto antes de cobrarle a alguien de verdad.
      </p>

      <div className="alert alert--warning" role="note">
        <span className="alert__head">
          <WarningIcon size={16} /> Es un cobro real
        </span>
        <ul className="alert__list">
          <li>
            ATH Móvil no tiene ambiente de pruebas: el dólar se cobra de verdad,
            queda en tu ATH Business y no se devuelve solo. Puedes devolverlo
            desde la app.
          </li>
          <li>
            El teléfono que aprueba no puede tener la misma tarjeta que la cuenta
            de ATH Business; usa un número distinto al del negocio.
          </li>
          <li>Máximo 5 pruebas por hora en cada cuenta.</li>
        </ul>
      </div>

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
          <span className="detail-item__label">Cuenta</span>
          <span className="detail-item__value">
            {account.display_name ?? 'ATH Móvil'}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Public token</span>
          <span className="detail-item__value">
            {account.public_token_masked ?? '—'}
          </span>
        </div>
        <div className="detail-item">
          <span className="detail-item__label">Monto</span>
          <span className="detail-item__value">
            {formatMoney(TEST_AMOUNT, TEST_CURRENCY)}
          </span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="pa-test-phone">
          Teléfono ATH Móvil que aprobará el cobro{' '}
          <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          id="pa-test-phone"
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
          Debe ser un número con ATH Móvil activo; ahí llegará la solicitud.
        </span>
      </div>

      <div className="form-actions form-actions--end" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onBack}
          disabled={submitting}
        >
          Cancelar
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting && <SpinnerIcon />}
          Enviar cobro de prueba
        </button>
      </div>
    </form>
  );
}
