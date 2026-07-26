import { useEffect, useState, type FormEvent } from 'react';
import type {
  PaymentAccountCreate,
  PaymentAccountRead,
  PaymentAccountUpdate,
  PaymentEnvironment,
} from '../types';
import { ApiError } from '../api';
import { SpinnerIcon, WarningIcon } from '../brand';
import { formatDateTime } from '../utils/finance';

const ENVIRONMENT_OPTIONS: { value: PaymentEnvironment; label: string }[] = [
  { value: 'sandbox', label: 'Sandbox (pruebas)' },
  { value: 'production', label: 'Producción' },
];

interface PaymentAccountFormProps {
  mode: 'create' | 'edit';
  account?: PaymentAccountRead;
  onSubmit: (payload: PaymentAccountCreate | PaymentAccountUpdate) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
  // Solo en edición: abre el cobro de prueba de $1. Si no se pasa, no hay botón.
  onTest?: () => void;
}

export default function PaymentAccountForm({
  mode,
  account,
  onSubmit,
  onCancel,
  submitting,
  serverError,
  apiError,
  onTest,
}: PaymentAccountFormProps) {
  const [displayName, setDisplayName] = useState(account?.display_name ?? '');
  const [environment, setEnvironment] = useState<PaymentEnvironment>(
    account?.environment ?? 'sandbox',
  );
  const [publicToken, setPublicToken] = useState('');
  const [isDefault, setIsDefault] = useState(account?.is_default ?? false);
  const [isActive, setIsActive] = useState(account?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (apiError?.fieldErrors) {
      setErrors((prev) => ({ ...prev, ...apiError.fieldErrors }));
    }
  }, [apiError]);

  // La cuenta pasó un cobro de prueba completado en algún momento.
  const verified = !!account?.last_tested_at;

  // La prueba cobra con el token que ya está guardado en el servidor, así que
  // con cambios pendientes (sobre todo un token nuevo) probaría el anterior.
  const dirty =
    !!account &&
    (displayName.trim() !== (account.display_name ?? '') ||
      environment !== account.environment ||
      isDefault !== account.is_default ||
      isActive !== account.is_active ||
      publicToken.trim() !== '');

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    // En alta el public token es obligatorio. En edición, dejarlo vacío conserva
    // el token actual (el backend nunca lo devuelve, solo el enmascarado).
    if (mode === 'create' && !publicToken.trim()) {
      next.public_token = 'Requerido';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const token = publicToken.trim();
    if (mode === 'create') {
      const payload: PaymentAccountCreate = {
        provider: 'ath_movil',
        display_name: displayName.trim() || null,
        environment,
        is_default: isDefault,
        credentials: { public_token: token },
      };
      await onSubmit(payload);
    } else {
      const payload: PaymentAccountUpdate = {
        display_name: displayName.trim() || null,
        environment,
        is_default: isDefault,
        is_active: isActive,
        // Solo reenviar credentials si el usuario escribió un token nuevo.
        ...(token ? { credentials: { public_token: token } } : {}),
      };
      await onSubmit(payload);
    }
  };

  const tokenPlaceholder =
    mode === 'edit' && account?.public_token_masked
      ? `Actual: ${account.public_token_masked} — deja vacío para conservarlo`
      : 'Public token de ATH Móvil';

  return (
    <form onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert" role="alert">
          {serverError}
        </div>
      )}

      <div className="field">
        <label className="field__label">Proveedor</label>
        <input className="input" value="ATH Móvil" disabled readOnly />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="pa-name">
          Nombre para mostrar
        </label>
        <input
          id="pa-name"
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="opcional"
          aria-invalid={!!errors.display_name}
        />
        <span className="field__error">{errors.display_name ?? ''}</span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="pa-env">
          Entorno
        </label>
        <select
          id="pa-env"
          className="select"
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as PaymentEnvironment)}
        >
          {ENVIRONMENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="pa-token">
          Public token{' '}
          {mode === 'create' && (
            <span style={{ color: 'var(--color-danger)' }}>*</span>
          )}
        </label>
        <input
          id="pa-token"
          className="input"
          value={publicToken}
          onChange={(e) => setPublicToken(e.target.value)}
          placeholder={tokenPlaceholder}
          autoComplete="off"
          aria-invalid={!!errors.public_token}
        />
        <span className="field__error">{errors.public_token ?? ''}</span>
      </div>

      {mode === 'edit' && onTest && (
        <div className="field">
          <div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={onTest}
              disabled={submitting || dirty}
            >
              Probar cuenta con un cobro de $1
            </button>
          </div>
          <span className="field__hint">
            {dirty
              ? 'Guarda los cambios antes de probar: la prueba usa el token ya guardado.'
              : verified
                ? `Verificada el ${formatDateTime(account?.last_tested_at)}. Puedes repetir la prueba cuando quieras.`
                : 'Envía un cobro real de $1.00 a un número de ATH Móvil para confirmar que el token funciona.'}
          </span>
        </div>
      )}

      <div className="switch-row">
        <div>
          <div className="switch-row__label">Cuenta predeterminada</div>
          <div className="switch-row__hint">
            Se usará por defecto para los cobros. Solo puede haber una.
          </div>
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          <span className="switch__track" aria-hidden="true" />
          <span className="switch__thumb" aria-hidden="true" />
        </label>
      </div>

      {isDefault && !verified && !account?.is_default && (
        <div className="alert alert--warning" role="note">
          <span className="alert__head">
            <WarningIcon size={16} /> Esta cuenta no está verificada
          </span>
          <ul className="alert__list">
            <li>
              Si el public token está mal, todos los cobros de la academia
              fallarán.{' '}
              {onTest
                ? 'Haz el cobro de prueba de $1 antes de dejarla predeterminada.'
                : 'Al terminar, entra a editar esta cuenta y haz el cobro de prueba de $1.'}
            </li>
          </ul>
        </div>
      )}

      {mode === 'edit' && (
        <div className="switch-row">
          <div>
            <div className="switch-row__label">Activa</div>
            <div className="switch-row__hint">
              Si está inactiva no se podrá cobrar con esta cuenta.
            </div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <span className="switch__track" aria-hidden="true" />
            <span className="switch__thumb" aria-hidden="true" />
          </label>
        </div>
      )}

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
          {mode === 'create' ? 'Crear cuenta' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
