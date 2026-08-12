import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import ConfirmModal from '../components/ConfirmModal';
import { StatusBadge } from '../components/Badges';
import UserForm, { type StudentBillingSetup } from '../components/UserForm';
import InviteForm from '../components/InviteForm';
import InviteAccessForm from '../components/InviteAccessForm';
import InviteResult from '../components/InviteResult';
import UserDetails from '../components/UserDetails';
import RegisterPaymentForm from '../components/RegisterPaymentForm';
import RecurringForm from '../components/RecurringForm';
import AnnouncementComposer from '../components/AnnouncementComposer';
import { useAuth } from '../auth';
import {
  ApiError,
  createRecurringTransaction,
  createTransaction,
  createUser,
  deleteUser,
  getFinancePayroll,
  getToken,
  getTransactionsSummary,
  getUser,
  inviteExistingUser,
  inviteUser,
  listUsers,
  restoreUser,
  suggestDebtReminder,
  updateRecurringTransaction,
  updateTransaction,
  updateUser,
} from '../api';
import type {
  AnnouncementCreate,
  Debt,
  FinancePayrollKpis,
  RecurringTransactionCreate,
  RecurringTransactionRead,
  RecurringTransactionUpdate,
  TransactionCategory,
  TransactionRead,
  TransactionUpdate,
  TransactionUserRead,
  UserConflict,
  UserCreate,
  UserInvite,
  UserListRead,
  UserRead,
  UserRole,
  UserStatus,
  UserUpdate,
} from '../types';
import {
  CheckIcon,
  EyeIcon,
  KeyIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  RestoreIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from '../brand';
import { formatMoney } from '../utils/money';
import { formatDateTimeShort } from '../utils/dates';
import { conflictCode, conflictUser } from '../utils/invites';
import ConflictNotice from '../components/ConflictNotice';
import Paginator from '../components/Paginator';
import KpiCard from '../components/charts/KpiCard';

interface UsersModuleProps {
  role: UserRole;
  pageTitle: string;
  summaryLabel: string;
  inviteButtonLabel: string;
  createButtonLabel: string;
  inviteTitle: string;
  createTitle: string;
  editTitle: string;
  viewTitle: string;
  showDebtColumns?: boolean;
  debtFilter?: Debt | null;
  onDebtFilterChange?: (d: Debt | null) => void;
  // Filtro por mes de matrícula anual (1-12). Si se pasa el handler, se muestra.
  enrollmentMonthFilter?: number | null;
  onEnrollmentMonthFilterChange?: (m: number | null) => void;
}

// 'deleted' no es un `status`: son las fichas archivadas por el borrado suave
// (`is_active = false`), invisibles en los otros cuatro filtros —"Inactivos"
// filtra por estado en la academia, no por borrado—. Se piden con `active=false`
// y solo las ve un admin, que es quien puede reactivarlas.
type Filter = UserStatus | 'all' | 'deleted';

// Casi todos los paneles se abren desde una fila del listado, que es un
// `UserListRead`. Solo 'view' exige la ficha entera: el detalle pinta los cobros
// pendientes, que el listado ya no trae, así que se pide al abrirlo.
type PanelState =
  | { kind: 'invite' }
  // Invitar a alguien que ya existe en la academia (con o sin correo en su
  // ficha). Distinto de 'invite', que además crea al usuario.
  | { kind: 'invite-existing'; user: UserListRead }
  | { kind: 'create' }
  | { kind: 'edit'; user: UserListRead }
  | { kind: 'view'; user: UserRead }
  | { kind: 'pay'; user: UserListRead; tx: TransactionRead }
  | { kind: 'rec-create'; user: UserListRead; category: TransactionCategory }
  | { kind: 'rec-edit'; user: UserListRead; rec: RecurringTransactionRead }
  | null;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
];

const DELETED_FILTER: { value: Filter; label: string } = {
  value: 'deleted',
  label: 'Eliminados',
};

// Tamaño de página. El backend acepta de 1 a 200 y responde 422 por encima.
const PAGE_SIZE = 100;

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

/**
 * Leyenda del mes de cobro de la matrícula anual **del estudiante** (campos de
 * la fila del listado, no de la academia: esa solo decide si los cargos se
 * crean en automático). `null` → no se muestra segunda línea.
 */
function enrollmentFeeNoteFor(u: UserListRead): string | null {
  if (u.enrollment_fee_mode === 'one_time_on_signup')
    return 'Pago único al inscribir';
  if (u.enrollment_fee_mode === 'none') return null;
  const m = u.enrollment_fee_month;
  if (m == null || m < 1 || m > 12) return null;
  return `Cobro en ${MONTHS_ES[m - 1].toLowerCase()}`;
}

/**
 * Texto de la acción de invitar. `has_access` decide si se muestra; el texto
 * sale de si ya se le mandó algo antes (`status === 'pending'` con correo) y de
 * si hay correo al que mandarlo.
 */
function inviteRowLabel(u: UserListRead): string {
  if (!u.email) return 'Agregar correo e invitar';
  return u.status === 'pending'
    ? 'Reenviar invitación'
    : 'Invitar a la plataforma';
}

const DEBT_OPTIONS: { value: Debt | ''; label: string }[] = [
  { value: '', label: 'Todos los cobros' },
  { value: 'none', label: 'Al corriente' },
  { value: 'any', label: 'Con deuda' },
  { value: 'tuition', label: 'Deuda mensualidad' },
  { value: 'enrollment_fee', label: 'Deuda matrícula anual' },
];

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function formatDateShort(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

/**
 * Número de estudiante con el año de ingreso como prefijo (p. ej. "2025-839").
 * Usa `entry_year` del backend y, si viene vacío, lo deriva de `start_date`.
 * Sin año disponible se muestra solo el consecutivo.
 */
function studentNumber(u: UserListRead): string | null {
  if (u.role_consecutive == null) return null;
  const year = u.entry_year ?? yearOf(u.start_date);
  return year ? `${year}-${u.role_consecutive}` : String(u.role_consecutive);
}

function yearOf(value: string | null): number | null {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}

const DEFAULT_GRACE_DAYS = 7;

/**
 * Ventana de pago a partir del día de cobro (día de `next_due_date`) más los
 * días de gracia de la academia. Ej. día 1 con gracia 7 → "1–7".
 */
function paymentWindow(
  nextDueDate: string | null,
  graceDays: number,
): string | null {
  if (!nextDueDate) return null;
  const d = new Date(nextDueDate + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  const start = d.getDate();
  const end = start + Math.max(1, graceDays) - 1;
  return `${start}–${end}`;
}

function pendingToTransactionRead(
  t: TransactionUserRead,
  user: UserListRead,
): TransactionRead {
  return {
    id: t.id,
    kind: t.kind,
    category: t.category,
    status: t.status,
    description: t.description,
    transaction_date: t.transaction_date,
    // TransactionUserRead solo expone el neto, igual que TransactionRead. Sin
    // descuento el bruto coincide con él, así que el neto cargado no cambia.
    amount: t.amount,
    user_id: user.id,
    external_name: null,
    course_id: t.course_id,
    period_start: t.period_start,
    period_end: t.period_end,
    paid_date: null,
    payment_method: null,
    recurring_id: t.recurring_id,
    payment_reference: null,
    payment_notes: null,
    discount_amount: null,
    discount_percentage: null,
    discount_description: null,
    discount_id: null,
    user: { id: user.id, first_name: user.first_name, last_name: user.last_name },
  };
}

/**
 * Cambio de `status` sin pasar por el formulario. Es un PATCH parcial —el
 * backend solo exige nombre y apellido— pero `UserUpdate` pide el bloque base,
 * así que se reenvía tal cual lo que ya tiene la ficha. `email` y `role` se
 * omiten a propósito: omitir la clave es la forma de no tocarlas.
 */
function statusPatch(u: UserListRead, status: UserStatus): UserUpdate {
  return {
    first_name: u.first_name,
    last_name: u.last_name,
    phone: u.phone,
    address: u.address,
    date_of_birth: u.date_of_birth,
    start_date: u.start_date,
    payment_method: u.payment_method,
    special_conditions: u.special_conditions,
    status,
  };
}

/**
 * Vuelca sobre la ficha recién reactivada lo que se acababa de teclear en el
 * alta, para no perderlo. Solo pisan los valores con contenido: si el alta dejó
 * un campo vacío y la ficha archivada lo tenía, gana el de la ficha. Los arrays
 * vacíos también se descartan, o un alta sin grupos borraría los que ya tenía.
 */
function mergeAttempted(
  user: UserRead,
  attempted: Partial<UserCreate> | null,
): UserRead {
  if (!attempted) return user;
  const filled = Object.fromEntries(
    Object.entries(attempted).filter(
      ([, v]) =>
        v !== null &&
        v !== undefined &&
        v !== '' &&
        !(Array.isArray(v) && v.length === 0),
    ),
  );
  return { ...user, ...filled } as UserRead;
}

export default function UsersModule(props: UsersModuleProps) {
  const {
    role,
    pageTitle,
    summaryLabel,
    inviteButtonLabel,
    createButtonLabel,
    inviteTitle,
    createTitle,
    editTitle,
    viewTitle,
    showDebtColumns = false,
    debtFilter = null,
    onDebtFilterChange,
    enrollmentMonthFilter = null,
    onEnrollmentMonthFilterChange,
  } = props;

  const token = getToken();
  const { me } = useAuth();
  const currency = me?.academy.currency ?? null;
  const graceDays = me?.academy.payment_grace_days ?? DEFAULT_GRACE_DAYS;

  const [status, setStatus] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState<UserListRead[]>([]);
  // Página actual (base 0) y total con los filtros aplicados. Sin paginar, el
  // backend cortaba en 100 y el resto simplemente no aparecía.
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // KPIs adicionales de la cabecera. Independientes de los filtros de la lista:
  // se piden con fetch dedicado (la lista está paginada). Ver punto 2 del brief.
  // Estudiantes → cuentas por cobrar (/transactions/summary) y pendientes de
  // activación (listUsers status=pending). Instructores → nómina del mes
  // (/dashboards/payroll, ya agregado por el backend con delta_pct).
  const [receivable, setReceivable] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [pendingActivation, setPendingActivation] = useState<number | null>(
    null,
  );
  const [payrollKpis, setPayrollKpis] = useState<FinancePayrollKpis | null>(
    null,
  );

  const [panel, setPanel] = useState<PanelState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelApiError, setPanelApiError] = useState<ApiError | null>(null);
  // Datos del alta que chocó contra un correo ya registrado. Se guardan para
  // volcarlos sobre la ficha si se resuelve reactivando en vez de crear.
  const [attempted, setAttempted] = useState<Partial<UserCreate> | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  // Fallo al intentar resolver el conflicto. Va aparte de `panelError` porque se
  // pinta dentro del aviso, para no tapar el botón de reintentar.
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    link: string;
  } | null>(null);

  // Recordatorio de deuda por-estudiante (panel independiente de la máquina `panel`).
  const [debtUser, setDebtUser] = useState<UserListRead | null>(null);
  const [debtInitial, setDebtInitial] = useState<AnnouncementCreate | null>(null);
  const [debtError, setDebtError] = useState<string | null>(null);
  // Admin y recepción pueden mandar recordatorios de deuda.
  const canSendDebt = me?.role === 'admin' || me?.role === 'receptionist';
  // Las fichas eliminadas solo las ve y reactiva un admin: el backend responde
  // 403 a los demás, así que ni siquiera se ofrece la pestaña.
  const isAdmin = me?.role === 'admin';
  const filters = isAdmin ? [...FILTERS, DELETED_FILTER] : FILTERS;
  const showingDeleted = status === 'deleted';

  // Modal de baja: ofrece las dos salidas (marcar inactivo o archivar la ficha).
  const [toDelete, setToDelete] = useState<UserListRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Reactivar desde la pestaña de eliminados (el otro camino es el aviso de
  // correo repetido al dar de alta).
  const [toRestore, setToRestore] = useState<UserListRead | null>(null);
  const [restoring, setRestoring] = useState(false);

  // Fila cuya ficha se está pidiendo para abrir un panel (ver detalles, cobrar).
  const [openingRow, setOpeningRow] = useState<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listUsers({
        role,
        // El filtro de eliminados cruza los dos ejes: cualquier `status`, pero
        // solo archivadas. El resto de pestañas deja `active` sin mandar, y el
        // backend asume `true` (solo vivas).
        status: status === 'deleted' ? 'all' : status,
        active: status === 'deleted' ? false : undefined,
        search: debouncedSearch || undefined,
        debt_filter: debtFilter ?? undefined,
        enrollment_fee_month: enrollmentMonthFilter ?? undefined,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setUsers(data.items);
      setTotal(data.total);
      // La página se quedó fuera de rango (p. ej. se borró la última fila de la
      // última página): retroceder en vez de mostrar una lista vacía.
      if (data.items.length === 0 && page > 0) {
        setPage((p) => Math.max(0, p - 1));
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo cargar la lista. Intenta de nuevo.';
      setListError(message);
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [role, status, debouncedSearch, debtFilter, enrollmentMonthFilter, page]);

  // Cualquier cambio de filtro o de búsqueda invalida la página en la que se
  // estaba: la 3 de un listado ya no es la 3 del siguiente.
  useEffect(() => {
    setPage(0);
  }, [role, status, debouncedSearch, debtFilter, enrollmentMonthFilter]);

  // El total de activos sale del header, no de contar filas: contándolas se
  // topaba con el límite de la página y una academia con más de 100 alumnos
  // mostraba siempre 100. Se pide `limit: 1` porque las filas no se usan.
  const fetchActiveCount = useCallback(async () => {
    try {
      const data = await listUsers({ role, status: 'active', limit: 1 });
      setActiveCount(data.total);
    } catch {
      setActiveCount(null);
    }
  }, [role]);

  const fetchKpis = useCallback(async () => {
    if (role === 'student') {
      try {
        const [summary, pending] = await Promise.all([
          getTransactionsSummary({ kind: 'sale' }),
          // Igual que el conteo de activos: interesa el total, no las filas.
          listUsers({ role, status: 'pending', limit: 1 }),
        ]);
        setReceivable(summary.pending);
        setPendingCount(summary.pending_count);
        setPendingActivation(pending.total);
      } catch {
        setReceivable(null);
        setPendingCount(null);
        setPendingActivation(null);
      }
    } else if (role === 'instructor') {
      const now = new Date();
      try {
        const data = await getFinancePayroll(
          now.getMonth() + 1,
          now.getFullYear(),
        );
        setPayrollKpis(data.kpis);
      } catch {
        setPayrollKpis(null);
      }
    }
  }, [role]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchActiveCount();
  }, [fetchActiveCount]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const closePanel = useCallback(() => {
    if (submitting) return;
    const wasInviteResult = inviteResult !== null;
    setPanel(null);
    setPanelError(null);
    setPanelApiError(null);
    setAttempted(null);
    setConflictError(null);
    setInviteResult(null);
    if (wasInviteResult) {
      fetchList();
      fetchActiveCount();
    }
  }, [submitting, inviteResult, fetchList, fetchActiveCount]);

  const openInvite = () => {
    setPanelError(null);
    setPanelApiError(null);
    setInviteResult(null);
    setPanel({ kind: 'invite' });
  };
  const openInviteExisting = (user: UserListRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setInviteResult(null);
    setPanel({ kind: 'invite-existing', user });
  };
  const openCreate = () => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'create' });
  };
  const openEdit = (user: UserListRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'edit', user });
  };
  // La ficha completa ya no viene en el listado: `UserListRead` no trae
  // `pending_transactions`, que es justo lo que pinta el detalle. Se pide al
  // abrir, así que el panel tarda una petición en aparecer.
  const openView = async (user: UserListRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setOpeningRow(user.id);
    try {
      setPanel({ kind: 'view', user: await getUser(user.id) });
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'No se pudo abrir la ficha.',
      );
    } finally {
      setOpeningRow(null);
    }
  };
  // Mismo motivo: el cobro más viejo hay que buscarlo en la ficha completa.
  const openPay = async (user: UserListRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setOpeningRow(user.id);
    try {
      const pending = (await getUser(user.id)).pending_transactions ?? [];
      if (pending.length === 0) {
        // La fila decía que había deuda y ya no la hay: la pantalla iba atrasada.
        showToast('Ya no tiene cobros pendientes.');
        fetchList();
        return;
      }
      const oldest = [...pending].sort((a, b) =>
        a.transaction_date.localeCompare(b.transaction_date),
      )[0];
      setPanel({
        kind: 'pay',
        user,
        tx: pendingToTransactionRead(oldest, user),
      });
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'No se pudo abrir el cobro.',
      );
    } finally {
      setOpeningRow(null);
    }
  };
  const openPaySpecific = (user: UserListRead, t: TransactionUserRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'pay', user, tx: pendingToTransactionRead(t, user) });
  };
  const openRecCreate = (user: UserListRead, category: TransactionCategory) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'rec-create', user, category });
  };
  const openRecEdit = (user: UserListRead, rec: RecurringTransactionRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'rec-edit', user, rec });
  };
  const openDebtReminder = async (user: UserListRead) => {
    setDebtUser(user);
    setDebtInitial(null);
    setDebtError(null);
    try {
      setDebtInitial(await suggestDebtReminder(user.id));
    } catch (err) {
      setDebtError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo preparar el recordatorio de deuda.',
      );
    }
  };
  const closeDebtReminder = () => {
    setDebtUser(null);
    setDebtInitial(null);
    setDebtError(null);
  };

  const handleInvite = async (payload: UserInvite) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      const result = await inviteUser(payload);
      const link = `${window.location.origin}/invite?token=${encodeURIComponent(
        result.invite_token,
      )}`;
      setInviteResult({
        firstName: payload.first_name,
        lastName: payload.last_name,
        email: payload.email,
        link,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
        setAttempted({
          first_name: payload.first_name,
          last_name: payload.last_name,
          email: payload.email,
        });
      } else {
        setPanelError('No se pudo generar la invitación.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleInviteExisting = async (
    user: UserListRead,
    email: string | null,
  ) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      const result = await inviteExistingUser(user.id, email);
      const link = `${window.location.origin}/invite?token=${encodeURIComponent(
        result.invite_token,
      )}`;
      setInviteResult({
        firstName: user.first_name,
        lastName: user.last_name,
        email: email ?? user.email ?? '',
        link,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        // "Ya completó su registro": la pantalla estaba desactualizada, así que
        // se recarga para que desaparezca el botón de invitar.
        if (conflictCode(err) === 'already_registered') fetchList();
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo enviar la invitación.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const [billingSetupError, setBillingSetupError] = useState<string | null>(
    null,
  );

  const setupStudentBilling = async (
    userId: number,
    billing: StudentBillingSetup,
  ): Promise<boolean> => {
    if (!me?.academy) return true;
    const academy = me.academy;
    try {
      if (
        billing.createTuition &&
        billing.tuitionAmount !== null &&
        billing.tuitionBillingDay !== null &&
        billing.tuitionStartDate
      ) {
        await createRecurringTransaction({
          kind: 'sale',
          category: 'tuition',
          frequency: 'monthly',
          user_id: userId,
          amount: billing.tuitionAmount,
          billing_day: billing.tuitionBillingDay,
          start_date: billing.tuitionStartDate,
          end_date: null,
          external_name: null,
          course_id: null,
          description: 'Mensualidad',
        });
      }

      if (billing.createEnrollment && academy.enrollment_fee_amount) {
        if (academy.enrollment_fee_mode === 'annual_recurring') {
          const month = academy.enrollment_fee_month ?? 1;
          const year = new Date().getFullYear();
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          await createRecurringTransaction({
            kind: 'sale',
            category: 'enrollment_fee',
            frequency: 'annual',
            user_id: userId,
            amount: academy.enrollment_fee_amount,
            billing_day: 1,
            billing_month: month,
            start_date: startDate,
            end_date: null,
            external_name: null,
            course_id: null,
            description: 'Cuota anual',
          });
        } else if (academy.enrollment_fee_mode === 'one_time_on_signup') {
          const today = new Date().toISOString().slice(0, 10);
          await createTransaction({
            kind: 'sale',
            category: 'enrollment_fee',
            status: 'pending',
            user_id: userId,
            gross_amount: academy.enrollment_fee_amount,
            transaction_date: today,
            description: 'Matrícula anual',
            external_name: null,
            course_id: null,
            period_start: null,
            period_end: null,
            paid_date: null,
            payment_method: null,
            recurring_id: null,
            payment_reference: null,
            payment_notes: null,
            discount_amount: null,
            discount_percentage: null,
            discount_description: null,
            discount_id: null,
          });
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleCreate = async (
    payload: UserCreate,
    billing?: StudentBillingSetup,
  ) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    setBillingSetupError(null);
    try {
      const created = await createUser(payload);
      const needsBilling =
        billing && (billing.createTuition || billing.createEnrollment);
      let billingOk = true;
      if (needsBilling) {
        billingOk = await setupStudentBilling(created.id, billing!);
      }
      showToast(`${payload.first_name} ${payload.last_name} creado`);
      setPanel(null);
      if (!billingOk) {
        setBillingSetupError(
          'El estudiante se creó, pero no se pudieron configurar los cobros. Configura desde el detalle.',
        );
      }
      fetchList();
      fetchActiveCount();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
        setAttempted(payload);
      } else {
        setPanelError('No se pudo crear el usuario.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Salida del choque de correo cuando la ficha está archivada: se desarchiva y
   * el panel pasa a edición con lo tecleado ya volcado encima, para revisar y
   * guardar. No se parchea sola: reactivar no debe decidir por quien reactiva.
   *
   * El acceso a la plataforma no vuelve aquí; si además hace falta, se invita
   * desde la ficha *después* de reactivar (el backend rechaza lo contrario).
   */
  const handleRestoreConflict = async (conflict: UserConflict) => {
    setResolvingConflict(true);
    setConflictError(null);
    try {
      const restored = await restoreUser(conflict.id);
      setPanelError(null);
      setPanelApiError(null);
      setPanel({ kind: 'edit', user: mergeAttempted(restored, attempted) });
      setAttempted(null);
      showToast(
        `Ficha de ${restored.first_name} ${restored.last_name} reactivada. Revisa los datos y sus cobros.`,
      );
      fetchList();
      fetchActiveCount();
    } catch (err) {
      if (err instanceof ApiError) {
        // "No estaba borrada": alguien la reactivó mientras tanto.
        if (conflictCode(err) === 'user_not_deleted') fetchList();
        setConflictError(err.message);
      } else {
        setConflictError('No se pudo reactivar la ficha.');
      }
    } finally {
      setResolvingConflict(false);
    }
  };

  // La otra salida: el correo es de alguien que sigue activo, así que lo único
  // que se puede hacer es abrir su ficha.
  const handleViewConflict = async (conflict: UserConflict) => {
    setResolvingConflict(true);
    setConflictError(null);
    try {
      const user = await getUser(conflict.id);
      setPanelError(null);
      setPanelApiError(null);
      setAttempted(null);
      setPanel({ kind: 'view', user });
    } catch (err) {
      setConflictError(
        err instanceof ApiError ? err.message : 'No se pudo abrir la ficha.',
      );
    } finally {
      setResolvingConflict(false);
    }
  };

  const handleUpdate = async (id: number, payload: UserUpdate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      const updated = await updateUser(id, payload);
      setUsers((list) => list.map((u) => (u.id === id ? updated : u)));
      showToast(`${updated.first_name} ${updated.last_name} actualizado`);
      setPanel(null);
      fetchActiveCount();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo actualizar el usuario.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecCreate = async (payload: RecurringTransactionCreate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await createRecurringTransaction(payload);
      showToast('Cobro recurrente creado');
      setPanel(null);
      fetchList();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo crear el cobro recurrente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecEdit = async (
    id: number,
    payload: RecurringTransactionUpdate,
  ) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await updateRecurringTransaction(id, payload);
      showToast('Cobro recurrente actualizado');
      setPanel(null);
      fetchList();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo actualizar el cobro recurrente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePay = async (id: number, payload: TransactionUpdate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await updateTransaction(id, payload);
      showToast('Pago registrado');
      setPanel(null);
      fetchList();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo registrar el pago.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteUser(toDelete.id);
      showToast(`${toDelete.first_name} ${toDelete.last_name} eliminado`);
      setToDelete(null);
      // Se recarga en vez de quitar la fila a mano: con paginación, sacarla del
      // array dejaría el total y la página descuadrados.
      fetchList();
      fetchActiveCount();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar el usuario.';
      showToast(message);
    } finally {
      setDeleting(false);
    }
  };

  // La salida suave del mismo modal: baja temporal, la ficha sigue a la vista.
  // Se recarga la lista en vez de parchear la fila porque con el filtro en
  // "Activos" la persona ya no pertenece al listado que se está viendo.
  const confirmDeactivate = async () => {
    if (!toDelete) return;
    setDeactivating(true);
    try {
      await updateUser(toDelete.id, statusPatch(toDelete, 'inactive'));
      showToast(
        `${toDelete.first_name} ${toDelete.last_name} marcado como inactivo`,
      );
      setToDelete(null);
      fetchList();
      fetchActiveCount();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo marcar como inactivo.';
      showToast(message);
    } finally {
      setDeactivating(false);
    }
  };

  const confirmRestore = async () => {
    if (!toRestore) return;
    setRestoring(true);
    try {
      const restored = await restoreUser(toRestore.id);
      showToast(
        `${restored.first_name} ${restored.last_name} reactivado como inactivo. Revisa sus cobros desde su ficha.`,
      );
      setToRestore(null);
      // Sale de la lista de eliminados, así que se recarga en vez de parchear.
      fetchList();
      fetchActiveCount();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo reactivar la ficha.';
      showToast(message);
      // "No estaba borrada": la pantalla iba atrasada, se refresca igualmente.
      if (conflictCode(err) === 'user_not_deleted') {
        setToRestore(null);
        fetchList();
      }
    } finally {
      setRestoring(false);
    }
  };

  const headerActions = useMemo(
    () => (
      <>
        <button type="button" className="btn btn--ghost" onClick={openInvite}>
          <MailIcon size={14} />
          {inviteButtonLabel}
        </button>
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          <PlusIcon size={14} />
          {createButtonLabel}
        </button>
      </>
    ),
    [inviteButtonLabel, createButtonLabel],
  );

  // El backend solo manda `user` en el 409 cuando el correo es de esta academia,
  // así que su presencia es justo la condición para ofrecer una salida: sin él
  // solo queda pintar el campo en rojo, que es lo que ya hace UserForm.
  const panelConflict = conflictUser(panelApiError);

  const conflictNotice = panelConflict ? (
    <ConflictNotice
      code={conflictCode(panelApiError)}
      user={panelConflict}
      moduleRole={role}
      busy={resolvingConflict}
      error={conflictError}
      onRestore={() => handleRestoreConflict(panelConflict)}
      onView={() => handleViewConflict(panelConflict)}
    />
  ) : null;

  // Con el aviso arriba, el mensaje plano del formulario sobraría: dice lo mismo
  // pero sin salida.
  const formError = panelConflict ? null : panelError;

  if (!token) return <Navigate to="/login" replace />;

  return (
    <Layout title={pageTitle} actions={headerActions}>
      <section className="summary-grid">
        <KpiCard
          label={summaryLabel}
          value={activeCount === null ? '—' : String(activeCount)}
        />

        {role === 'student' && (
          <>
            <KpiCard
              label="Cartera vencida"
              value={
                receivable === null ? '—' : formatMoney(receivable, currency)
              }
            />
            <KpiCard
              label="Cobros pendientes"
              value={pendingCount === null ? '—' : String(pendingCount)}
            />
            <KpiCard
              label="Pendientes de activación"
              value={
                pendingActivation === null ? '—' : String(pendingActivation)
              }
            />
          </>
        )}

        {role === 'instructor' && (
          <>
            <KpiCard
              label="Nómina del mes"
              value={
                payrollKpis
                  ? formatMoney(payrollKpis.total_payroll.value, currency)
                  : '—'
              }
              delta={payrollKpis?.total_payroll.delta_pct}
            />
            <KpiCard
              label="Pago promedio"
              value={
                payrollKpis
                  ? formatMoney(payrollKpis.avg_per_employee.value, currency)
                  : '—'
              }
              delta={payrollKpis?.avg_per_employee.delta_pct}
            />
            <KpiCard
              label="Empleados pagados"
              value={
                payrollKpis ? String(payrollKpis.employees_paid.value) : '—'
              }
              delta={payrollKpis?.employees_paid.delta_pct}
            />
          </>
        )}
      </section>

      <section className="filter-bar">
        <div className="search-input">
          <SearchIcon size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o apellido"
            aria-label="Buscar"
          />
        </div>
        {showDebtColumns && onDebtFilterChange && (
          <select
            className="select"
            value={debtFilter ?? ''}
            onChange={(e) =>
              onDebtFilterChange((e.target.value as Debt | '') || null)
            }
            aria-label="Filtrar por cobros"
            style={{ width: 'auto', maxWidth: 240 }}
          >
            {DEBT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {showDebtColumns && onEnrollmentMonthFilterChange && (
          <select
            className="select"
            value={enrollmentMonthFilter ?? ''}
            onChange={(e) =>
              onEnrollmentMonthFilterChange(
                e.target.value ? Number(e.target.value) : null,
              )
            }
            aria-label="Filtrar por mes de matrícula anual"
            style={{ width: 'auto', maxWidth: 240 }}
          >
            <option value="">Mes de matrícula: todos</option>
            {MONTHS_ES.map((label, i) => (
              <option key={i} value={String(i + 1)}>
                Matrícula en {label}
              </option>
            ))}
          </select>
        )}
        <div className="tab-group" role="tablist">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={status === f.value}
              className={
                'tab-group__item' +
                (status === f.value ? ' tab-group__item--active' : '')
              }
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        {listError && (
          <div className="alert" role="alert" style={{ marginBottom: 12 }}>
            {listError}
          </div>
        )}
        {billingSetupError && (
          <div
            className="alert alert--warning"
            role="alert"
            style={{ marginBottom: 12 }}
          >
            {billingSetupError}
            <button
              type="button"
              className="icon-btn"
              onClick={() => setBillingSetupError(null)}
              aria-label="Cerrar"
              style={{ marginLeft: 'auto' }}
            >
              ×
            </button>
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

        <div className="table-wrapper">
          {loading ? (
            <div className="loading-row">
              <SpinnerIcon size={16} /> Cargando…
            </div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">Sin resultados</p>
              <p>
                {showingDeleted
                  ? 'No hay fichas eliminadas.'
                  : 'Ajusta los filtros o invita a un nuevo usuario.'}
              </p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>{showDebtColumns ? 'Estudiante' : 'Nombre completo'}</th>
                  {showDebtColumns && (
                    <th className="table-cell--nowrap">Año / N.º</th>
                  )}
                  {showDebtColumns && <th>Grupo</th>}
                  {!showDebtColumns && <th>Email</th>}
                  {showDebtColumns && (
                    <th
                      className="table-cell--nowrap"
                      style={{ textAlign: 'right' }}
                    >
                      Mensualidad
                    </th>
                  )}
                  {showDebtColumns && (
                    <th
                      className="table-cell--nowrap"
                      style={{ textAlign: 'right' }}
                    >
                      Matrícula anual
                    </th>
                  )}
                  <th>Estado</th>
                  {showDebtColumns && (
                    <th
                      className="table-cell--nowrap"
                      style={{ textAlign: 'right' }}
                    >
                      Deuda
                    </th>
                  )}
                  {showDebtColumns && (
                    <th className="table-cell--nowrap">
                      Días de pago / Próximo pago
                    </th>
                  )}
                  <th
                    className="table-cell--nowrap"
                    style={{ textAlign: 'right' }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const hasDebt = (u.debt_amount ?? 0) > 0;
                  // La fila ya no trae los cobros pendientes, así que se deduce
                  // de lo que sí viene: con deuda o con una fecha de próximo
                  // cobro, hay algo que cobrar. El detalle se pide al pulsar.
                  const hasPending = hasDebt || !!u.next_due_date;
                  const payLabel = hasDebt ? 'Pagar' : 'Pagar próximo';
                  const enrollmentNote = enrollmentFeeNoteFor(u);
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <div
                            className="user-cell__avatar"
                            aria-hidden="true"
                          >
                            {initials(u.first_name, u.last_name)}
                          </div>
                          <div className="user-cell__name">
                            {u.first_name} {u.last_name}
                          </div>
                        </div>
                      </td>
                      {showDebtColumns && (
                        <td className="table-cell--nowrap">
                          {studentNumber(u) ?? (
                            <span className="table-cell--muted">—</span>
                          )}
                        </td>
                      )}
                      {showDebtColumns && (
                        <td>
                          {u.groups && u.groups.length > 0 ? (
                            u.groups.map((g) => g.name).join(', ')
                          ) : (
                            <span className="table-cell--muted">—</span>
                          )}
                        </td>
                      )}
                      {!showDebtColumns && <td>{u.email ?? '—'}</td>}
                      {showDebtColumns && (
                        <td
                          className="table-cell--nowrap"
                          style={{ textAlign: 'right' }}
                        >
                          {u.tuition_amount != null ? (
                            formatMoney(u.tuition_amount, currency)
                          ) : (
                            <span className="table-cell--muted">—</span>
                          )}
                        </td>
                      )}
                      {showDebtColumns && (
                        <td
                          className="table-cell--nowrap"
                          style={{ textAlign: 'right' }}
                        >
                          {u.enrollment_fee_amount == null &&
                          enrollmentNote === null ? (
                            <span className="table-cell--muted">—</span>
                          ) : (
                            <>
                              <div className="table-cell-stacked__primary">
                                {u.enrollment_fee_amount != null ? (
                                  formatMoney(u.enrollment_fee_amount, currency)
                                ) : (
                                  <span className="table-cell--muted">—</span>
                                )}
                              </div>
                              {enrollmentNote && (
                                <div className="table-cell-stacked__secondary">
                                  {enrollmentNote}
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      )}
                      <td>
                        {showingDeleted ? (
                          <>
                            <span className="badge badge--inactive">
                              Eliminado
                            </span>
                            {formatDateTimeShort(u.updated_at) && (
                              <div className="table-cell-stacked__secondary">
                                {formatDateTimeShort(u.updated_at)}
                              </div>
                            )}
                          </>
                        ) : (
                          <StatusBadge status={u.status} />
                        )}
                      </td>
                      {showDebtColumns && (
                        <td
                          className={
                            'table-cell--nowrap' +
                            (hasDebt ? ' table-cell--danger' : '')
                          }
                          style={{ textAlign: 'right' }}
                        >
                          {formatMoney(u.debt_amount ?? 0, currency)}
                        </td>
                      )}
                      {showDebtColumns && (
                        <td className="table-cell--nowrap">
                          {u.next_due_date ? (
                            <>
                              <div className="table-cell-stacked__primary">
                                Días {paymentWindow(u.next_due_date, graceDays)}
                              </div>
                              <div className="table-cell-stacked__secondary">
                                {formatDateShort(u.next_due_date)} ·{' '}
                                {formatMoney(u.next_due_amount, currency)}
                              </div>
                            </>
                          ) : (
                            <span className="table-cell--muted">—</span>
                          )}
                        </td>
                      )}
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        <div className="row-actions">
                          {/* Una ficha archivada no admite nada más: invitarla
                              la deja con una cuenta muerta, cobrarle o editarla
                              no tiene sentido mientras no vuelva. */}
                          {showingDeleted ? (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => setToRestore(u)}
                              title="Reactivar ficha"
                              aria-label="Reactivar ficha"
                            >
                              <RestoreIcon size={14} />
                            </button>
                          ) : (
                            <>
                              {showDebtColumns &&
                                hasPending &&
                                (hasDebt || u.next_due_date) && (
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => openPay(u)}
                                    title={payLabel}
                                    aria-label={payLabel}
                                    disabled={openingRow === u.id}
                                  >
                                    {openingRow === u.id ? (
                                      <SpinnerIcon size={14} />
                                    ) : (
                                      <CheckIcon size={14} />
                                    )}
                                  </button>
                                )}
                              {showDebtColumns && canSendDebt && hasDebt && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => openDebtReminder(u)}
                                  title="Enviar recordatorio de deuda"
                                  aria-label="Enviar recordatorio de deuda"
                                >
                                  <MailIcon size={14} />
                                </button>
                              )}
                              {!u.has_access && (
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => openInviteExisting(u)}
                                  title={inviteRowLabel(u)}
                                  aria-label={inviteRowLabel(u)}
                                >
                                  <KeyIcon size={14} />
                                </button>
                              )}
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => openView(u)}
                                title="Ver detalles"
                                aria-label="Ver detalles"
                                disabled={openingRow === u.id}
                              >
                                {openingRow === u.id ? (
                                  <SpinnerIcon size={14} />
                                ) : (
                                  <EyeIcon size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => openEdit(u)}
                                title="Editar"
                                aria-label="Editar"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn icon-btn--danger"
                                onClick={() => setToDelete(u)}
                                title="Dar de baja"
                                aria-label="Dar de baja"
                              >
                                <TrashIcon size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !listError && (
          <Paginator
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            shown={users.length}
            onChange={setPage}
          />
        )}
      </section>

      <SidePanel
        open={panel?.kind === 'invite'}
        title={inviteResult ? 'Invitación generada' : inviteTitle}
        onClose={closePanel}
      >
        {panel?.kind === 'invite' &&
          (inviteResult ? (
            <InviteResult
              firstName={inviteResult.firstName}
              lastName={inviteResult.lastName}
              email={inviteResult.email}
              link={inviteResult.link}
              onDone={closePanel}
            />
          ) : (
            <>
              {conflictNotice}
              <InviteForm
                role={role}
                onSubmit={handleInvite}
                onCancel={closePanel}
                submitting={submitting}
                serverError={formError}
                apiError={panelApiError}
              />
            </>
          ))}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'invite-existing'}
        title={
          inviteResult ? 'Invitación enviada' : 'Invitar a la plataforma'
        }
        subtitle={
          panel?.kind === 'invite-existing'
            ? `${panel.user.first_name} ${panel.user.last_name}`
            : undefined
        }
        onClose={closePanel}
      >
        {panel?.kind === 'invite-existing' &&
          (inviteResult ? (
            <InviteResult
              firstName={inviteResult.firstName}
              lastName={inviteResult.lastName}
              email={inviteResult.email}
              link={inviteResult.link}
              onDone={closePanel}
            />
          ) : (
            <>
              {conflictNotice}
              <InviteAccessForm
                user={panel.user}
                onSubmit={(email) => handleInviteExisting(panel.user, email)}
                onCancel={closePanel}
                submitting={submitting}
                serverError={formError}
                apiError={panelApiError}
              />
            </>
          ))}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'create'}
        title={createTitle}
        onClose={closePanel}
      >
        {panel?.kind === 'create' && (
          <>
            {conflictNotice}
            <UserForm
              mode="create"
              role={role}
              academy={me?.academy}
              onSubmit={handleCreate}
              onCancel={closePanel}
              submitting={submitting}
              serverError={formError}
              apiError={panelApiError}
            />
          </>
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'edit'}
        title={editTitle}
        subtitle={
          panel?.kind === 'edit'
            ? `${panel.user.first_name} ${panel.user.last_name}`
            : undefined
        }
        onClose={closePanel}
      >
        {panel?.kind === 'edit' && (
          <UserForm
            mode="edit"
            role={role}
            user={panel.user}
            onSubmit={(payload) => handleUpdate(panel.user.id, payload)}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'view'}
        title={viewTitle}
        subtitle={
          panel?.kind === 'view'
            ? `${panel.user.first_name} ${panel.user.last_name}`
            : undefined
        }
        onClose={closePanel}
        footer={
          panel?.kind === 'view' ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closePanel}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() =>
                  panel.kind === 'view' && openEdit(panel.user)
                }
              >
                <PencilIcon size={14} />
                Editar
              </button>
            </>
          ) : undefined
        }
      >
        {panel?.kind === 'view' && (
          <UserDetails
            user={panel.user}
            role={role}
            academy={me?.academy ?? null}
            onPayPending={(t) =>
              panel.kind === 'view' && openPaySpecific(panel.user, t)
            }
            onEditRecurring={(rec) =>
              panel.kind === 'view' && openRecEdit(panel.user, rec)
            }
            onCreateRecurring={(category) =>
              panel.kind === 'view' && openRecCreate(panel.user, category)
            }
            onRefresh={fetchList}
            onInvite={() =>
              panel.kind === 'view' && openInviteExisting(panel.user)
            }
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'pay'}
        title="Registrar pago"
        subtitle={
          panel?.kind === 'pay'
            ? `${panel.user.first_name} ${panel.user.last_name}`
            : undefined
        }
        onClose={closePanel}
      >
        {panel?.kind === 'pay' && (
          <RegisterPaymentForm
            transaction={panel.tx}
            defaultMethod={panel.user.payment_method}
            currency={currency}
            onSubmit={(payload) => handlePay(panel.tx.id, payload)}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'rec-create'}
        title="Nueva recurrencia"
        subtitle={
          panel?.kind === 'rec-create'
            ? `${panel.user.first_name} ${panel.user.last_name}`
            : undefined
        }
        onClose={closePanel}
      >
        {panel?.kind === 'rec-create' && me?.academy && (
          <RecurringForm
            mode="create"
            defaults={{
              user: {
                id: panel.user.id,
                first_name: panel.user.first_name,
                last_name: panel.user.last_name,
              },
              category: panel.category,
              frequency:
                panel.category === 'tuition' ? 'monthly' : 'annual',
              description:
                panel.category === 'tuition' ? 'Mensualidad' : 'Cuota anual',
              billing_day:
                panel.category === 'tuition'
                  ? me.academy.default_billing_day ?? 1
                  : 1,
            }}
            onSubmit={handleRecCreate}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'rec-edit'}
        title="Editar recurrencia"
        subtitle={
          panel?.kind === 'rec-edit' ? panel.rec.description : undefined
        }
        onClose={closePanel}
      >
        {panel?.kind === 'rec-edit' && (
          <RecurringForm
            mode="edit"
            recurring={panel.rec}
            onSubmit={(payload) => handleRecEdit(panel.rec.id, payload)}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
        )}
      </SidePanel>

      <SidePanel
        open={!!debtUser}
        title="Recordatorio de deuda"
        subtitle={
          debtUser ? `${debtUser.first_name} ${debtUser.last_name}` : undefined
        }
        onClose={closeDebtReminder}
      >
        {debtUser &&
          (debtError ? (
            <div className="alert" role="alert">
              {debtError}
            </div>
          ) : !debtInitial ? (
            <div className="loading-row">
              <SpinnerIcon size={16} /> Preparando recordatorio…
            </div>
          ) : (
            <AnnouncementComposer
              initial={debtInitial}
              template="debt_reminder"
              lockedUser={{
                id: debtUser.id,
                name: `${debtUser.first_name} ${debtUser.last_name}`,
              }}
              role={me?.role}
              onClose={closeDebtReminder}
              onChanged={fetchList}
            />
          ))}
      </SidePanel>

      <ConfirmModal
        open={!!toDelete}
        title={
          toDelete
            ? `Dar de baja a ${toDelete.first_name} ${toDelete.last_name}`
            : ''
        }
        message={
          <div className="modal__choices">
            {toDelete?.status !== 'inactive' && (
              <div className="modal__choice">
                <p className="modal__choice-title">Marcar como inactivo</p>
                <p className="modal__choice-text">
                  Deja de contar como activo, pero la ficha sigue en la lista
                  con todo su historial. Puedes reactivarla cuando quieras.
                </p>
              </div>
            )}
            <div className="modal__choice">
              <p className="modal__choice-title">Eliminar ficha</p>
              <p className="modal__choice-text">
                Se archiva: desaparece de las listas, se le cancelan los cobros
                recurrentes y pierde el acceso a la plataforma. Su correo sigue
                reservado y solo un administrador puede recuperarla.
              </p>
            </div>
          </div>
        }
        confirmLabel="Eliminar ficha"
        // Sin la salida suave cuando ya está inactivo: ahí solo queda archivar.
        secondaryLabel={
          toDelete?.status !== 'inactive' ? 'Marcar como inactivo' : undefined
        }
        onSecondary={confirmDeactivate}
        secondaryLoading={deactivating}
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && !deactivating && setToDelete(null)}
      />

      <ConfirmModal
        open={!!toRestore}
        title={
          toRestore
            ? `Reactivar a ${toRestore.first_name} ${toRestore.last_name}`
            : ''
        }
        message="Vuelve como inactivo, sin sus cobros recurrentes y sin acceso a la plataforma. Conserva su historial, su deuda pendiente y su número. Desde su ficha podrás activarlo, configurar sus cobros e invitarlo de nuevo."
        confirmLabel="Reactivar"
        loading={restoring}
        onConfirm={confirmRestore}
        onCancel={() => !restoring && setToRestore(null)}
      />
    </Layout>
  );
}
