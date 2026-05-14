import { useEffect, useState, type FormEvent } from 'react';
import type { UserInvite, UserRole } from '../types';
import { ApiError } from '../api';
import { SpinnerIcon } from '../brand';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteFormProps {
  role: UserRole;
  onSubmit: (payload: UserInvite) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

export default function InviteForm({
  role,
  onSubmit,
  onCancel,
  submitting,
  serverError,
  apiError,
}: InviteFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (apiError?.fieldErrors) {
      setErrors((prev) => ({ ...prev, ...apiError.fieldErrors }));
    }
  }, [apiError]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.first_name = 'Requerido';
    if (!lastName.trim()) next.last_name = 'Requerido';
    if (!email.trim()) next.email = 'Requerido';
    else if (!EMAIL_RE.test(email)) next.email = 'Email inválido';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      role,
    });
  };

  return (
    <form id="invite-form" onSubmit={handleSubmit} noValidate>
      {serverError && (
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
        Enviaremos un correo con el enlace para que active su cuenta y
        configure su contraseña.
      </p>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="if-first">
            Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="if-first"
            className="input"
            value={firstName}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (errors.first_name)
                setErrors((er) => ({ ...er, first_name: '' }));
            }}
            aria-invalid={!!errors.first_name}
            autoFocus
          />
          <span className="field__error">{errors.first_name ?? ''}</span>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="if-last">
            Apellido <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="if-last"
            className="input"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (errors.last_name)
                setErrors((er) => ({ ...er, last_name: '' }));
            }}
            aria-invalid={!!errors.last_name}
          />
          <span className="field__error">{errors.last_name ?? ''}</span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="if-email">
          Email <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          id="if-email"
          className="input"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors((er) => ({ ...er, email: '' }));
          }}
          aria-invalid={!!errors.email}
          placeholder="nombre@ejemplo.com"
        />
        <span className="field__error">{errors.email ?? ''}</span>
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
          Enviar invitación
        </button>
      </div>
    </form>
  );
}
