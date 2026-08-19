import { useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  AcademyMe,
  GroupPublic,
  PaymentMethod,
  UserCreate,
  UserListRead,
  UserRole,
  UserStatus,
  UserUpdate,
} from '../types';
import { ApiError } from '../api';
import { SpinnerIcon } from '../brand';
import GroupPicker from './GroupPicker';
import { formatMoney, toCents } from '../utils/money';
import { labelEnrollmentFeeMode } from '../utils/salesLabels';
import { hasStudentView, labelUserRole } from '../utils/roles';
import { consecutiveTakenMessage, emailTakenMessage } from '../utils/invites';
import { entryYear } from '../utils/users';
import UserDocumentsSection from './UserDocumentsSection';
import StudentDiscountsSection from './StudentDiscountsSection';
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

// Id del input de cada campo con error, para poder llevar al usuario hasta él
// desde el resumen. El resumen vive junto al botón de guardar: el error bajo el
// campo no sirve de nada si el campo quedó tres pantallas más arriba.
const FIELD_IDS: Record<string, string> = {
  first_name: 'uf-first',
  last_name: 'uf-last',
  role_consecutive: 'uf-consecutive',
  email: 'uf-email',
  tuition_amount: 'uf-tuition-amount',
  tuition_billing_day: 'uf-tuition-bday',
  tuition_start_date: 'uf-tuition-start',
};

// Orden en el que se listan los errores: el mismo del formulario, para que
// bajar por la lista sea bajar por la pantalla.
const FIELD_ORDER = [
  'first_name',
  'last_name',
  'email',
  'role_consecutive',
  'tuition_amount',
  'tuition_billing_day',
  'tuition_start_date',
];

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
  // Solo en edición: el consecutivo del rol, como texto para poder dejarlo
  // vacío mientras se escribe. Se valida y se convierte a entero al enviar.
  role_consecutive: string;
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
  role_consecutive: '',
  email: '',
  phone: '',
  address: '',
  date_of_birth: '',
  start_date: '',
  payment_method: '',
  special_conditions: '',
  status: 'active',
};

function fromUser(u: UserListRead): FormState {
  return {
    first_name: u.first_name,
    last_name: u.last_name,
    role_consecutive: String(u.role_consecutive ?? ''),
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
  user: UserListRead;
  onSubmit: (payload: UserUpdate) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  serverError: string | null;
  apiError: ApiError | null;
}

type UserFormProps = CreateProps | EditProps;

export default function UserForm(props: UserFormProps) {
  const { mode, onCancel, submitting, serverError, apiError } = props;

  // Rol seleccionado. En alta lo fija el módulo; en edición se puede cambiar
  // entre el rol base y el híbrido instructor_student (punto 1). El rol real del
  // usuario viene en `user.role` (pendiente en OpenAPI); si falta, cae al módulo.
  const [selectedRole, setSelectedRole] = useState<UserRole>(() =>
    mode === 'edit' ? props.user.role ?? props.role : props.role,
  );
  const effectiveRole: UserRole = mode === 'edit' ? selectedRole : props.role;

  // Opciones del selector: el rol base del módulo + el híbrido.
  const roleOptions: UserRole[] =
    props.role === 'instructor'
      ? ['instructor', 'instructor_student']
      : ['student', 'instructor_student'];

  // "Expediente" es como se llama en la academia y en la guía de terminología
  // del backend: es el correlativo en papel, no el `id` de la base.
  const consecutiveLabel = 'Expediente';

  const isStudent = props.role === 'student';
  const isStudentCreate = mode === 'create' && isStudent;
  // ¿Mostrar campos de estudiante (grupos, datos extra, descuentos)? El híbrido
  // también los tiene.
  const showsStudentFields = hasStudentView(effectiveRole);
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
      setSelectedRole(props.user.role ?? props.role);
    }
  }, [mode, mode === 'edit' ? props.user : null]);

  // El resumen de errores, para llevarlo a la vista cuando el fallo no cuelga de
  // ningún campo (un 500, por ejemplo) y no hay a dónde saltar.
  const summaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!apiError) return;
    if (apiError.fieldErrors) {
      setErrors((prev) => ({ ...prev, ...apiError.fieldErrors }));
    }
    // Correo repetido (es único en todo el sistema, no por academia): se marca
    // en el campo para corregirlo sin perder el resto del formulario.
    const taken = emailTakenMessage(apiError);
    if (taken) {
      setErrors((prev) => ({ ...prev, email: taken }));
    }
    // Mismo trato para el número repetido: el candado vive en el mismo PATCH,
    // así que el error se marca en su campo en vez de cerrar el panel.
    const numberTaken = consecutiveTakenMessage(apiError);
    if (numberTaken) {
      setErrors((prev) => ({ ...prev, role_consecutive: numberTaken }));
    }
    // El rechazo llega después de pulsar Guardar, con el botón a la vista y el
    // campo culpable donde sea: hay que ir hasta él.
    const serverKeys = [
      ...Object.keys(apiError?.fieldErrors ?? {}),
      ...(taken ? ['email'] : []),
      ...(numberTaken ? ['role_consecutive'] : []),
    ];
    const firstServerKey = firstErrorKey(serverKeys.filter((k) => FIELD_IDS[k]));
    if (firstServerKey) focusField(firstServerKey);
    else
      summaryRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
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

  const fieldLabels: Record<string, string> = {
    first_name: 'Nombre',
    last_name: 'Apellido',
    email: 'Email',
    role_consecutive: consecutiveLabel,
    tuition_amount: 'Monto de la mensualidad',
    tuition_billing_day: 'Día de cobro',
    tuition_start_date: 'Inicio del cobro',
  };

  // Campos en falta, ordenados como aparecen en pantalla. Los que no conocemos
  // (errores por campo que mande el backend) van al final con su clave.
  const errorKeys = Object.keys(errors).filter((k) => errors[k]);
  const summaryKeys = [
    ...FIELD_ORDER.filter((k) => errorKeys.includes(k)),
    ...errorKeys.filter((k) => !FIELD_ORDER.includes(k)),
  ];

  // El listado pinta el número prefijado con el año de ingreso ("2025-839"), y
  // el campo solo edita la segunda mitad: la pista muestra cómo va quedando.
  const consecutiveYear = mode === 'edit' ? entryYear(props.user) : null;
  const consecutiveHint =
    consecutiveYear && state.role_consecutive.trim()
      ? `Se verá como ${consecutiveYear}-${state.role_consecutive.trim()}. No puede repetirse en la academia.`
      : 'No puede repetirse dentro de la academia.';

  // Lleva la vista y el foco al campo que falló. Sin esto, un error en un campo
  // que quedó fuera de pantalla es indistinguible de "el botón no hace nada".
  const focusField = (key: string) => {
    const el = document.getElementById(FIELD_IDS[key] ?? '');
    if (!el) return;
    // Solo se desplaza si el campo no está ya a la vista: dar un salto cuando el
    // campo se veía desde el principio desorienta más de lo que ayuda.
    const box = el.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    el.focus({ preventScroll: true });
  };

  // Primer campo con error siguiendo el orden del formulario.
  const firstErrorKey = (keys: string[]): string | undefined =>
    FIELD_ORDER.find((k) => keys.includes(k)) ?? keys[0];

  const collectErrors = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!state.first_name.trim()) next.first_name = 'Requerido';
    if (!state.last_name.trim()) next.last_name = 'Requerido';
    const email = state.email.trim();
    if (email && !EMAIL_RE.test(email)) {
      next.email = 'Email inválido';
    }
    // Vaciar el correo de quien ya inicia sesión le quitaría el acceso: el
    // backend lo rechaza con 422, así que se corta aquí con un mensaje claro.
    if (mode === 'edit' && !email && props.user.has_access) {
      next.email = 'No se puede quitar el correo de alguien que ya entra a la plataforma';
    }
    if (mode === 'edit') {
      const raw = state.role_consecutive.trim();
      const n = Number(raw);
      if (!raw) next.role_consecutive = 'Requerido';
      else if (!Number.isInteger(n) || n < 1)
        next.role_consecutive = 'Número entero mayor a cero';
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
    return next;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const found = collectErrors();
    setErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      const first = firstErrorKey(keys);
      if (first) focusField(first);
      return;
    }

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
        ...(showsStudentFields ? studentExtraToPayload(extra) : {}),
        ...(showsStudentFields ? { groups } : {}),
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
        // Solo enviamos role si cambió respecto al rol original del usuario.
        // Requiere que el backend acepte `role` en UserUpdate (ver types.ts).
        ...(selectedRole !== (props.user.role ?? props.role)
          ? { role: selectedRole }
          : {}),
        // Igual que el correo: solo viaja si cambió, para que un PATCH normal no
        // choque contra el candado de números repetidos por reenviar el propio.
        ...(Number(state.role_consecutive.trim()) !== props.user.role_consecutive
          ? { role_consecutive: Number(state.role_consecutive.trim()) }
          : {}),
        // Solo se manda si cambió: omitir la clave deja el correo intacto, y así
        // un PATCH normal nunca arriesga tocarlo. Vacío viaja como `null`, nunca
        // como cadena vacía (el backend la rechaza).
        ...(nullable(state.email) !== (props.user.email ?? null)
          ? { email: nullable(state.email) }
          : {}),
        phone: nullable(state.phone),
        address: nullable(state.address),
        date_of_birth: nullable(state.date_of_birth),
        start_date: nullable(state.start_date),
        payment_method: state.payment_method === '' ? null : state.payment_method,
        special_conditions: nullable(state.special_conditions),
        status: state.status as UserStatus,
        ...(showsStudentFields ? studentExtraToPayload(extra) : {}),
        ...(showsStudentFields ? { groups } : {}),
      };
      await props.onSubmit(payload);
    }
  };

  return (
    <form id="user-form" onSubmit={handleSubmit} noValidate>
      {/* El aviso de error vive solo junto a los botones, al final: es donde
          está el usuario cuando pulsa Guardar. Aquí arriba salía además del de
          abajo, y un fallo genérico se leía dos veces en el mismo panel. */}
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
        <span className="field__hint">
          {mode === 'create'
            ? 'Opcional. Se puede agregar después, cuando se le dé acceso a la plataforma.'
            : 'Guardar aquí solo corrige el dato: no manda ningún correo. Para que entre a la plataforma usa "Invitar".'}
        </span>
        <span className="field__error">{errors.email ?? ''}</span>
      </div>

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

      {mode === 'edit' && (
        <div className="field--row">
          <div className="field">
            <label className="field__label" htmlFor="uf-role">
              Rol
            </label>
            <select
              id="uf-role"
              className="select"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {labelUserRole(r)}
                </option>
              ))}
            </select>
            <span
              className="field__hint"
              style={{ color: 'var(--color-text-muted)' }}
            >
              El híbrido imparte clases y a la vez es alumno.
            </span>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="uf-consecutive">
              {consecutiveLabel}
            </label>
            <input
              id="uf-consecutive"
              className="input"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={state.role_consecutive}
              onChange={(e) => set('role_consecutive', e.target.value)}
              aria-invalid={!!errors.role_consecutive}
            />
            <span className="field__hint">{consecutiveHint}</span>
            <span className="field__error">
              {errors.role_consecutive ?? ''}
            </span>
          </div>
        </div>
      )}

      {showsStudentFields && (
        <StudentExtraFields value={extra} onChange={setExtra} idPrefix="uf" />
      )}

      {showsStudentFields && (
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

      {mode === 'edit' && showsStudentFields && (
        <StudentDiscountsSection userId={props.user.id} />
      )}

      {mode === 'edit' && (
        <UserDocumentsSection userId={props.user.id} editable />
      )}

      {/* Resumen pegado al botón: es donde está el usuario cuando pulsa Guardar,
          y el error del campo puede haber quedado fuera de pantalla. */}
      {(summaryKeys.length > 0 || serverError) && (
        <div
          className="alert"
          role="alert"
          ref={summaryRef}
          style={{ marginTop: 16 }}
        >
          <strong>No se pudo guardar.</strong>
          {summaryKeys.length > 0 ? (
            <ul className="alert__list">
              {summaryKeys.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    className="alert__field"
                    onClick={() => focusField(k)}
                  >
                    {fieldLabels[k] ?? k}
                  </button>
                  : {errors[k]}
                </li>
              ))}
            </ul>
          ) : (
            <span> {serverError}</span>
          )}
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
