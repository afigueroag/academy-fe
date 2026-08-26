import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { acceptInvite, ApiError, getInvitee } from '../api';
import { ArrowRightIcon, Logo, SpinnerIcon } from '../brand';
import type { UserPublic } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Invite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [loading, setLoading] = useState(true);
  const [invitee, setInvitee] = useState<UserPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setLoadError('El enlace de invitación no es válido.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await getInvitee(token);
        if (!cancelled) setInvitee(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setLoadError(
            'El enlace expiró o no es válido. Pídele a tu academia que te reenvíe la invitación.',
          );
        } else if (err instanceof ApiError && err.status === 403) {
          setLoadError(
            'Esta invitación ya fue utilizada. Inicia sesión con tu correo y contraseña.',
          );
        } else {
          setLoadError('No se pudo cargar la invitación. Intenta de nuevo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const validate = (): boolean => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Requerido';
    else if (!EMAIL_RE.test(email)) next.email = 'Email inválido';
    if (!password) next.password = 'Requerido';
    else if (password.length < 8) next.password = 'Mínimo 8 caracteres';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!token || !validate()) return;

    setSubmitting(true);
    try {
      await acceptInvite(token, { email: email.trim(), password });
      navigate('/login', {
        replace: true,
        state: {
          success:
            '¡Cuenta activada! Inicia sesión con tu nuevo correo y contraseña.',
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          // Mismo código para "no coincide el correo" y "el enlace ya venció";
          // el correo es lo único que la persona puede corregir aquí.
          setServerError(
            'El email no coincide con el de tu invitación. Escribe el correo al que te llegó el enlace.',
          );
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('No se pudo activar la cuenta. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div className="auth-aside__brand">
          <Logo size={32} />
        </div>
        <div className="auth-aside__quote">
          <p>Activa tu cuenta para empezar a colaborar con tu academia.</p>
        </div>
        <span style={{ opacity: 0.7, fontSize: 13 }}>
          © {new Date().getFullYear()} Cantera
        </span>
      </aside>

      <main className="auth-main">
        <div className="invite-card">
          <div className="auth-card__brand">
            <Logo size={26} />
          </div>

          {loading ? (
            <div className="loading-row">
              <SpinnerIcon size={16} />
              Verificando invitación…
            </div>
          ) : loadError ? (
            <>
              <h2 style={{ fontSize: 26, marginBottom: 8 }}>
                Invitación no válida
              </h2>
              <p className="auth-card__subtitle">{loadError}</p>
              <button
                type="button"
                className="btn btn--ghost btn--block"
                onClick={() => navigate('/login', { replace: true })}
              >
                Ir a iniciar sesión
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontSize: 28, marginBottom: 8 }}>
                Hola, {invitee?.first_name}
              </h2>
              <p className="auth-card__subtitle">
                Confirma tu correo y elige una contraseña para activar tu cuenta.
              </p>

              {serverError && (
                <div className="alert" role="alert">
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="field">
                  <label className="field__label" htmlFor="in-email">
                    Email
                  </label>
                  <input
                    id="in-email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email)
                        setErrors((er) => ({ ...er, email: undefined }));
                    }}
                    aria-invalid={!!errors.email}
                  />
                  <span className="field__hint">
                    El mismo al que te llegó este enlace.
                  </span>
                  <span className="field__error">{errors.email ?? ''}</span>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="in-password">
                    Contraseña
                  </label>
                  <input
                    id="in-password"
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password)
                        setErrors((er) => ({ ...er, password: undefined }));
                    }}
                    aria-invalid={!!errors.password}
                  />
                  <span className="field__hint">
                    Al menos 8 caracteres.
                  </span>
                  <span className="field__error">{errors.password ?? ''}</span>
                </div>

                <button
                  type="submit"
                  className="btn btn--primary btn--block"
                  disabled={submitting}
                >
                  {submitting && <SpinnerIcon />}
                  {submitting ? 'Activando…' : 'Activar cuenta'}
                  {!submitting && <ArrowRightIcon />}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
