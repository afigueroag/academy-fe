import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import ConfirmModal from '../components/ConfirmModal';
import { StatusBadge } from '../components/Badges';
import UserForm, { type StudentBillingSetup } from '../components/UserForm';
import InviteForm from '../components/InviteForm';
import InviteResult from '../components/InviteResult';
import UserDetails from '../components/UserDetails';
import RegisterPaymentForm from '../components/RegisterPaymentForm';
import RecurringForm from '../components/RecurringForm';
import { useAuth } from '../auth';
import {
  ApiError,
  createRecurringTransaction,
  createTransaction,
  createUser,
  deleteUser,
  getToken,
  inviteUser,
  listUsers,
  updateRecurringTransaction,
  updateTransaction,
  updateUser,
} from '../api';
import type {
  Debt,
  RecurringTransactionCreate,
  RecurringTransactionRead,
  RecurringTransactionUpdate,
  TransactionCategory,
  TransactionRead,
  TransactionUpdate,
  TransactionUserRead,
  UserCreate,
  UserInvite,
  UserRead,
  UserRole,
  UserStatus,
  UserUpdate,
} from '../types';
import {
  CheckIcon,
  EyeIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from '../brand';
import { formatMoney } from '../utils/money';

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

type Filter = UserStatus | 'all';

type PanelState =
  | { kind: 'invite' }
  | { kind: 'create' }
  | { kind: 'edit'; user: UserRead }
  | { kind: 'view'; user: UserRead }
  | { kind: 'pay'; user: UserRead; tx: TransactionRead }
  | { kind: 'rec-create'; user: UserRead; category: TransactionCategory }
  | { kind: 'rec-edit'; user: UserRead; rec: RecurringTransactionRead }
  | null;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
];

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
  user: UserRead,
): TransactionRead {
  return {
    id: t.id,
    kind: t.kind,
    category: t.category,
    status: t.status,
    description: t.description,
    transaction_date: t.transaction_date,
    // TransactionUserRead solo expone el neto. Para registrar el pago se usa
    // como bruto sin descuento adicional: el neto cargado no cambia.
    gross_amount: t.amount,
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
  const [users, setUsers] = useState<UserRead[]>([]);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [panel, setPanel] = useState<PanelState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelApiError, setPanelApiError] = useState<ApiError | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    link: string;
  } | null>(null);

  const [toDelete, setToDelete] = useState<UserRead | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        status,
        search: debouncedSearch || undefined,
        debt_filter: debtFilter ?? undefined,
        enrollment_fee_month: enrollmentMonthFilter ?? undefined,
      });
      setUsers(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo cargar la lista. Intenta de nuevo.';
      setListError(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [role, status, debouncedSearch, debtFilter, enrollmentMonthFilter]);

  const fetchActiveCount = useCallback(async () => {
    try {
      const data = await listUsers({ role, status: 'active' });
      setActiveCount(data.length);
    } catch {
      setActiveCount(null);
    }
  }, [role]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchActiveCount();
  }, [fetchActiveCount]);

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
  const openCreate = () => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'create' });
  };
  const openEdit = (user: UserRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'edit', user });
  };
  const openView = (user: UserRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'view', user });
  };
  const openPay = (user: UserRead) => {
    if (!user.pending_transactions || user.pending_transactions.length === 0) {
      return;
    }
    const oldest = [...user.pending_transactions].sort((a, b) =>
      a.transaction_date.localeCompare(b.transaction_date),
    )[0];
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'pay', user, tx: pendingToTransactionRead(oldest, user) });
  };
  const openPaySpecific = (user: UserRead, t: TransactionUserRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'pay', user, tx: pendingToTransactionRead(t, user) });
  };
  const openRecCreate = (user: UserRead, category: TransactionCategory) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'rec-create', user, category });
  };
  const openRecEdit = (user: UserRead, rec: RecurringTransactionRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'rec-edit', user, rec });
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
      } else {
        setPanelError('No se pudo generar la invitación.');
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
      } else {
        setPanelError('No se pudo crear el usuario.');
      }
    } finally {
      setSubmitting(false);
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
      setUsers((list) => list.filter((u) => u.id !== toDelete.id));
      showToast(`${toDelete.first_name} ${toDelete.last_name} eliminado`);
      setToDelete(null);
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

  if (!token) return <Navigate to="/login" replace />;

  return (
    <Layout title={pageTitle} actions={headerActions}>
      <section className="summary-grid">
        <div className="summary-card">
          <p className="summary-card__label">{summaryLabel}</p>
          <div className="summary-card__value">
            {activeCount === null ? '—' : activeCount}
          </div>
        </div>
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
          {FILTERS.map((f) => (
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
              <p>Ajusta los filtros o invita a un nuevo usuario.</p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>{showDebtColumns ? 'Estudiante' : 'Nombre completo'}</th>
                  {showDebtColumns && (
                    <th className="table-cell--nowrap">N.º</th>
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
                  const hasPending =
                    (u.pending_transactions?.length ?? 0) > 0;
                  const payLabel = hasDebt ? 'Pagar' : 'Pagar próximo';
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
                          {u.role_consecutive ?? (
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
                          {u.enrollment_fee_amount != null ? (
                            formatMoney(u.enrollment_fee_amount, currency)
                          ) : (
                            <span className="table-cell--muted">—</span>
                          )}
                        </td>
                      )}
                      <td>
                        <StatusBadge status={u.status} />
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
                          {showDebtColumns &&
                            hasPending &&
                            (hasDebt || u.next_due_date) && (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => openPay(u)}
                                title={payLabel}
                                aria-label={payLabel}
                              >
                                <CheckIcon size={14} />
                              </button>
                            )}
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openView(u)}
                            title="Ver detalles"
                            aria-label="Ver detalles"
                          >
                            <EyeIcon size={14} />
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
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
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
            <InviteForm
              role={role}
              onSubmit={handleInvite}
              onCancel={closePanel}
              submitting={submitting}
              serverError={panelError}
              apiError={panelApiError}
            />
          ))}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'create'}
        title={createTitle}
        onClose={closePanel}
      >
        {panel?.kind === 'create' && (
          <UserForm
            mode="create"
            role={role}
            academy={me?.academy}
            onSubmit={handleCreate}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
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

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar usuario"
        message={
          toDelete
            ? `¿Eliminar a ${toDelete.first_name} ${toDelete.last_name}? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </Layout>
  );
}
