import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../auth';
import {
  ApiError,
  changeMyPassword,
  getMe,
  getUser,
  updateUser,
} from '../api';
import { SpinnerIcon } from '../brand';
import { labelPaymentMethod } from '../utils/salesLabels';
import type { PaymentMethod, UserRead, UserUpdate } from '../types';

const PAYMENT_METHODS: PaymentMethod[] = [
  'credit_card',
  'debit_card',
  'paypal',
  'bank_transfer',
  'cash',
  'other',
];

export default function StudentConfig() {
  const { me, setMe } = useAuth();

  const [profile, setProfile] = useState<UserRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [specialConditions, setSpecialConditions] = useState('');
  const [profileErrors, setProfileErrors] = useState<{
    first_name?: string;
    last_name?: string;
  }>({});
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<{
    current_password?: string;
    new_password?: string;
    new_password_confirm?: string;
  }>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getUser(me.id);
        if (cancelled) return;
        setProfile(data);
        setFirstName(data.first_name);
        setLastName(data.last_name);
        setPhone(data.phone ?? '');
        setAddress(data.address ?? '');
        setDob(data.date_of_birth ?? '');
        setPaymentMethod(data.payment_method ?? '');
        setSpecialConditions(data.special_conditions ?? '');
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Ocurrió un error, intenta de nuevo',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!me || !profile) return;

    const errs: { first_name?: string; last_name?: string } = {};
    if (!firstName.trim()) errs.first_name = 'Requerido';
    if (!lastName.trim()) errs.last_name = 'Requerido';
    setProfileErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingProfile(true);
    setError(null);
    try {
      const payload: UserUpdate = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        date_of_birth: dob || null,
        start_date: profile.start_date,
        payment_method: paymentMethod === '' ? null : paymentMethod,
        special_conditions: specialConditions.trim() || null,
        status: null,
      };
      const updated = await updateUser(me.id, payload);
      setProfile(updated);
      const fresh = await getMe();
      setMe(fresh);
      showToast('Cambios guardados');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: {
      current_password?: string;
      new_password?: string;
      new_password_confirm?: string;
    } = {};
    if (!currentPassword) errs.current_password = 'Requerido';
    if (!newPassword) errs.new_password = 'Requerido';
    else if (newPassword.length < 8) errs.new_password = 'Mínimo 8 caracteres';
    if (!newPasswordConfirm) errs.new_password_confirm = 'Requerido';
    else if (newPasswordConfirm !== newPassword)
      errs.new_password_confirm = 'No coincide';
    setPasswordErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSavingPassword(true);
    setPasswordError(null);
    try {
      await changeMyPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
      showToast('Contraseña actualizada');
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 400)
      ) {
        setPasswordError(
          'No se pudo actualizar la contraseña. Verifica tus datos.',
        );
      } else if (err instanceof ApiError) {
        setPasswordError(err.message);
      } else {
        setPasswordError('Ocurrió un error, intenta de nuevo');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Configuración">
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      </Layout>
    );
  }

  if (!me || !profile) {
    return (
      <Layout title="Configuración">
        <div className="alert" role="alert">
          {error ?? 'No se pudo cargar tu configuración.'}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Configuración">
      {error && (
        <div className="alert" role="alert">
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
        <form onSubmit={handleProfileSubmit} noValidate>
          <h3 className="form-section__title">Mi información</h3>

          <div className="field">
            <label className="field__label" htmlFor="first_name">
              Nombre
            </label>
            <input
              id="first_name"
              className="input"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (profileErrors.first_name)
                  setProfileErrors((er) => ({ ...er, first_name: undefined }));
              }}
              aria-invalid={!!profileErrors.first_name}
            />
            <span className="field__error">
              {profileErrors.first_name ?? ''}
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="last_name">
              Apellido
            </label>
            <input
              id="last_name"
              className="input"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (profileErrors.last_name)
                  setProfileErrors((er) => ({ ...er, last_name: undefined }));
              }}
              aria-invalid={!!profileErrors.last_name}
            />
            <span className="field__error">
              {profileErrors.last_name ?? ''}
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="phone">
              Teléfono
            </label>
            <input
              id="phone"
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="address">
              Dirección
            </label>
            <input
              id="address"
              className="input"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="dob">
              Fecha de nacimiento
            </label>
            <input
              id="dob"
              className="input"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="payment_method">
              Método de pago
            </label>
            <select
              id="payment_method"
              className="input"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod | '')
              }
            >
              <option value="">Sin especificar</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {labelPaymentMethod(pm)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="special_conditions">
              Condiciones especiales (alergias, contacto de emergencia, etc.)
            </label>
            <textarea
              id="special_conditions"
              className="input"
              rows={3}
              value={specialConditions}
              onChange={(e) => setSpecialConditions(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={savingProfile}
          >
            {savingProfile && <SpinnerIcon />}
            Guardar cambios
          </button>
        </form>
      </section>

      <section className="config-section">
        <form onSubmit={handlePasswordSubmit} noValidate>
          <h3 className="form-section__title">Cambiar contraseña</h3>

          {passwordError && (
            <div className="alert" role="alert">
              {passwordError}
            </div>
          )}

          <div className="field">
            <label className="field__label" htmlFor="current_password">
              Contraseña actual
            </label>
            <input
              id="current_password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (passwordErrors.current_password)
                  setPasswordErrors((er) => ({
                    ...er,
                    current_password: undefined,
                  }));
              }}
              aria-invalid={!!passwordErrors.current_password}
            />
            <span className="field__error">
              {passwordErrors.current_password ?? ''}
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="new_password">
              Nueva contraseña
            </label>
            <input
              id="new_password"
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (passwordErrors.new_password)
                  setPasswordErrors((er) => ({
                    ...er,
                    new_password: undefined,
                  }));
              }}
              aria-invalid={!!passwordErrors.new_password}
            />
            <span className="field__hint">Mínimo 8 caracteres</span>
            <span className="field__error">
              {passwordErrors.new_password ?? ''}
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="new_password_confirm">
              Confirmar nueva contraseña
            </label>
            <input
              id="new_password_confirm"
              className="input"
              type="password"
              autoComplete="new-password"
              value={newPasswordConfirm}
              onChange={(e) => {
                setNewPasswordConfirm(e.target.value);
                if (passwordErrors.new_password_confirm)
                  setPasswordErrors((er) => ({
                    ...er,
                    new_password_confirm: undefined,
                  }));
              }}
              aria-invalid={!!passwordErrors.new_password_confirm}
            />
            <span className="field__error">
              {passwordErrors.new_password_confirm ?? ''}
            </span>
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={savingPassword}
          >
            {savingPassword && <SpinnerIcon />}
            Actualizar contraseña
          </button>
        </form>
      </section>

      <section className="config-section">
        <h3 className="form-section__title">Mi cuenta</h3>
        <div className="detail-list">
          <div className="detail-item">
            <span className="detail-item__label">Email</span>
            <span
              className={
                'detail-item__value' +
                (me.email ? '' : ' detail-item__value--empty')
              }
            >
              {me.email ?? '—'}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-item__label">Academia</span>
            <span className="detail-item__value">{me.academy.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item__label">Rol</span>
            <span className="detail-item__value">Estudiante</span>
          </div>
        </div>
      </section>
    </Layout>
  );
}
