import { useEffect, useState, type FormEvent } from 'react';
import type { UserListRead } from '../types';
import { ApiError } from '../api';
import { SpinnerIcon } from '../brand';
import { emailTakenMessage } from '../utils/invites';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteAccessFormProps {
  user: UserListRead;
  /**
   * `email` es el correo a guardar en la ficha antes de invitar; `null` significa
   * reenviar al que el usuario ya tiene (POST sin cuerpo).
   */
  onSubmit: (email: string | null) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

/**
 * Da acceso a la plataforma a alguien que **ya existe** en la academia. Cubre los
 * dos casos con la misma pantalla: al que se dio de alta sin correo se le pide
 * uno, y al que ya lo tiene se le muestra para reenviar o corregir.
 */
export default function InviteAccessForm({
  user,
  onSubmit,
  onCancel,
  submitting,
  serverError,
  apiError,
}: InviteAccessFormProps) {
  const original = user.email ?? '';
  const [email, setEmail] = useState(original);
  const [error, setError] = useState<string | null>(null);

  const isResend = user.status === 'pending' && !!user.email;

  // El correo repetido es un problema del campo, no del panel: se marca abajo
  // del input y no se repite arriba en el alert.
  const takenMessage = emailTakenMessage(apiError);

  useEffect(() => {
    if (!apiError) return;
    setError(emailTakenMessage(apiError) ?? apiError.fieldErrors.email ?? null);
  }, [apiError]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) {
      setError('Requerido');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setError('Email inválido');
      return;
    }
    setError(null);
    // Sin cambios respecto a la ficha → reenvío puro, sin tocar el correo.
    await onSubmit(value === original ? null : value);
  };

  return (
    <form id="invite-access-form" onSubmit={handleSubmit} noValidate>
      {serverError && !takenMessage && (
        <div className="alert" role="alert">
          {serverError}
        </div>
      )}

      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 14,
          marginTop: 0,
          marginBottom: 18,
        }}
      >
        {isResend
          ? `Le enviaremos un enlace nuevo a ${user.first_name} para que fije su contraseña. El enlace vence en 7 días.`
          : original
            ? `Enviaremos a ${user.first_name} un enlace para fijar su contraseña y entrar a la plataforma. El enlace vence en 7 días.`
            : `${user.first_name} se dio de alta sin correo. Escribe uno: se guardará en su ficha y ahí recibirá el enlace para fijar su contraseña.`}
      </p>

      <div className="field">
        <label className="field__label" htmlFor="ia-email">
          Email <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          id="ia-email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={!!error}
          placeholder="nombre@ejemplo.com"
          autoFocus
        />
        <span className="field__hint">
          Debe ser único: no puede estar registrado en otra persona.
        </span>
        <span className="field__error">{error ?? ''}</span>
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
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting && <SpinnerIcon />}
          {isResend ? 'Reenviar invitación' : 'Enviar invitación'}
        </button>
      </div>
    </form>
  );
}
