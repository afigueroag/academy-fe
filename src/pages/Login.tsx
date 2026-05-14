import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  BRAND_TAGLINE,
  Logo,
  SpinnerIcon,
} from '../brand';
import { ApiError, clearToken, getMe, login, setToken } from '../api';
import { useAuth } from '../auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const { setMe } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = (): boolean => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Requerido';
    else if (!EMAIL_RE.test(email)) next.email = 'Email inválido';
    if (!password) next.password = 'Requerido';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const token = await login(email.trim(), password);
      setToken(token.access_token);

      try {
        const me = await getMe();
        setMe(me);
        navigate('/students', { replace: true });
      } catch {
        clearToken();
        setServerError(
          'No se pudo cargar tu sesión. Intenta iniciar sesión de nuevo.',
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setServerError('Email o contraseña incorrectos.');
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('No se pudo conectar al servidor. Intenta de nuevo.');
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
          <p>{BRAND_TAGLINE}.</p>
          <span>
            Tu academia, organizada. Alumnos, cursos, asistencia y pagos en un
            solo lugar.
          </span>
        </div>
        <span style={{ opacity: 0.7, fontSize: 13 }}>
          © {new Date().getFullYear()} Cantera
        </span>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-card__brand">
            <Logo size={26} />
          </div>

          <h2>Bienvenido de vuelta</h2>
          <p className="auth-card__subtitle">
            Ingresa con tu cuenta para administrar tu academia.
          </p>

          {serverError && (
            <div className="alert" role="alert">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
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
              <span className="field__error">{errors.email ?? ''}</span>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((er) => ({ ...er, password: undefined }));
                }}
                aria-invalid={!!errors.password}
              />
              <span className="field__error">{errors.password ?? ''}</span>
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={submitting}
            >
              {submitting ? <SpinnerIcon /> : null}
              {submitting ? 'Iniciando…' : 'Iniciar sesión'}
              {!submitting && <ArrowRightIcon />}
            </button>
          </form>

          <p
            className="center muted-link"
            style={{ marginTop: 24, fontSize: 14 }}
          >
            ¿Aún no tienes una academia?{' '}
            <Link to="/register">Crea la tuya</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
