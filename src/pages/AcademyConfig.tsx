import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import PaymentAccountsSection from '../components/PaymentAccountsSection';
import { useAuth } from '../auth';
import {
  ApiError,
  deleteAcademyLogo,
  getMe,
  updateAcademy,
  uploadAcademyLogo,
} from '../api';
import { SpinnerIcon } from '../brand';
import { fromCents, toCents } from '../utils/money';
import { stripHash } from '../theme';
import { labelEnrollmentFeeMode } from '../utils/salesLabels';
import type {
  AcademyMe,
  AcademyPlan,
  AcademyType,
  AcademyUpdate,
  EnrollmentFeeMode,
  WeekendBillingBehavior,
} from '../types';

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

const PLAN_OPTIONS: { value: AcademyPlan; label: string }[] = [
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
];

const ENROLLMENT_FEE_MODES: EnrollmentFeeMode[] = [
  'annual_recurring',
  'one_time_on_signup',
  'none',
];

const WEEKEND_OPTIONS: { value: WeekendBillingBehavior; label: string }[] = [
  { value: 'ignore', label: 'Ignorar (cobrar en fin de semana)' },
  { value: 'shift_previous', label: 'Mover al día hábil anterior' },
  { value: 'shift_next', label: 'Mover al día hábil siguiente' },
];

const LOGO_ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];
const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

interface FormState {
  name: string;
  type: AcademyType;
  plan: AcademyPlan | '';
  default_instructor_hourly_rate: string;
  default_assistant_hourly_rate: string;
  students_self_unenroll: boolean;
  students_self_enroll: boolean;
  currency: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  country: string;
  timezone: string;
  default_billing_day: string;
  payment_grace_days: string;
  billing_lookahead_months: string;
  auto_billing_enabled: boolean;
  enrollment_fee_mode: EnrollmentFeeMode | '';
  enrollment_fee_amount: string;
  enrollment_fee_month: string;
  weekend_billing_behavior: WeekendBillingBehavior | '';
}

const withHashOr = (color: string | null, fallback: string): string => {
  const raw = (color ?? '').trim();
  if (!raw) return fallback;
  return raw.startsWith('#') ? raw : '#' + raw;
};

const moneyStr = (cents: number | null): string => {
  const v = fromCents(cents);
  return v === null ? '' : String(v);
};

function fromAcademy(a: AcademyMe): FormState {
  return {
    name: a.name,
    type: a.type,
    plan: a.plan ?? '',
    default_instructor_hourly_rate: moneyStr(a.default_instructor_hourly_rate),
    default_assistant_hourly_rate: moneyStr(a.default_assistant_hourly_rate),
    students_self_unenroll: a.students_self_unenroll ?? false,
    students_self_enroll: a.students_self_enroll ?? false,
    currency: a.currency ?? '',
    primary_color: withHashOr(a.primary_color, '#6366F1'),
    secondary_color: withHashOr(a.secondary_color, '#8B5CF6'),
    accent_color: withHashOr(a.accent_color, '#06B6D4'),
    country: a.country ?? '',
    timezone: a.timezone ?? '',
    default_billing_day:
      a.default_billing_day != null ? String(a.default_billing_day) : '',
    payment_grace_days:
      a.payment_grace_days != null ? String(a.payment_grace_days) : '',
    billing_lookahead_months:
      a.billing_lookahead_months != null
        ? String(a.billing_lookahead_months)
        : '',
    auto_billing_enabled: a.auto_billing_enabled ?? false,
    enrollment_fee_mode: a.enrollment_fee_mode ?? '',
    enrollment_fee_amount: moneyStr(a.enrollment_fee_amount),
    enrollment_fee_month:
      a.enrollment_fee_month != null ? String(a.enrollment_fee_month) : '',
    weekend_billing_behavior: a.weekend_billing_behavior ?? '',
  };
}

const intOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
};

function toPayload(s: FormState): AcademyUpdate {
  return {
    name: s.name.trim(),
    type: s.type,
    plan: s.plan === '' ? null : s.plan,
    default_instructor_hourly_rate: toCents(s.default_instructor_hourly_rate),
    default_assistant_hourly_rate: toCents(s.default_assistant_hourly_rate),
    students_self_unenroll: s.students_self_unenroll,
    students_self_enroll: s.students_self_enroll,
    currency: s.currency.trim() || null,
    primary_color: stripHash(s.primary_color),
    secondary_color: stripHash(s.secondary_color),
    accent_color: stripHash(s.accent_color),
    country: s.country.trim(),
    timezone: s.timezone.trim(),
    default_billing_day: intOrNull(s.default_billing_day),
    payment_grace_days: intOrNull(s.payment_grace_days),
    billing_lookahead_months: intOrNull(s.billing_lookahead_months),
    auto_billing_enabled: s.auto_billing_enabled,
    enrollment_fee_mode:
      s.enrollment_fee_mode === '' ? null : s.enrollment_fee_mode,
    enrollment_fee_amount: toCents(s.enrollment_fee_amount),
    enrollment_fee_month: intOrNull(s.enrollment_fee_month),
    weekend_billing_behavior:
      s.weekend_billing_behavior === '' ? null : s.weekend_billing_behavior,
  };
}

export default function AcademyConfig() {
  const { me, setMe } = useAuth();

  const [state, setState] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [confirmRemoveLogo, setConfirmRemoveLogo] = useState(false);

  const handleLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite volver a elegir el mismo archivo
    if (!file || !me) return;
    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      setError('Formato no permitido. Usa PNG, JPEG, WEBP o SVG.');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError('El logo supera el máximo de 2 MB.');
      return;
    }
    setLogoBusy(true);
    setError(null);
    try {
      const academy = await uploadAcademyLogo(me.academy.id, file);
      setMe({ ...me, academy }); // refresca el logo del encabezado
      showToast('Logo actualizado');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
    } finally {
      setLogoBusy(false);
    }
  };

  // Tras crear/editar/eliminar una cuenta de cobro, refresca /me para que el flag
  // has_active_payment_account (que habilita el botón de pago) quede al día.
  const refreshMe = useCallback(async () => {
    try {
      const fresh = await getMe();
      setMe(fresh);
    } catch {
      // Si falla, el flag se actualizará en la próxima carga de /me.
    }
  }, [setMe]);

  const handleRemoveLogo = async () => {
    if (!me) return;
    setLogoBusy(true);
    setError(null);
    try {
      const academy = await deleteAcademyLogo(me.academy.id);
      setMe({ ...me, academy });
      setConfirmRemoveLogo(false);
      showToast('Logo eliminado');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
    } finally {
      setLogoBusy(false);
    }
  };

  useEffect(() => {
    if (me) setState(fromAcademy(me.academy));
  }, [me]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setState((s) => (s ? { ...s, [k]: v } : s));
    if (errors[k as string]) {
      setErrors((er) => {
        const next = { ...er };
        delete next[k as string];
        return next;
      });
    }
  };

  const validate = (s: FormState): boolean => {
    const next: Record<string, string> = {};
    if (!s.name.trim()) next.name = 'Requerido';
    const bd = intOrNull(s.default_billing_day);
    if (bd !== null && (bd < 1 || bd > 28)) next.default_billing_day = 'Entre 1 y 28';
    const grace = intOrNull(s.payment_grace_days);
    if (grace !== null && (grace < 1 || grace > 28))
      next.payment_grace_days = 'Entre 1 y 28';
    const month = intOrNull(s.enrollment_fee_month);
    if (month !== null && (month < 1 || month > 12))
      next.enrollment_fee_month = 'Entre 1 y 12';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me || !state) return;
    if (!validate(state)) return;

    setSaving(true);
    setError(null);
    try {
      await updateAcademy(me.academy.id, toPayload(state));
      const fresh = await getMe();
      setMe(fresh); // refresca datos + re-aplica tema (colores)
      setState(fromAcademy(fresh.academy));
      showToast('Configuración guardada');
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...err.fieldErrors }));
      }
      setError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
    } finally {
      setSaving(false);
    }
  };

  if (!me || !state) {
    return (
      <Layout title="Configuración de la academia">
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Configuración de la academia">
      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {toast && (
        <div
          className="alert alert--success"
          role="status"
          style={{ marginBottom: 12 }}
        >
          {toast}
        </div>
      )}

      <section className="config-section">
        <h3 className="form-section__title">Logo</h3>
        <div className="logo-config">
          <div className="logo-config__preview">
            {me.academy.logo_url ? (
              <img
                src={me.academy.logo_url}
                alt={`Logo de ${me.academy.name}`}
              />
            ) : (
              <span className="logo-config__empty">Sin logo</span>
            )}
          </div>
          <div className="logo-config__actions">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoFile}
              style={{ display: 'none' }}
            />
            <div className="logo-config__buttons">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoBusy}
              >
                {logoBusy && <SpinnerIcon />}
                {me.academy.logo_url ? 'Cambiar logo' : 'Subir logo'}
              </button>
              {me.academy.logo_url && (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setConfirmRemoveLogo(true)}
                  disabled={logoBusy}
                >
                  Quitar logo
                </button>
              )}
            </div>
            <span className="field__hint">
              PNG, JPEG, WEBP o SVG. Máximo 2 MB.
            </span>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} noValidate>
        <section className="config-section">
          <h3 className="form-section__title">General</h3>

          <div className="field">
            <label className="field__label" htmlFor="ac-name">
              Nombre de la academia{' '}
              <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="ac-name"
              className="input"
              value={state.name}
              onChange={(e) => set('name', e.target.value)}
              aria-invalid={!!errors.name}
            />
            <span className="field__error">{errors.name ?? ''}</span>
          </div>

          <div className="field--row">
            <div className="field">
              <label className="field__label" htmlFor="ac-type">
                Tipo
              </label>
              <select
                id="ac-type"
                className="select"
                value={state.type}
                onChange={(e) => set('type', e.target.value as AcademyType)}
              >
                {ACADEMY_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ac-plan">
                Plan
              </label>
              <select
                id="ac-plan"
                className="select"
                value={state.plan}
                onChange={(e) =>
                  set('plan', e.target.value as AcademyPlan | '')
                }
              >
                <option value="">— Sin especificar —</option>
                {PLAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field--row">
            <div className="field">
              <label className="field__label" htmlFor="ac-currency">
                Moneda
              </label>
              <input
                id="ac-currency"
                className="input"
                value={state.currency}
                onChange={(e) => set('currency', e.target.value)}
                placeholder="MXN"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ac-country">
                País
              </label>
              <input
                id="ac-country"
                className="input"
                value={state.country}
                onChange={(e) => set('country', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="ac-timezone">
              Zona horaria
            </label>
            <input
              id="ac-timezone"
              className="input"
              value={state.timezone}
              onChange={(e) => set('timezone', e.target.value)}
              placeholder="America/Mexico_City"
            />
          </div>
        </section>

        <section className="config-section">
          <h3 className="form-section__title">Colores de marca</h3>
          <div className="config-row--compact">
            <div className="field field--color">
              <label className="field__label" htmlFor="ac-primary">
                Primario
              </label>
              <input
                id="ac-primary"
                className="input"
                type="color"
                value={state.primary_color}
                onChange={(e) => set('primary_color', e.target.value)}
              />
            </div>
            <div className="field field--color">
              <label className="field__label" htmlFor="ac-secondary">
                Secundario
              </label>
              <input
                id="ac-secondary"
                className="input"
                type="color"
                value={state.secondary_color}
                onChange={(e) => set('secondary_color', e.target.value)}
              />
            </div>
            <div className="field field--color">
              <label className="field__label" htmlFor="ac-accent">
                Acento
              </label>
              <input
                id="ac-accent"
                className="input"
                type="color"
                value={state.accent_color}
                onChange={(e) => set('accent_color', e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="config-section">
          <h3 className="form-section__title">Tarifas por hora</h3>
          <div className="field--row">
            <div className="field">
              <label className="field__label" htmlFor="ac-inst-rate">
                Tarifa instructor (por hora)
              </label>
              <input
                id="ac-inst-rate"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={state.default_instructor_hourly_rate}
                onChange={(e) =>
                  set('default_instructor_hourly_rate', e.target.value)
                }
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ac-asst-rate">
                Tarifa asistente (por hora)
              </label>
              <input
                id="ac-asst-rate"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={state.default_assistant_hourly_rate}
                onChange={(e) =>
                  set('default_assistant_hourly_rate', e.target.value)
                }
                placeholder="0.00"
              />
            </div>
          </div>
        </section>

        <section className="config-section">
          <h3 className="form-section__title">Cobros</h3>
          <div className="config-row--compact">
            <div className="field field--narrow">
              <label className="field__label" htmlFor="ac-billing-day">
                Día de cobro
              </label>
              <input
                id="ac-billing-day"
                className="input"
                type="number"
                min="1"
                max="28"
                value={state.default_billing_day}
                onChange={(e) => set('default_billing_day', e.target.value)}
                aria-invalid={!!errors.default_billing_day}
              />
              <span className="field__error">
                {errors.default_billing_day ?? ''}
              </span>
            </div>
            <div className="field field--narrow">
              <label className="field__label" htmlFor="ac-grace">
                Días de gracia
              </label>
              <input
                id="ac-grace"
                className="input"
                type="number"
                min="1"
                max="28"
                value={state.payment_grace_days}
                onChange={(e) => set('payment_grace_days', e.target.value)}
                aria-invalid={!!errors.payment_grace_days}
              />
              <span className="field__error">
                {errors.payment_grace_days ?? ''}
              </span>
            </div>
            <div className="field field--narrow">
              <label className="field__label" htmlFor="ac-lookahead">
                Meses de anticipación
              </label>
              <input
                id="ac-lookahead"
                className="input"
                type="number"
                min="0"
                value={state.billing_lookahead_months}
                onChange={(e) =>
                  set('billing_lookahead_months', e.target.value)
                }
              />
            </div>
          </div>

          <div className="field">
            <span className="field__hint" style={{ marginTop: -8 }}>
              Días de gracia: tras el día de cobro para pagar sin retraso
              (default 7).
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="ac-weekend">
              Si el día de cobro cae en fin de semana
            </label>
            <select
              id="ac-weekend"
              className="select"
              value={state.weekend_billing_behavior}
              onChange={(e) =>
                set(
                  'weekend_billing_behavior',
                  e.target.value as WeekendBillingBehavior | '',
                )
              }
            >
              <option value="">— Sin especificar —</option>
              {WEEKEND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="switch-row">
            <div>
              <div className="switch-row__label">Cobros automáticos</div>
              <div className="switch-row__hint">
                Genera los cobros recurrentes automáticamente.
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={state.auto_billing_enabled}
                onChange={(e) => set('auto_billing_enabled', e.target.checked)}
              />
              <span className="switch__track" aria-hidden="true" />
              <span className="switch__thumb" aria-hidden="true" />
            </label>
          </div>

          <div className="switch-row">
            <div>
              <div className="switch-row__label">
                Permitir que el estudiante se inscriba a clases
              </div>
              <div className="switch-row__hint">
                Si está desactivado, los estudiantes solo pueden ver las clases
                sin inscribirse.
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={state.students_self_enroll}
                onChange={(e) => set('students_self_enroll', e.target.checked)}
              />
              <span className="switch__track" aria-hidden="true" />
              <span className="switch__thumb" aria-hidden="true" />
            </label>
          </div>

          <div className="switch-row">
            <div>
              <div className="switch-row__label">
                Permitir que el estudiante se dé de baja de clases
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={state.students_self_unenroll}
                onChange={(e) =>
                  set('students_self_unenroll', e.target.checked)
                }
              />
              <span className="switch__track" aria-hidden="true" />
              <span className="switch__thumb" aria-hidden="true" />
            </label>
          </div>
        </section>

        <section className="config-section">
          <h3 className="form-section__title">Matrícula anual</h3>
          <div className="field">
            <label className="field__label" htmlFor="ac-fee-mode">
              Modalidad
            </label>
            <select
              id="ac-fee-mode"
              className="select"
              value={state.enrollment_fee_mode}
              onChange={(e) =>
                set(
                  'enrollment_fee_mode',
                  e.target.value as EnrollmentFeeMode | '',
                )
              }
            >
              <option value="">— Sin especificar —</option>
              {ENROLLMENT_FEE_MODES.map((m) => (
                <option key={m} value={m}>
                  {labelEnrollmentFeeMode(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="field--row">
            <div className="field">
              <label className="field__label" htmlFor="ac-fee-amount">
                Monto
              </label>
              <input
                id="ac-fee-amount"
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={state.enrollment_fee_amount}
                onChange={(e) => set('enrollment_fee_amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="ac-fee-month">
                Mes de cobro (anual)
              </label>
              <select
                id="ac-fee-month"
                className="select"
                value={state.enrollment_fee_month}
                onChange={(e) => set('enrollment_fee_month', e.target.value)}
                aria-invalid={!!errors.enrollment_fee_month}
              >
                <option value="">— Sin especificar —</option>
                {MONTHS_ES.map((label, i) => (
                  <option key={i} value={String(i + 1)}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="field__error">
                {errors.enrollment_fee_month ?? ''}
              </span>
            </div>
          </div>
        </section>

        <div className="form-actions form-actions--end">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving && <SpinnerIcon />}
            Guardar cambios
          </button>
        </div>
      </form>

      <PaymentAccountsSection onAccountsChanged={refreshMe} />

      <ConfirmModal
        open={confirmRemoveLogo}
        title="Quitar logo"
        message="¿Seguro que quieres quitar el logo de la academia? Se mostrará solo el nombre."
        confirmLabel="Quitar"
        danger
        loading={logoBusy}
        onConfirm={handleRemoveLogo}
        onCancel={() => setConfirmRemoveLogo(false)}
      />
    </Layout>
  );
}
