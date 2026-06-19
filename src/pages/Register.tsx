import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BRAND_TAGLINE,
  CheckIcon,
  Logo,
  SpinnerIcon,
} from '../brand';
import { ApiError, register } from '../api';
import { applyTheme, resetTheme, stripHash } from '../theme';
import type { AcademyPlan, AcademyType, UserSignUp } from '../types';

const ACADEMY_TYPE_OPTIONS: { value: AcademyType; label: string }[] = [
  { value: 'school', label: 'Escuela' },
  { value: 'dance_academy', label: 'Academia de danza' },
  { value: 'music_academy', label: 'Academia de música' },
  { value: 'martial_arts_academy', label: 'Academia de artes marciales' },
  { value: 'sports_academy', label: 'Academia deportiva' },
  { value: 'art_academy', label: 'Academia de arte' },
  { value: 'holistic_center_yoga', label: 'Centro holístico / Yoga' },
  { value: 'other', label: 'Otro' },
];

const STEPS = [
  { id: 1, label: 'Academia' },
  { id: 2, label: 'Administrador' },
] as const;

interface FormState {
  academy_name: string;
  academy_type: AcademyType | '';
  academy_primary_color: string;
  academy_secondary_color: string;
  academy_accent_color: string;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone: string;
  academy_plan: AcademyPlan;
}

const INITIAL: FormState = {
  academy_name: '',
  academy_type: '',
  academy_primary_color: '#6366F1',
  academy_secondary_color: '#8B5CF6',
  academy_accent_color: '#06B6D4',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  phone: '',
  academy_plan: 'starter',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme({
      primary_color: stripHash(form.academy_primary_color),
      secondary_color: stripHash(form.academy_secondary_color),
      accent_color: stripHash(form.academy_accent_color),
    });
    return () => resetTheme();
  }, [
    form.academy_primary_color,
    form.academy_secondary_color,
    form.academy_accent_color,
  ]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });
    }
  };

  const validateStep = (current: 1 | 2): boolean => {
    const next: Record<string, string> = {};
    if (current === 1) {
      if (!form.academy_name.trim()) next.academy_name = 'Requerido';
      if (!form.academy_type) next.academy_type = 'Selecciona un tipo';
    }
    if (current === 2) {
      if (!form.first_name.trim()) next.first_name = 'Requerido';
      if (!form.last_name.trim()) next.last_name = 'Requerido';
      if (!form.email.trim()) next.email = 'Requerido';
      else if (!EMAIL_RE.test(form.email)) next.email = 'Email inválido';
      if (!form.password) next.password = 'Requerido';
      else if (form.password.length < 8) next.password = 'Mínimo 8 caracteres';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => (Math.min(2, s + 1) as 1 | 2));
    }
  };

  const handleBack = () => {
    setServerError(null);
    setStep((s) => (Math.max(1, s - 1) as 1 | 2));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2)) {
      setStep(1);
      return;
    }

    const payload: UserSignUp = {
      academy_name: form.academy_name.trim(),
      academy_type: form.academy_type as AcademyType,
      // Requeridos por el backend. Se autodetecta la zona horaria; país por
      // defecto MX. Ambos editables después en Configuración de la academia.
      academy_country: 'MX',
      academy_timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'America/Mexico_City',
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      password: form.password,
      phone: form.phone.trim() || null,
      academy_primary_color: stripHash(form.academy_primary_color),
      academy_secondary_color: stripHash(form.academy_secondary_color),
      academy_accent_color: stripHash(form.academy_accent_color),
      academy_plan: form.academy_plan,
    };

    setSubmitting(true);
    setServerError(null);

    try {
      await register(payload);
      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setErrors(err.fieldErrors);
          if (err.fieldErrors.academy_name || err.fieldErrors.academy_type) {
            setStep(1);
          } else if (
            err.fieldErrors.first_name ||
            err.fieldErrors.last_name ||
            err.fieldErrors.email ||
            err.fieldErrors.password ||
            err.fieldErrors.phone
          ) {
            setStep(2);
          }
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
            Gestiona alumnos, cursos y pagos en un solo lugar — diseñado para
            academias de cualquier disciplina.
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

          <h2>Crea tu academia</h2>
          <p className="auth-card__subtitle">
            Dos pasos rápidos. Configura tu marca y tu cuenta.
          </p>

          <Stepper current={step} />

          {serverError && <div className="alert" role="alert">{serverError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            {step === 1 && (
              <Step1
                form={form}
                errors={errors}
                update={update}
              />
            )}
            {step === 2 && (
              <Step2 form={form} errors={errors} update={update} />
            )}

            <div
              className={
                step === 1 ? 'form-actions form-actions--end' : 'form-actions'
              }
            >
              {step > 1 && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleBack}
                  disabled={submitting}
                >
                  <ArrowLeftIcon /> Volver
                </button>
              )}
              {/* Las `key` distintas son intencionales: sin ellas React
                  reutiliza el mismo nodo y al pasar de paso muta el `type` de
                  "button" a "submit" durante el mismo clic, disparando el
                  envío del formulario. */}
              {step < 2 ? (
                <button
                  key="next"
                  type="button"
                  className="btn btn--primary"
                  onClick={handleNext}
                >
                  Continuar <ArrowRightIcon />
                </button>
              ) : (
                <button
                  key="submit"
                  type="submit"
                  className="btn btn--primary"
                  disabled={submitting}
                >
                  {submitting ? <SpinnerIcon /> : null}
                  {submitting ? 'Creando…' : 'Crear mi academia'}
                </button>
              )}
            </div>
          </form>

          <p
            className="center muted-link"
            style={{ marginTop: 24, fontSize: 14 }}
          >
            ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Stepper({ current }: { current: 1 | 2 }) {
  return (
    <div className="stepper" role="list">
      {STEPS.map((s, i) => {
        const state =
          current === s.id ? 'active' : current > s.id ? 'done' : 'pending';
        return (
          <div key={s.id} style={{ display: 'contents' }}>
            <div
              className={`stepper__step stepper__step--${state}`}
              role="listitem"
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <div className="stepper__dot">
                {state === 'done' ? <CheckIcon /> : s.id}
              </div>
              <span className="stepper__label">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="stepper__line" />}
          </div>
        );
      })}
    </div>
  );
}

interface StepProps {
  form: FormState;
  errors: Record<string, string>;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

function Step1({ form, errors, update }: StepProps) {
  return (
    <>
      <div className="field">
        <label className="field__label" htmlFor="academy_name">
          Nombre de la academia
        </label>
        <input
          id="academy_name"
          className="input"
          type="text"
          autoComplete="organization"
          value={form.academy_name}
          onChange={(e) => update('academy_name', e.target.value)}
          aria-invalid={!!errors.academy_name}
          aria-describedby={
            errors.academy_name ? 'academy_name-error' : undefined
          }
        />
        <span id="academy_name-error" className="field__error">
          {errors.academy_name ?? ''}
        </span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="academy_type">
          Tipo de academia
        </label>
        <select
          id="academy_type"
          className="select"
          value={form.academy_type}
          onChange={(e) =>
            update('academy_type', e.target.value as AcademyType)
          }
          aria-invalid={!!errors.academy_type}
        >
          <option value="">Selecciona…</option>
          {ACADEMY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="field__error">{errors.academy_type ?? ''}</span>
      </div>

      <div className="field">
        <label className="field__label">Colores de tu marca (opcional)</label>
        <span className="field__hint">
          Se aplican en vivo a esta pantalla — así puedes ver cómo lucen.
        </span>
        <div className="color-grid">
          <ColorField
            id="primary"
            label="Primario"
            value={form.academy_primary_color}
            onChange={(v) => update('academy_primary_color', v)}
          />
          <ColorField
            id="secondary"
            label="Secundario"
            value={form.academy_secondary_color}
            onChange={(v) => update('academy_secondary_color', v)}
          />
          <ColorField
            id="accent"
            label="Acento"
            value={form.academy_accent_color}
            onChange={(v) => update('academy_accent_color', v)}
          />
        </div>
        <div className="preview-card">
          <p className="preview-card__title">Vista previa</p>
          <div className="preview-card__bars">
            <div style={{ background: 'var(--color-primary)' }} />
            <div style={{ background: 'var(--color-secondary)' }} />
            <div style={{ background: 'var(--color-accent)' }} />
          </div>
        </div>
      </div>
    </>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="color-field">
      <label htmlFor={`color-${id}`} className="color-field__label">
        {label}
      </label>
      <div className="color-field__control">
        <input
          id={`color-${id}`}
          type="color"
          className="color-field__swatch"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`Color ${label}`}
        />
        <span className="color-field__hex">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function Step2({ form, errors, update }: StepProps) {
  return (
    <>
      <div className="field field--row">
        <div>
          <label className="field__label" htmlFor="first_name">
            Nombre
          </label>
          <input
            id="first_name"
            className="input"
            type="text"
            autoComplete="given-name"
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            aria-invalid={!!errors.first_name}
          />
          <span className="field__error">{errors.first_name ?? ''}</span>
        </div>
        <div>
          <label className="field__label" htmlFor="last_name">
            Apellido
          </label>
          <input
            id="last_name"
            className="input"
            type="text"
            autoComplete="family-name"
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            aria-invalid={!!errors.last_name}
          />
          <span className="field__error">{errors.last_name ?? ''}</span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          className="input"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
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
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          aria-invalid={!!errors.password}
        />
        <span className="field__hint">Mínimo 8 caracteres.</span>
        <span className="field__error">{errors.password ?? ''}</span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="phone">
          Teléfono <span style={{ color: 'var(--color-text-subtle)' }}>(opcional)</span>
        </label>
        <input
          id="phone"
          className="input"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
        />
      </div>
    </>
  );
}

