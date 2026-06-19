import { useEffect, useState, type FormEvent } from 'react';
import type {
  AcademyMe,
  GroupPublic,
  PaymentMethod,
  UserCreate,
  UserRead,
  UserRole,
  UserStatus,
  UserUpdate,
} from '../types';
import { ApiError } from '../api';
import { SpinnerIcon } from '../brand';
import GroupPicker from './GroupPicker';
import { formatMoney, toCents } from '../utils/money';
import { labelEnrollmentFeeMode } from '../utils/salesLabels';
import StudentExtraFields, {
  EMPTY_STUDENT_EXTRA,
  studentExtraFromUser,
  studentExtraToPayload,
  type StudentExtra,
} from './StudentExtraFields';

export interface StudentBillingSetup {
  createTuition: boolean;
  tuitionAmount: number | null;
  tuitionBillingDay: number | null;
  tuitionStartDate: string | null;
  createEnrollment: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'debit_card', label: 'Tarjeta de débito' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'bank_transfer', label: 'Transferencia bancaria' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'other', label: 'Otro' },
];

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  date_of_birth: string;
  start_date: string;
  payment_method: PaymentMethod | '';
  special_conditions: string;
  status: 'active' | 'inactive';
}

const EMPTY: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  date_of_birth: '',
  start_date: '',
  payment_method: '',
  special_conditions: '',
  status: 'active',
};

function fromUser(u: UserRead): FormState {
  return {
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email ?? '',
    phone: u.phone ?? '',
    address: u.address ?? '',
    date_of_birth: u.date_of_birth ?? '',
    start_date: u.start_date ?? '',
    payment_method: u.payment_method ?? '',
    special_conditions: u.special_conditions ?? '',
    status: u.status === 'inactive' ? 'inactive' : 'active',
  };
}

const nullable = (s: string): string | null => {
  const t = s.trim();
  return t === '' ? null : t;
};

interface CreateProps {
  mode: 'create';
  role: UserRole;
  academy?: AcademyMe;
  onSubmit: (
    payload: UserCreate,
    billing?: StudentBillingSetup,
  ) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

interface EditProps {
  mode: 'edit';
  role: UserRole;
  user: UserRead;
  onSubmit: (payload: UserUpdate) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

type UserFormProps = CreateProps | EditProps;

export default function UserForm(props: UserFormProps) {
  const { mode, onCancel, submitting, serverError, apiError } = props;

  const isStudent = props.role === 'student';
  const isStudentCreate = mode === 'create' && isStudent;
  const academy: AcademyMe | undefined =
    mode === 'create' ? props.academy : undefined;
  const currency = academy?.currency ?? null;

  const showEnrollmentBlock =
    isStudentCreate &&
    !!academy &&
    !!academy.enrollment_fee_mode &&
    academy.enrollment_fee_mode !== 'none' &&
    !!academy.enrollment_fee_amount;

  const [state, setState] = useState<FormState>(() =>
    mode === 'edit' ? fromUser(props.user) : EMPTY,
  );
  const [extra, setExtra] = useState<StudentExtra>(() =>
    mode === 'edit' ? studentExtraFromUser(props.user) : EMPTY_STUDENT_EXTRA,
  );
  const [groups, setGroups] = useState<GroupPublic[]>(() =>
    mode === 'edit' ? props.user.groups ?? [] : [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [billingOpen, setBillingOpen] = useState<boolean>(
    () => !!(isStudentCreate && academy?.default_billing_day),
  );
  const [createTuition, setCreateTuition] = useState<boolean>(
    () => !!(isStudentCreate && academy?.default_billing_day),
  );
  const [tuitionAmount, setTuitionAmount] = useState<string>('');
  const [tuitionBillingDay, setTuitionBillingDay] = useState<string>(() =>
    String(academy?.default_billing_day ?? 1),
  );
  const [tuitionStartDate, setTuitionStartDate] =
    useState<string>(todayIso());
  const [createEnrollment, setCreateEnrollment] = useState<boolean>(
    () => showEnrollmentBlock,
  );

  useEffect(() => {
    if (mode === 'edit') {
      setState(fromUser(props.user));
      setExtra(studentExtraFromUser(props.user));
      setGroups(props.user.groups ?? []);
    }
  }, [mode, mode === 'edit' ? props.user : null]);

  useEffect(() => {
    if (apiError?.fieldErrors) {
      setErrors((prev) => ({ ...prev, ...apiError.fieldErrors }));
    }
  }, [apiError]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setState((s) => ({ ...s, [k]: v }));
    if (errors[k as string]) {
      setErrors((er) => {
        const next = { ...er };
        delete next[k as string];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!state.first_name.trim()) next.first_name = 'Requerido';
    if (!state.last_name.trim()) next.last_name = 'Requerido';
    if (mode === 'create' && state.email.trim() && !EMAIL_RE.test(state.email)) {
      next.email = 'Email inválido';
    }
    if (isStudentCreate && createTuition) {
      const amt = parseFloat(tuitionAmount);
      if (!tuitionAmount || Number.isNaN(amt) || amt <= 0) {
        next.tuition_amount = 'Monto mayor a cero';
      }
      const bd = parseInt(tuitionBillingDay, 10);
      if (!tuitionBillingDay || Number.isNaN(bd) || bd < 1 || bd > 28) {
        next.tuition_billing_day = 'Entre 1 y 28';
      }
      if (!tuitionStartDate) next.tuition_start_date = 'Requerido';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (mode === 'create') {
      const payload: UserCreate = {
        first_name: state.first_name.trim(),
        last_name: state.last_name.trim(),
        role: props.role,
        email: nullable(state.email),
        phone: nullable(state.phone),
        address: nullable(state.address),
        date_of_birth: nullable(state.date_of_birth),
        start_date: nullable(state.start_date),
        payment_method: state.payment_method === '' ? null : state.payment_method,
        special_conditions: nullable(state.special_conditions),
        ...(isStudent ? studentExtraToPayload(extra) : {}),
        ...(isStudent ? { groups } : {}),
      };
      const billing: StudentBillingSetup | undefined = isStudentCreate
        ? {
            createTuition,
            tuitionAmount: createTuition ? toCents(tuitionAmount) : null,
            tuitionBillingDay: createTuition
              ? parseInt(tuitionBillingDay, 10)
              : null,
            tuitionStartDate: createTuition ? tuitionStartDate : null,
            createEnrollment: showEnrollmentBlock && createEnrollment,
          }
        : undefined;
      await props.onSubmit(payload, billing);
    } else {
      const payload: UserUpdate = {
        first_name: state.first_name.trim(),
        last_name: state.last_name.trim(),
        phone: nullable(state.phone),
        address: nullable(state.address),
        date_of_birth: nullable(state.date_of_birth),
        start_date: nullable(state.start_date),
        payment_method: state.payment_method === '' ? null : state.payment_method,
        special_conditions: nullable(state.special_conditions),
        status: state.status as UserStatus,
        ...(isStudent ? studentExtraToPayload(extra) : {}),
        ...(isStudent ? { groups } : {}),
      };
      await props.onSubmit(payload);
    }
  };

  return (
    <form id="user-form" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <div className="alert" role="alert">
          {serverError}
        </div>
      )}

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="uf-first">
            Nombre <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="uf-first"
            className="input"
            value={state.first_name}
            onChange={(e) => set('first_name', e.target.value)}
            aria-invalid={!!errors.first_name}
            autoFocus
          />
          <span className="field__error">{errors.first_name ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="uf-last">
            Apellido <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            id="uf-last"
            className="input"
            value={state.last_name}
            onChange={(e) => set('last_name', e.target.value)}
            aria-invalid={!!errors.last_name}
          />
          <span className="field__error">{errors.last_name ?? ''}</span>
        </div>
      </div>

      {mode === 'create' && (
        <div className="field">
          <label className="field__label" htmlFor="uf-email">
            Email
          </label>
          <input
            id="uf-email"
            className="input"
            type="email"
            value={state.email}
            onChange={(e) => set('email', e.target.value)}
            aria-invalid={!!errors.email}
            placeholder="opcional"
          />
          <span className="field__error">{errors.email ?? ''}</span>
        </div>
      )}

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="uf-phone">
            Teléfono
          </label>
          <input
            id="uf-phone"
            className="input"
            value={state.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
          <span className="field__error">{errors.phone ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="uf-dob">
            Fecha de nacimiento
          </label>
          <input
            id="uf-dob"
            className="input"
            type="date"
            value={state.date_of_birth}
            onChange={(e) => set('date_of_birth', e.target.value)}
          />
          <span className="field__error">{errors.date_of_birth ?? ''}</span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="uf-address">
          Dirección
        </label>
        <input
          id="uf-address"
          className="input"
          value={state.address}
          onChange={(e) => set('address', e.target.value)}
        />
        <span className="field__error">{errors.address ?? ''}</span>
      </div>

      <div className="field--row">
        <div className="field">
          <label className="field__label" htmlFor="uf-start">
            Fecha de inicio
          </label>
          <input
            id="uf-start"
            className="input"
            type="date"
            value={state.start_date}
            onChange={(e) => set('start_date', e.target.value)}
          />
          <span className="field__error">{errors.start_date ?? ''}</span>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="uf-pay">
            Método de pago
          </label>
          <select
            id="uf-pay"
            className="select"
            value={state.payment_method}
            onChange={(e) =>
              set('payment_method', e.target.value as PaymentMethod | '')
            }
          >
            <option value="">— Selecciona —</option>
            {PAYMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="field__error">{errors.payment_method ?? ''}</span>
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="uf-special">
          Condiciones especiales
        </label>
        <textarea
          id="uf-special"
          className="textarea"
          value={state.special_conditions}
          onChange={(e) => set('special_conditions', e.target.value)}
          placeholder="Alergias, lesiones, notas relevantes…"
        />
        <span className="field__error">{errors.special_conditions ?? ''}</span>
      </div>

      {isStudent && (
        <StudentExtraFields value={extra} onChange={setExtra} idPrefix="uf" />
      )}

      {isStudent && (
        <div className="field">
          <span className="field__label">Grupos</span>
          <GroupPicker value={groups} onChange={setGroups} />
        </div>
      )}

      {mode === 'edit' && (
        <div className="field">
          <label className="field__label" htmlFor="uf-status">
            Estado
          </label>
          <select
            id="uf-status"
            className="select"
            value={state.status}
            onChange={(e) =>
              set('status', e.target.value as 'active' | 'inactive')
            }
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
          <span className="field__error">{errors.status ?? ''}</span>
        </div>
      )}

      {isStudentCreate && academy && (
        <div className="collapsible" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="collapsible__header"
            onClick={() => setBillingOpen((v) => !v)}
            aria-expanded={billingOpen}
          >
            Configuración de cobros
            <span aria-hidden="true">{billingOpen ? '−' : '+'}</span>
          </button>
          <div
            className={
              'collapsible__body' + (billingOpen ? '' : ' collapsible__body--hidden')
            }
          >
            <div className="switch-row">
              <div>
                <div className="switch-row__label">Crear cobro mensual</div>
                <div className="switch-row__hint">
                  Mensualidad recurrente para este estudiante.
                </div>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={createTuition}
                  onChange={(e) => setCreateTuition(e.target.checked)}
                />
                <span className="switch__track" aria-hidden="true" />
                <span className="switch__thumb" aria-hidden="true" />
              </label>
            </div>

            {createTuition && (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="uf-tuition-amount">
                    Monto mensual{' '}
                    <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="uf-tuition-amount"
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={tuitionAmount}
                    onChange={(e) => setTuitionAmount(e.target.value)}
                    aria-invalid={!!errors.tuition_amount}
                    placeholder="0.00"
                  />
                  <span className="field__error">
                    {errors.tuition_amount ?? ''}
                  </span>
                </div>

                <div className="field--row">
                  <div className="field">
                    <label
                      className="field__label"
                      htmlFor="uf-tuition-bday"
                    >
                      Día de cobro{' '}
                      <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      id="uf-tuition-bday"
                      className="input"
                      type="number"
                      min="1"
                      max="28"
                      value={tuitionBillingDay}
                      onChange={(e) => setTuitionBillingDay(e.target.value)}
                      aria-invalid={!!errors.tuition_billing_day}
                    />
                    <span className="field__error">
                      {errors.tuition_billing_day ?? ''}
                    </span>
                  </div>

                  <div className="field">
                    <label
                      className="field__label"
                      htmlFor="uf-tuition-start"
                    >
                      Fecha de inicio{' '}
                      <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      id="uf-tuition-start"
                      className="input"
                      type="date"
                      value={tuitionStartDate}
                      onChange={(e) => setTuitionStartDate(e.target.value)}
                      aria-invalid={!!errors.tuition_start_date}
                    />
                    <span className="field__error">
                      {errors.tuition_start_date ?? ''}
                    </span>
                  </div>
                </div>
              </>
            )}

            {showEnrollmentBlock && academy.enrollment_fee_mode && (
              <>
                <div
                  className="switch-row"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  <div>
                    <div className="switch-row__label">Cobrar matrícula anual</div>
                    <div className="switch-row__hint">
                      {labelEnrollmentFeeMode(academy.enrollment_fee_mode)}
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={createEnrollment}
                      onChange={(e) => setCreateEnrollment(e.target.checked)}
                    />
                    <span className="switch__track" aria-hidden="true" />
                    <span className="switch__thumb" aria-hidden="true" />
                  </label>
                </div>

                {createEnrollment && (
                  <p
                    className="field__hint"
                    style={{ marginTop: 8, color: 'var(--color-text-muted)' }}
                  >
                    {academy.enrollment_fee_mode === 'annual_recurring'
                      ? `Cuota anual de ${formatMoney(
                          academy.enrollment_fee_amount,
                          currency,
                        )} cada ${
                          academy.enrollment_fee_month
                            ? MONTHS_ES[academy.enrollment_fee_month - 1]
                            : '—'
                        }.`
                      : `Cobro único de ${formatMoney(
                          academy.enrollment_fee_amount,
                          currency,
                        )} al inscribir.`}
                  </p>
                )}
              </>
            )}
          </div>
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
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting}
        >
          {submitting && <SpinnerIcon />}
          {mode === 'create' ? 'Crear' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
