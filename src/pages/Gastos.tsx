import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import ConfirmModal from '../components/ConfirmModal';
import { TransactionStatusBadge } from '../components/Badges';
import TransactionForm from '../components/TransactionForm';
import TransactionDetails from '../components/TransactionDetails';
import RegisterPaymentForm from '../components/RegisterPaymentForm';
import RecurringForm from '../components/RecurringForm';
import { useAuth } from '../auth';
import {
  ApiError,
  createRecurringTransaction,
  createTransaction,
  deleteRecurringTransaction,
  deleteTransaction,
  getToken,
  getTransactionsSummary,
  listRecurringTransactions,
  listTransactions,
  updateRecurringTransaction,
  updateTransaction,
} from '../api';
import type {
  PaymentMethod,
  RecurringTransactionCreate,
  RecurringTransactionRead,
  RecurringTransactionUpdate,
  TransactionCategory,
  TransactionCreate,
  TransactionFrequency,
  TransactionRead,
  TransactionStatus,
  TransactionSummary,
  TransactionUpdate,
} from '../types';
import {
  CheckIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from '../brand';
import { formatMoney } from '../utils/money';
import {
  categoriesForKind,
  labelPaymentMethod,
  labelTransactionCategory,
  labelTransactionFrequency,
} from '../utils/salesLabels';

type Tab = 'transacciones' | 'recurrentes';
type StatusFilter = TransactionStatus | 'all';
type ActiveFilter = 'true' | 'false' | 'all';

type PanelState =
  | { kind: 'create' }
  | { kind: 'view'; tx: TransactionRead }
  | { kind: 'edit'; tx: TransactionRead }
  | { kind: 'pay'; tx: TransactionRead }
  | { kind: 'rec-create' }
  | { kind: 'rec-edit'; rec: RecurringTransactionRead }
  | null;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'cancelled', label: 'Canceladas' },
];

const PAYMENT_OPTIONS: PaymentMethod[] = [
  'credit_card',
  'debit_card',
  'bank_transfer',
  'paypal',
  'cash',
  'other',
];

const FREQUENCY_OPTIONS: TransactionFrequency[] = [
  'weekly',
  'monthly',
  'quarterly',
  'semester',
  'annual',
  'one_time',
];

const ACTIVE_FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
];

const MONTHLY_FACTOR: Record<TransactionFrequency, number> = {
  weekly: 4,
  monthly: 1,
  quarterly: 1 / 3,
  semester: 1 / 6,
  annual: 1 / 12,
  one_time: 0,
};

function formatBillingDay(d: number | null): string {
  if (d === null) return '—';
  return `Día ${d}`;
}

type DateShortcut =
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'next_month'
  | 'this_year';

const SHORTCUTS: { value: DateShortcut; label: string }[] = [
  { value: 'this_week', label: 'Esta semana' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes anterior' },
  { value: 'next_month', label: 'Próximo mes' },
  { value: 'this_year', label: 'Este año' },
];

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + diff);
  return r;
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  return s;
}

function shortcutRange(s: DateShortcut): [string, string] {
  const now = new Date();
  switch (s) {
    case 'this_week':
      return [isoDate(startOfWeek(now)), isoDate(endOfWeek(now))];
    case 'this_month':
      return [
        isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
        isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
      ];
    case 'last_month':
      return [
        isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      ];
    case 'next_month':
      return [
        isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
        isoDate(new Date(now.getFullYear(), now.getMonth() + 2, 0)),
      ];
    case 'this_year':
      return [
        isoDate(new Date(now.getFullYear(), 0, 1)),
        isoDate(new Date(now.getFullYear(), 11, 31)),
      ];
  }
}

function detectActiveShortcut(from: string, to: string): DateShortcut | null {
  for (const s of SHORTCUTS) {
    const [f, t] = shortcutRange(s.value);
    if (f === from && t === to) return s.value;
  }
  return null;
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

export default function Gastos() {
  const token = getToken();
  const { me } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab: Tab =
    searchParams.get('tab') === 'recurrentes' ? 'recurrentes' : 'transacciones';
  const setTab = useCallback(
    (next: Tab) => {
      const sp = new URLSearchParams(searchParams);
      if (next === 'transacciones') sp.delete('tab');
      else sp.set('tab', next);
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const role = me?.role;
  const isReceptionist = role === 'receptionist';
  const isAdmin = role === 'admin';
  const currency = me?.academy.currency ?? null;

  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<TransactionCategory | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [fromDate, setFromDate] = useState<string>(
    () => shortcutRange('this_month')[0],
  );
  const [toDate, setToDate] = useState<string>(
    () => shortcutRange('this_month')[1],
  );

  const [transactions, setTransactions] = useState<TransactionRead[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Recurring tab state
  const [recurringList, setRecurringList] = useState<RecurringTransactionRead[]>(
    [],
  );
  const [recurringActive, setRecurringActive] = useState<
    RecurringTransactionRead[]
  >([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [recActive, setRecActive] = useState<ActiveFilter>('true');
  const [recSearch, setRecSearch] = useState('');
  const [recDebouncedSearch, setRecDebouncedSearch] = useState('');
  const [recCategory, setRecCategory] = useState<TransactionCategory | ''>('');
  const [recFrequency, setRecFrequency] = useState<TransactionFrequency | ''>(
    '',
  );

  const [panel, setPanel] = useState<PanelState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelApiError, setPanelApiError] = useState<ApiError | null>(null);

  const [toCancel, setToCancel] = useState<TransactionRead | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [toDeactivate, setToDeactivate] =
    useState<RecurringTransactionRead | null>(null);
  const [deactivating, setDeactivating] = useState(false);

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

  useEffect(() => {
    const t = window.setTimeout(
      () => setRecDebouncedSearch(recSearch.trim()),
      250,
    );
    return () => window.clearTimeout(t);
  }, [recSearch]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listTransactions({
        kind: 'expense',
        status: status === 'all' ? undefined : status,
        category: category || undefined,
        payment_method: paymentMethod || undefined,
        search: debouncedSearch || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setTransactions(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los gastos.';
      setListError(message);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [status, category, paymentMethod, debouncedSearch, fromDate, toDate]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getTransactionsSummary({
        kind: 'expense',
        category: category || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [category, fromDate, toDate]);

  const fetchRecurring = useCallback(async () => {
    setRecurringLoading(true);
    setRecurringError(null);
    try {
      const data = await listRecurringTransactions({
        kind: 'expense',
        category: recCategory || undefined,
        frequency: recFrequency || undefined,
        active: recActive === 'all' ? undefined : recActive === 'true',
        search: recDebouncedSearch || undefined,
      });
      setRecurringList(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los gastos recurrentes.';
      setRecurringError(message);
      setRecurringList([]);
    } finally {
      setRecurringLoading(false);
    }
  }, [recCategory, recFrequency, recActive, recDebouncedSearch]);

  const fetchRecurringActive = useCallback(async () => {
    try {
      const data = await listRecurringTransactions({
        kind: 'expense',
        active: true,
        limit: 1000,
      });
      setRecurringActive(data);
    } catch {
      setRecurringActive([]);
    }
  }, []);

  useEffect(() => {
    if (tab === 'transacciones') fetchList();
  }, [fetchList, tab]);

  useEffect(() => {
    if (tab === 'transacciones') fetchSummary();
  }, [fetchSummary, tab]);

  useEffect(() => {
    if (tab === 'recurrentes') fetchRecurring();
  }, [fetchRecurring, tab]);

  useEffect(() => {
    if (tab === 'recurrentes') fetchRecurringActive();
  }, [fetchRecurringActive, tab]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const refreshAll = useCallback(() => {
    fetchList();
    fetchSummary();
  }, [fetchList, fetchSummary]);

  const refreshAfterRecChange = useCallback(() => {
    fetchRecurring();
    fetchRecurringActive();
    fetchList();
    fetchSummary();
  }, [fetchRecurring, fetchRecurringActive, fetchList, fetchSummary]);

  const closePanel = useCallback(() => {
    if (submitting) return;
    setPanel(null);
    setPanelError(null);
    setPanelApiError(null);
  }, [submitting]);

  const openCreate = () => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'create' });
  };
  const openView = (tx: TransactionRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'view', tx });
  };
  const openEdit = (tx: TransactionRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'edit', tx });
  };
  const openPay = (tx: TransactionRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'pay', tx });
  };
  const openRecCreate = () => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'rec-create' });
  };
  const openRecEdit = (rec: RecurringTransactionRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'rec-edit', rec });
  };

  const handleCreate = async (payload: TransactionCreate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await createTransaction(payload);
      showToast('Gasto creado');
      setPanel(null);
      refreshAll();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo crear el gasto.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: number, payload: TransactionUpdate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await updateTransaction(id, payload);
      showToast('Gasto actualizado');
      setPanel(null);
      refreshAll();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo actualizar el gasto.');
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
      refreshAll();
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

  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await deleteTransaction(toCancel.id);
      showToast('Gasto cancelado');
      setToCancel(null);
      refreshAll();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo cancelar el gasto.';
      showToast(message);
    } finally {
      setCancelling(false);
    }
  };

  const handleRecCreate = async (payload: RecurringTransactionCreate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await createRecurringTransaction(payload);
      showToast('Gasto recurrente creado');
      setPanel(null);
      refreshAfterRecChange();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo crear el gasto recurrente.');
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
      showToast('Gasto recurrente actualizado');
      setPanel(null);
      refreshAfterRecChange();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo actualizar el gasto recurrente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    setDeactivating(true);
    try {
      await deleteRecurringTransaction(toDeactivate.id);
      showToast('Gasto recurrente desactivado');
      setToDeactivate(null);
      refreshAfterRecChange();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo desactivar el gasto recurrente.';
      showToast(message);
    } finally {
      setDeactivating(false);
    }
  };

  const headerActions = useMemo(() => {
    if (tab === 'transacciones') {
      return (
        <button type="button" className="btn btn--primary" onClick={openCreate}>
          <PlusIcon size={14} />
          Nuevo gasto
        </button>
      );
    }
    if (tab === 'recurrentes' && isAdmin) {
      return (
        <button
          type="button"
          className="btn btn--primary"
          onClick={openRecCreate}
        >
          <PlusIcon size={14} />
          Nuevo gasto recurrente
        </button>
      );
    }
    return null;
  }, [tab, isAdmin]);

  const recurringKpis = useMemo(() => {
    const activeCount = recurringActive.length;
    const monthly = recurringActive.reduce(
      (sum, r) => sum + r.amount * (MONTHLY_FACTOR[r.frequency] ?? 0),
      0,
    );
    const annualCount = recurringActive.filter(
      (r) => r.frequency === 'annual',
    ).length;
    return { activeCount, monthly: Math.round(monthly), annualCount };
  }, [recurringActive]);

  if (!token) return <Navigate to="/login" replace />;
  if (me && !isAdmin && !isReceptionist) {
    return <Navigate to="/students" replace />;
  }

  const moduleTabs = (
    <div className="module-tabs">
      <div className="tab-group" role="tablist" aria-label="Pestañas de gastos">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'transacciones'}
          className={
            'tab-group__item' +
            (tab === 'transacciones' ? ' tab-group__item--active' : '')
          }
          onClick={() => setTab('transacciones')}
        >
          Transacciones
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recurrentes'}
          className={
            'tab-group__item' +
            (tab === 'recurrentes' ? ' tab-group__item--active' : '')
          }
          onClick={() => setTab('recurrentes')}
        >
          Gastos recurrentes
        </button>
      </div>
    </div>
  );

  return (
    <Layout title="Gastos" actions={headerActions}>
      {moduleTabs}

      {tab === 'transacciones' ? (
        <>
          <section className="summary-grid">
            {isReceptionist ? (
              <div className="summary-card">
                <p className="summary-card__label">Gastos pendientes</p>
                <div className="summary-card__value">
                  {summary === null ? '—' : summary.pending_count}
                </div>
              </div>
            ) : (
              <>
                <div className="summary-card">
                  <p className="summary-card__label">Egresos totales</p>
                  <div className="summary-card__value">
                    {summary === null ? '—' : formatMoney(summary.total, currency)}
                  </div>
                </div>
                <div className="summary-card">
                  <p className="summary-card__label"># Gastos</p>
                  <div className="summary-card__value">
                    {summary === null ? '—' : summary.total_count}
                  </div>
                </div>
                <div className="summary-card">
                  <p className="summary-card__label">Pagos realizados</p>
                  <div className="summary-card__value">
                    {summary === null ? '—' : formatMoney(summary.paid, currency)}
                  </div>
                </div>
                <div className="summary-card">
                  <p className="summary-card__label">Pendientes</p>
                  <div className="summary-card__value">
                    {summary === null
                      ? '—'
                      : formatMoney(summary.pending, currency)}
                  </div>
                </div>
              </>
            )}
          </section>

          <section className="filter-bar-stack">
            <div className="filter-bar">
              <div className="search-input">
                <SearchIcon size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por descripción o proveedor"
                  aria-label="Buscar gastos"
                />
              </div>
              <select
                className="select"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as TransactionCategory | '')
                }
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas las categorías</option>
                {categoriesForKind('expense').map((c) => (
                  <option key={c} value={c}>
                    {labelTransactionCategory(c)}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod | '')
                }
                aria-label="Filtrar por método de pago"
              >
                <option value="">Todos los métodos</option>
                {PAYMENT_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {labelPaymentMethod(m)}
                  </option>
                ))}
              </select>
              <div className="tab-group" role="tablist" aria-label="Estado">
                {STATUS_FILTERS.map((f) => (
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
            </div>
            <div className="filter-bar">
              <input
                type="date"
                className="input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Desde"
              />
              <input
                type="date"
                className="input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="Hasta"
              />
              <div className="tab-group" aria-label="Atajos de fecha">
                {SHORTCUTS.map((s) => {
                  const active = detectActiveShortcut(fromDate, toDate);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      className={
                        'tab-group__item' +
                        (active === s.value ? ' tab-group__item--active' : '')
                      }
                      onClick={() => {
                        const [f, t] = shortcutRange(s.value);
                        setFromDate(f);
                        setToDate(t);
                      }}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section>
            {listError && (
              <div
                className="alert"
                role="alert"
                style={{ marginBottom: 12 }}
              >
                {listError}
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
                    <SpinnerIcon size={16} /> Cargando gastos…
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-state__title">
                      Sin gastos en este rango
                    </p>
                    <p>Ajusta los filtros o crea uno nuevo.</p>
                  </div>
                ) : (
                  <table className="users-table">
                    <thead>
                      <tr>
                        <th className="table-cell--nowrap">Fecha</th>
                        <th>Proveedor / Beneficiario</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th>Método</th>
                        <th
                          className="table-cell--nowrap"
                          style={{ textAlign: 'right' }}
                        >
                          Monto
                        </th>
                        <th>Estado</th>
                        <th
                          className="table-cell--nowrap"
                          style={{ textAlign: 'right' }}
                        >
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => {
                        const providerLabel = t.user
                          ? `${t.user.first_name} ${t.user.last_name}`
                          : t.external_name ?? '—';
                        const canPay =
                          t.status === 'pending' || t.status === 'scheduled';
                        const canEdit =
                          isAdmin && t.status !== 'cancelled';
                        const canCancel =
                          isAdmin &&
                          t.status !== 'paid' &&
                          t.status !== 'cancelled';
                        return (
                          <tr key={t.id}>
                            <td className="table-cell--nowrap">
                              {formatDateShort(t.transaction_date)}
                            </td>
                            <td>
                              {providerLabel}
                              {!t.user && t.external_name && (
                                <span className="badge--external">Externo</span>
                              )}
                            </td>
                            <td className="table-cell--nowrap">
                              {labelTransactionCategory(t.category)}
                            </td>
                            <td>{t.description}</td>
                            <td className="table-cell--nowrap">
                              {t.payment_method ? (
                                labelPaymentMethod(t.payment_method)
                              ) : (
                                <span className="table-cell--muted">—</span>
                              )}
                            </td>
                            <td
                              className="table-cell--nowrap"
                              style={{ textAlign: 'right' }}
                            >
                              {formatMoney(t.amount, currency)}
                            </td>
                            <td>
                              <TransactionStatusBadge status={t.status} />
                            </td>
                            <td
                              className="table-cell--nowrap"
                              style={{ textAlign: 'right' }}
                            >
                              <div className="row-actions">
                                {canPay && (
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => openPay(t)}
                                    title="Registrar pago"
                                    aria-label="Registrar pago"
                                  >
                                    <CheckIcon size={14} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => openView(t)}
                                  title="Ver detalle"
                                  aria-label="Ver detalle"
                                >
                                  <EyeIcon size={14} />
                                </button>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => openEdit(t)}
                                    disabled={!canEdit}
                                    title="Editar"
                                    aria-label="Editar"
                                  >
                                    <PencilIcon size={14} />
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="icon-btn icon-btn--danger"
                                    onClick={() => setToCancel(t)}
                                    disabled={!canCancel}
                                    title="Cancelar"
                                    aria-label="Cancelar"
                                  >
                                    <TrashIcon size={14} />
                                  </button>
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
          </section>
        </>
      ) : (
        <>
          {!isReceptionist && (
            <section className="summary-grid">
              <div className="summary-card">
                <p className="summary-card__label">Recurrencias activas</p>
                <div className="summary-card__value">
                  {recurringKpis.activeCount}
                </div>
              </div>
              <div className="summary-card">
                <p className="summary-card__label">Egreso mensual proyectado</p>
                <div className="summary-card__value">
                  {formatMoney(recurringKpis.monthly, currency)}
                </div>
              </div>
              <div className="summary-card">
                <p className="summary-card__label">Cuotas anuales</p>
                <div className="summary-card__value">
                  {recurringKpis.annualCount}
                </div>
              </div>
            </section>
          )}

          <section className="filter-bar-stack">
            <div className="filter-bar">
              <div className="search-input">
                <SearchIcon size={16} />
                <input
                  type="search"
                  value={recSearch}
                  onChange={(e) => setRecSearch(e.target.value)}
                  placeholder="Buscar por descripción o proveedor"
                  aria-label="Buscar gastos recurrentes"
                />
              </div>
              <select
                className="select"
                value={recCategory}
                onChange={(e) =>
                  setRecCategory(e.target.value as TransactionCategory | '')
                }
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas las categorías</option>
                {categoriesForKind('expense').map((c) => (
                  <option key={c} value={c}>
                    {labelTransactionCategory(c)}
                  </option>
                ))}
              </select>
              <select
                className="select"
                value={recFrequency}
                onChange={(e) =>
                  setRecFrequency(
                    e.target.value as TransactionFrequency | '',
                  )
                }
                aria-label="Filtrar por frecuencia"
              >
                <option value="">Todas las frecuencias</option>
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {labelTransactionFrequency(f)}
                  </option>
                ))}
              </select>
              <div className="tab-group" role="tablist" aria-label="Estado">
                {ACTIVE_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    role="tab"
                    aria-selected={recActive === f.value}
                    className={
                      'tab-group__item' +
                      (recActive === f.value
                        ? ' tab-group__item--active'
                        : '')
                    }
                    onClick={() => setRecActive(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section>
            {recurringError && (
              <div
                className="alert"
                role="alert"
                style={{ marginBottom: 12 }}
              >
                {recurringError}
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
              {recurringLoading ? (
                <div className="loading-row">
                  <SpinnerIcon size={16} /> Cargando gastos recurrentes…
                </div>
              ) : recurringList.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state__title">
                    Sin gastos recurrentes que coincidan
                  </p>
                  <p>Ajusta los filtros o crea uno nuevo.</p>
                </div>
              ) : (
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Proveedor / Beneficiario</th>
                      <th>Categoría</th>
                      <th>Frecuencia</th>
                      <th className="table-cell--nowrap">Día de pago</th>
                      <th
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        Monto
                      </th>
                      <th className="table-cell--nowrap">Inicio</th>
                      <th className="table-cell--nowrap">Fin</th>
                      {isAdmin && (
                        <th
                          className="table-cell--nowrap"
                          style={{ textAlign: 'right' }}
                        >
                          Acciones
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {recurringList.map((r) => {
                      const providerLabel = r.user
                        ? `${r.user.first_name} ${r.user.last_name}`
                        : r.external_name ?? '—';
                      return (
                        <tr key={r.id}>
                          <td>
                            {providerLabel}
                            {!r.user && r.external_name && (
                              <span className="badge--external">Externo</span>
                            )}
                          </td>
                          <td className="table-cell--nowrap">
                            {labelTransactionCategory(r.category)}
                          </td>
                          <td className="table-cell--nowrap">
                            {labelTransactionFrequency(r.frequency)}
                          </td>
                          <td className="table-cell--nowrap">
                            {formatBillingDay(r.billing_day)}
                          </td>
                          <td
                            className="table-cell--nowrap"
                            style={{ textAlign: 'right' }}
                          >
                            {formatMoney(r.amount, currency)}
                          </td>
                          <td className="table-cell--nowrap">
                            {formatDateShort(r.start_date)}
                          </td>
                          <td className="table-cell--nowrap">
                            {formatDateShort(r.end_date)}
                          </td>
                          {isAdmin && (
                            <td
                              className="table-cell--nowrap"
                              style={{ textAlign: 'right' }}
                            >
                              <div className="row-actions">
                                <button
                                  type="button"
                                  className="icon-btn"
                                  onClick={() => openRecEdit(r)}
                                  title="Editar"
                                  aria-label="Editar"
                                >
                                  <PencilIcon size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn icon-btn--danger"
                                  onClick={() => setToDeactivate(r)}
                                  title="Desactivar"
                                  aria-label="Desactivar"
                                >
                                  <TrashIcon size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      <SidePanel
        open={panel?.kind === 'create'}
        title="Nuevo gasto"
        onClose={closePanel}
      >
        {panel?.kind === 'create' && (
          <TransactionForm
            kind="expense"
            mode="create"
            onSubmit={handleCreate}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'view'}
        title="Detalle del gasto"
        onClose={closePanel}
        footer={
          panel?.kind === 'view' ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={closePanel}
            >
              Cerrar
            </button>
          ) : undefined
        }
      >
        {panel?.kind === 'view' && (
          <TransactionDetails
            kind="expense"
            transaction={panel.tx}
            currency={currency}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'edit'}
        title="Editar gasto"
        subtitle={
          panel?.kind === 'edit' ? panel.tx.description : undefined
        }
        onClose={closePanel}
      >
        {panel?.kind === 'edit' && (
          <TransactionForm
            kind="expense"
            mode="edit"
            transaction={panel.tx}
            onSubmit={(payload) => handleEdit(panel.tx.id, payload)}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'pay'}
        title="Registrar pago"
        subtitle={panel?.kind === 'pay' ? panel.tx.description : undefined}
        onClose={closePanel}
      >
        {panel?.kind === 'pay' && (
          <RegisterPaymentForm
            transaction={panel.tx}
            defaultMethod={
              panel.tx.user_id && panel.tx.payment_method
                ? panel.tx.payment_method
                : null
            }
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
        title="Nuevo gasto recurrente"
        onClose={closePanel}
      >
        {panel?.kind === 'rec-create' && (
          <RecurringForm
            kind="expense"
            mode="create"
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
        title="Editar gasto recurrente"
        subtitle={panel?.kind === 'rec-edit' ? panel.rec.description : undefined}
        onClose={closePanel}
      >
        {panel?.kind === 'rec-edit' && (
          <RecurringForm
            kind="expense"
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
        open={!!toCancel}
        title="Cancelar gasto"
        message="¿Cancelar este gasto? Pasará a estado Cancelada."
        confirmLabel="Cancelar gasto"
        danger
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => !cancelling && setToCancel(null)}
      />

      <ConfirmModal
        open={!!toDeactivate}
        title="Desactivar gasto recurrente"
        message="Al desactivar, también se cancelarán todos los gastos futuros aún no vencidos. Las deudas vencidas y los pagos ya realizados no se tocan."
        confirmLabel="Desactivar"
        danger
        loading={deactivating}
        onConfirm={confirmDeactivate}
        onCancel={() => !deactivating && setToDeactivate(null)}
      />
    </Layout>
  );
}
