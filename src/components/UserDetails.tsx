import { useCallback, useEffect, useState } from 'react';
import type {
  AcademyMe,
  PaymentMethod,
  RecurringTransactionRead,
  TransactionUserRead,
  UserRead,
  UserRole,
} from '../types';
import { StatusBadge, TransactionStatusBadge } from './Badges';
import { GroupChips } from './GroupPicker';
import {
  CheckIcon,
  KeyIcon,
  PencilIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
} from '../brand';
import ConfirmModal from './ConfirmModal';
import InstructorPaySection from './InstructorPaySection';
import StudentAttendanceSection from './StudentAttendanceSection';
import UserDocumentsSection from './UserDocumentsSection';
import StudentDiscountsSection from './StudentDiscountsSection';
import {
  ApiError,
  deleteRecurringTransaction,
  listRecurringTransactions,
} from '../api';
import { formatMoney } from '../utils/money';
import {
  labelTransactionCategory,
  labelTransactionFrequency,
} from '../utils/salesLabels';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  credit_card: 'Tarjeta de crédito',
  debit_card: 'Tarjeta de débito',
  paypal: 'PayPal',
  bank_transfer: 'Transferencia bancaria',
  cash: 'Efectivo',
  ath_movil: 'ATH Móvil',
  waived: 'Sin cobro',
  other: 'Otro',
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
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

function Item({
  label,
  value,
  full,
}: {
  label: string;
  value: string | null | React.ReactNode;
  full?: boolean;
}) {
  const isEmpty =
    value === null || value === undefined || value === '' || value === '—';
  return (
    <div className={'detail-item' + (full ? ' detail-item--full' : '')}>
      <span className="detail-item__label">{label}</span>
      <span
        className={
          'detail-item__value' + (isEmpty ? ' detail-item__value--empty' : '')
        }
      >
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
}

interface UserDetailsProps {
  user: UserRead;
  role?: UserRole;
  academy?: AcademyMe | null;
  onEditRecurring?: (rec: RecurringTransactionRead) => void;
  onPayPending?: (tx: TransactionUserRead) => void;
  onCreateRecurring?: (category: 'tuition' | 'enrollment_fee') => void;
  onRefresh?: () => void;
  // Abre el panel de invitación. Solo se pasa a quien puede invitar (admin o
  // recepción): sin handler, el bloque de acceso queda informativo.
  onInvite?: () => void;
}

export default function UserDetails({
  user,
  role,
  academy,
  onEditRecurring,
  onPayPending,
  onCreateRecurring,
  onRefresh,
  onInvite,
}: UserDetailsProps) {
  const isStudent = role === 'student';
  const isInstructor = role === 'instructor';
  const currency = academy?.currency ?? null;

  const [recurringList, setRecurringList] = useState<
    RecurringTransactionRead[]
  >([]);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringError, setRecurringError] = useState<string | null>(null);

  const [toDeactivate, setToDeactivate] =
    useState<RecurringTransactionRead | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const fetchRecurring = useCallback(async () => {
    if (!isStudent) return;
    setRecurringLoading(true);
    setRecurringError(null);
    try {
      const data = await listRecurringTransactions({
        kind: 'sale',
        user_id: user.id,
        active: true,
      });
      setRecurringList(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los cobros recurrentes.';
      setRecurringError(message);
      setRecurringList([]);
    } finally {
      setRecurringLoading(false);
    }
  }, [isStudent, user.id]);

  useEffect(() => {
    fetchRecurring();
  }, [fetchRecurring]);

  const confirmDeactivate = async () => {
    if (!toDeactivate) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await deleteRecurringTransaction(toDeactivate.id);
      setToDeactivate(null);
      fetchRecurring();
      onRefresh?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo desactivar el cobro recurrente.';
      setDeactivateError(message);
    } finally {
      setDeactivating(false);
    }
  };

  const hasTuition = recurringList.some(
    (r) => r.category === 'tuition' && r.frequency === 'monthly',
  );
  const hasAnnual = recurringList.some(
    (r) => r.category === 'enrollment_fee' && r.frequency === 'annual',
  );
  const showCreateTuition = isStudent && !hasTuition && !!onCreateRecurring;
  const showCreateAnnual =
    isStudent &&
    !hasAnnual &&
    !!onCreateRecurring &&
    academy?.enrollment_fee_mode === 'annual_recurring';

  const pending = user.pending_transactions ?? [];

  return (
    <div>
      <div className="detail-list detail-list--cols">
        <Item
          label="Nombre completo"
          value={`${user.first_name} ${user.last_name}`}
          full
        />
        <Item label="Email" value={user.email} />
        <Item label="Estado" value={<StatusBadge status={user.status} />} />
        {/* `status` es el estado en la academia; el acceso a la app es otra capa
            (correo + contraseña) y por eso se muestra aparte. */}
        <Item
          label="Acceso a la plataforma"
          full
          value={
            user.has_access ? (
              'Entra con su correo y contraseña'
            ) : (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                {user.status === 'pending' && user.email
                  ? 'Invitación pendiente'
                  : 'Sin acceso'}
                {onInvite && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={onInvite}
                  >
                    <KeyIcon size={14} />
                    {user.status === 'pending' && user.email
                      ? 'Reenviar invitación'
                      : 'Invitar'}
                  </button>
                )}
              </span>
            )
          }
        />
        <Item label="Teléfono" value={user.phone} />
        <Item
          label="Fecha de nacimiento"
          value={formatDate(user.date_of_birth)}
        />
        <Item label="Fecha de inicio" value={formatDate(user.start_date)} />
        <Item
          label="Método de pago"
          value={
            user.payment_method ? PAYMENT_LABELS[user.payment_method] : null
          }
        />
        <Item label="Dirección" value={user.address} full />
        <Item
          label="Condiciones especiales"
          value={user.special_conditions}
          full
        />
        {isStudent && (
          <>
            <Item
              label="Deuda"
              value={
                user.debt_amount && user.debt_amount > 0 ? (
                  <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                    {formatMoney(user.debt_amount, currency)}
                  </span>
                ) : (
                  formatMoney(0, currency)
                )
              }
            />
            <Item
              label="Próximo pago"
              value={
                user.next_due_date
                  ? `${formatDate(user.next_due_date)} · ${formatMoney(
                      user.next_due_amount,
                      currency,
                    )}`
                  : null
              }
            />
            <Item
              label="Grupos"
              value={
                user.groups && user.groups.length > 0 ? (
                  <GroupChips groups={user.groups} />
                ) : null
              }
              full
            />
          </>
        )}
      </div>

      {isStudent && (
        <>
          <section className="form-section" style={{ marginTop: 24 }}>
            <h4 className="form-section__title">Cobros recurrentes</h4>

            {recurringError && (
              <div className="alert" role="alert" style={{ marginBottom: 12 }}>
                {recurringError}
              </div>
            )}

            {recurringLoading ? (
              <div className="loading-row">
                <SpinnerIcon size={16} /> Cargando…
              </div>
            ) : recurringList.length === 0 ? (
              <p
                className="empty-state__title"
                style={{ marginTop: 8, marginBottom: 8, fontSize: 14 }}
              >
                Sin cobros recurrentes activos.
              </p>
            ) : (
              <div className="detail-list" style={{ gap: 12 }}>
                {recurringList.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {labelTransactionCategory(r.category)} ·{' '}
                        {labelTransactionFrequency(r.frequency)}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          marginTop: 2,
                        }}
                      >
                        {formatMoney(r.amount, currency)}
                        {r.billing_day !== null && ` · Día ${r.billing_day}`}
                        {r.start_date && ` · Inicio ${formatDateShort(r.start_date)}`}
                        {r.end_date && ` · Fin ${formatDateShort(r.end_date)}`}
                      </div>
                    </div>
                    <div className="row-actions">
                      {onEditRecurring && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => onEditRecurring(r)}
                          title="Editar"
                          aria-label="Editar"
                        >
                          <PencilIcon size={14} />
                        </button>
                      )}
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
                  </div>
                ))}
              </div>
            )}

            {(showCreateTuition || showCreateAnnual) && (
              <div
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}
              >
                {showCreateTuition && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onCreateRecurring?.('tuition')}
                  >
                    <PlusIcon size={14} />
                    Crear mensualidad
                  </button>
                )}
                {showCreateAnnual && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => onCreateRecurring?.('enrollment_fee')}
                  >
                    <PlusIcon size={14} />
                    Crear cuota anual
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="form-section" style={{ marginTop: 16 }}>
            <h4 className="form-section__title">Historial y deudas</h4>
            {pending.length === 0 ? (
              <p
                className="empty-state__title"
                style={{ marginTop: 8, marginBottom: 8, fontSize: 14 }}
              >
                Sin cobros pendientes ni programados.
              </p>
            ) : (
              <div className="table-wrapper" style={{ marginTop: 8 }}>
                <table className="users-table">
                  <thead>
                    <tr>
                      <th className="table-cell--nowrap">Fecha</th>
                      <th>Descripción</th>
                      <th className="table-cell--nowrap">Categoría</th>
                      <th
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        Monto
                      </th>
                      <th>Estado</th>
                      {onPayPending && (
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
                    {pending.map((t) => (
                      <tr key={t.id}>
                        <td className="table-cell--nowrap">
                          {formatDateShort(t.transaction_date)}
                        </td>
                        <td>{t.description}</td>
                        <td className="table-cell--nowrap">
                          {labelTransactionCategory(t.category)}
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
                        {onPayPending && (
                          <td
                            className="table-cell--nowrap"
                            style={{ textAlign: 'right' }}
                          >
                            {(t.status === 'pending' ||
                              t.status === 'scheduled') && (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => onPayPending(t)}
                                title="Pagar"
                                aria-label="Pagar"
                              >
                                <CheckIcon size={14} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <StudentDiscountsSection userId={user.id} editable={false} />

          <StudentAttendanceSection studentId={user.id} />
        </>
      )}

      {isInstructor && (
        <InstructorPaySection instructorId={user.id} currency={currency} />
      )}

      <UserDocumentsSection userId={user.id} editable={false} />

      <ConfirmModal
        open={!!toDeactivate}
        title="Desactivar cobro recurrente"
        message={
          deactivateError ??
          'Al desactivar, también se cancelarán todos los cobros futuros aún no vencidos. Las deudas vencidas y los pagos ya realizados no se tocan.'
        }
        confirmLabel="Desactivar"
        danger
        loading={deactivating}
        onConfirm={confirmDeactivate}
        onCancel={() => {
          if (!deactivating) {
            setToDeactivate(null);
            setDeactivateError(null);
          }
        }}
      />
    </div>
  );
}
