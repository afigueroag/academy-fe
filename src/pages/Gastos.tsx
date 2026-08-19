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
import Paginator from '../components/Paginator';
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
  labelRecurringState,
  labelTransactionCategory,
  labelTransactionFrequency,
} from '../utils/salesLabels';

type Tab = 'transacciones' | 'recurrentes';
type StatusFilter = TransactionStatus | 'all';
type ActiveFilter = 'true' | 'false';

type PanelState =
  | { kind: 'create' }
  | { kind: 'view'; tx: TransactionRead }
  | { kind: 'edit'; tx: TransactionRead }
  | { kind: 'pay'; tx: TransactionRead }
  | { kind: 'rec-create' }
  | { kind: 'rec-edit'; rec: RecurringTransactionRead }
  | null;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  // "Todas" ya no incluye las anuladas: sin `status`, el backend devuelve
  // scheduled + pending + paid. Y `status=cancelled` es excluyente (solo
  // anuladas), así que esto tiene que ser un selector, nunca una casilla que
  // sume al conjunto actual.
  { value: 'all', label: 'Todos menos anulados' },
  { value: 'pending', label: 'Por pagar' },
  { value: 'paid', label: 'Pagados' },
  { value: 'scheduled', label: 'Programados' },
  { value: 'cancelled', label: 'Anulados' },
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

// `active` es booleano con default `true` en el backend: o activas, o
// canceladas. No existe "tráeme las dos", así que tampoco puede haber un
// "Todos" que prometa lo que no se puede pedir.
const ACTIVE_FILTERS: { value: ActiveFilter; label: string }[] = [
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Cancelados' },
];

// Tamaño de página de las dos listas. Mismo criterio que el módulo de usuarios;
// el backend acepta de 1 a 200 y responde 422 por encima.
const PAGE_SIZE = 100;

// Tope por petición al recorrer TODOS los recurrentes activos para los KPIs.
// Es el máximo que acepta el backend, así que minimiza el número de vueltas.
const MAX_LIMIT = 200;

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
  // Página actual (base 0) y total con los filtros aplicados (X-Total-Count).
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Recurring tab state
  const [recurringList, setRecurringList] = useState<RecurringTransactionRead[]>(
    [],
  );
  const [recurringActive, setRecurringActive] = useState<
    RecurringTransactionRead[]
  >([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringError, setRecurringError] = useState<string | null>(null);
  const [recPage, setRecPage] = useState(0);
  const [recTotal, setRecTotal] = useState(0);
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

  const [toDelete, setToDelete] = useState<TransactionRead | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  // Contadores de petición: una respuesta que llega tarde (cambió el filtro
  // mientras viajaba) no debe pintar filas viejas sobre las nuevas. Pasa de
  // verdad al cambiar de filtro desde una página > 0: el reset a la página 0 se
  // aplica en el render siguiente, así que salen dos peticiones y la primera
  // puede contestar de última.
  const listSeq = useRef(0);
  const recSeq = useRef(0);

  // Un solo objeto de filtros para el listado y para el resumen: son los mismos
  // parámetros y los totales de la cabecera tienen que describir exactamente las
  // filas que se están viendo. Manteniéndolos en dos sitios se desalineaban.
  const filters = useMemo(
    () => ({
      kind: 'expense' as const,
      status: status === 'all' ? undefined : status,
      category: category || undefined,
      payment_method: paymentMethod || undefined,
      search: debouncedSearch || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    }),
    [status, category, paymentMethod, debouncedSearch, fromDate, toDate],
  );

  const fetchList = useCallback(async () => {
    const seq = ++listSeq.current;
    setLoading(true);
    setListError(null);
    try {
      const data = await listTransactions({
        ...filters,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (seq !== listSeq.current) return;
      setTransactions(data.items);
      setTotal(data.total);
      // La página se quedó fuera de rango (p. ej. se borró la última fila de la
      // última página): retroceder en vez de mostrar una lista vacía.
      if (data.items.length === 0 && page > 0) setPage((n) => Math.max(0, n - 1));
    } catch (err) {
      if (seq !== listSeq.current) return;
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los gastos.';
      setListError(message);
      setTransactions([]);
      setTotal(0);
    } finally {
      // Solo la petición vigente apaga el spinner: si lo apagara la que llegó
      // tarde, la lista parpadearía a "listo" con la nueva aún en vuelo.
      if (seq === listSeq.current) setLoading(false);
    }
  }, [filters, page]);

  // Cualquier cambio de filtro invalida la página en la que se estaba: la 3 de
  // un listado ya no es la 3 del siguiente.
  useEffect(() => {
    setPage(0);
  }, [filters]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await getTransactionsSummary(filters);
      setSummary(data);
    } catch {
      setSummary(null);
    }
  }, [filters]);

  const fetchRecurring = useCallback(async () => {
    const seq = ++recSeq.current;
    setRecurringLoading(true);
    setRecurringError(null);
    try {
      const data = await listRecurringTransactions({
        kind: 'expense',
        category: recCategory || undefined,
        frequency: recFrequency || undefined,
        active: recActive === 'true',
        search: recDebouncedSearch || undefined,
        skip: recPage * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      if (seq !== recSeq.current) return;
      setRecurringList(data.items);
      setRecTotal(data.total);
      if (data.items.length === 0 && recPage > 0)
        setRecPage((n) => Math.max(0, n - 1));
    } catch (err) {
      if (seq !== recSeq.current) return;
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los gastos recurrentes.';
      setRecurringError(message);
      setRecurringList([]);
      setRecTotal(0);
    } finally {
      if (seq === recSeq.current) setRecurringLoading(false);
    }
  }, [recCategory, recFrequency, recActive, recDebouncedSearch, recPage]);

  useEffect(() => {
    setRecPage(0);
  }, [recCategory, recFrequency, recActive, recDebouncedSearch]);

  // Los KPIs suman importes de TODOS los recurrentes activos, no de una página,
  // así que aquí sí hay que recorrer el listado entero. Se pide en tandas del
  // máximo que acepta el backend (antes se pedía `limit: 1000`, que hoy sería un
  // 422) y se corta con el total del header.
  const fetchRecurringActive = useCallback(async () => {
    try {
      const all: RecurringTransactionRead[] = [];
      let skip = 0;
      for (;;) {
        const data = await listRecurringTransactions({
          kind: 'expense',
          active: true,
          skip,
          limit: MAX_LIMIT,
        });
        all.push(...data.items);
        skip += data.items.length;
        // Corta por página incompleta y NO por `skip >= data.total`: si el
        // header no llegó, `total` cae a lo ya leído y el corte por total se
        // cumpliría siempre, dejando los KPIs con solo la primera tanda.
        if (data.items.length < MAX_LIMIT) break;
      }
      setRecurringActive(all);
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

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteTransaction(toDelete.id);
      showToast('Gasto eliminado');
      setToDelete(null);
      refreshAll();
    } catch (err) {
      let message = 'No se pudo eliminar el gasto.';
      if (err instanceof ApiError) {
        if (err.status === 409) {
          message =
            'No se puede eliminar: el gasto ya fue pagado o tiene un pago en curso.';
        } else if (err.status === 404) {
          message = 'El gasto ya no existe.';
        }
      }
      showToast(message);
    } finally {
      setDeleting(false);
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
                  {/* `total` suma también lo `scheduled` (cargos futuros ya
                      generados, hasta dos meses): decir "Egresos totales" a
                      secas se lee como dinero que salió y no lo es. */}
                  <p className="summary-card__label">
                    Comprometido (incl. programado)
                  </p>
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
                  <p className="summary-card__label">Pagado</p>
                  <div className="summary-card__value">
                    {summary === null ? '—' : formatMoney(summary.paid, currency)}
                  </div>
                </div>
                <div className="summary-card">
                  <p className="summary-card__label">Por pagar</p>
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
              {/* Con token de recepción el backend acota lista y summary a
                  `pending`: es alcance por rol, no un filtro que el front pueda
                  apagar. Ofrecer los estados sería ofrecer botones inertes. */}
              {!isReceptionist && (
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
              )}
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

            {!loading && !listError && (
              <Paginator
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                shown={transactions.length}
                position="top"
                onChange={setPage}
              />
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
                        {/* Orden fijo del backend: por fecha de la
                            transacción, de la más reciente a la más antigua. */}
                        <th className="table-cell--nowrap" aria-sort="descending">
                          Fecha
                          <span
                            className="table-sort"
                            title="Orden fijo del listado"
                          >
                            ↓ recientes
                          </span>
                        </th>
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
                        // Editable en cualquier estado: permite corregir un
                        // gasto marcado como pagado o cancelado por error.
                        const canEdit = isAdmin;
                        // También para los pagados: si el backend tiene un pago
                        // real asociado responde 409 y se avisa al usuario.
                        const canDelete = isAdmin;
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
                                    onClick={() => setToDelete(t)}
                                    disabled={!canDelete}
                                    title="Eliminar"
                                    aria-label="Eliminar"
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

            {!loading && !listError && (
              <Paginator
                page={page}
                pageSize={PAGE_SIZE}
                total={total}
                shown={transactions.length}
                onChange={setPage}
              />
            )}
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

            {!recurringLoading && !recurringError && (
              <Paginator
                page={recPage}
                pageSize={PAGE_SIZE}
                total={recTotal}
                shown={recurringList.length}
                position="top"
                onChange={setRecPage}
              />
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
                      <th>Estado</th>
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
                          <td>
                            {(() => {
                              const st = labelRecurringState(r);
                              return (
                                <span className={`badge ${st.className}`}>
                                  {st.label}
                                </span>
                              );
                            })()}
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

            {!recurringLoading && !recurringError && (
              <Paginator
                page={recPage}
                pageSize={PAGE_SIZE}
                total={recTotal}
                shown={recurringList.length}
                onChange={setRecPage}
              />
            )}
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
        open={!!toDelete}
        title="Eliminar gasto"
        message="¿Eliminar este gasto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
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
