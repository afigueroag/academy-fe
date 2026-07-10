import { useCallback, useEffect, useState } from 'react';
import type { AnnouncementRecipientRead, DeliveryStatus } from '../types';
import { ApiError, listRecipients, resendRecipient } from '../api';
import { DeliveryStatusBadge } from './Badges';
import { SpinnerIcon } from '../brand';
import { DELIVERY_STATUSES, labelDeliveryStatus } from '../utils/announcements';
import { formatMoney } from '../utils/money';

interface RecipientsPanelProps {
  announcementId: number;
  isAdmin: boolean;
}

// Detalle de destinatarios de un comunicado, con filtro por estado y reenvío de
// los fallidos (solo admin).
export default function RecipientsPanel({
  announcementId,
  isAdmin,
}: RecipientsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [recipients, setRecipients] = useState<AnnouncementRecipientRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRecipients(announcementId, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 1000,
      });
      setRecipients(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los destinatarios.',
      );
      setRecipients([]);
    } finally {
      setLoading(false);
    }
  }, [announcementId, statusFilter]);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const handleResend = async (recipientId: number) => {
    setResendingId(recipientId);
    setRowError(null);
    try {
      const updated = await resendRecipient(announcementId, recipientId);
      setRecipients((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r)),
      );
    } catch (err) {
      setRowError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo reenviar a este destinatario.',
      );
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="recipients-panel">
      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="tab-group" role="tablist" aria-label="Estado de entrega">
          <button
            type="button"
            role="tab"
            aria-selected={statusFilter === 'all'}
            className={
              'tab-group__item' +
              (statusFilter === 'all' ? ' tab-group__item--active' : '')
            }
            onClick={() => setStatusFilter('all')}
          >
            Todos
          </button>
          {DELIVERY_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={statusFilter === s}
              className={
                'tab-group__item' +
                (statusFilter === s ? ' tab-group__item--active' : '')
              }
              onClick={() => setStatusFilter(s)}
            >
              {labelDeliveryStatus(s)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      {rowError && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {rowError}
        </div>
      )}

      <div className="table-wrapper">
        {loading ? (
          <div className="loading-row">
            <SpinnerIcon size={16} /> Cargando destinatarios…
          </div>
        ) : recipients.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">Sin destinatarios</p>
            <p>No hay destinatarios con este estado.</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Destinatario</th>
                <th>Estado</th>
                {isAdmin && (
                  <th className="table-cell--nowrap" style={{ textAlign: 'right' }}>
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="user-cell__name">
                      {r.recipient_name || r.destination}
                    </div>
                    {r.recipient_name && (
                      <div className="table-cell--muted">{r.destination}</div>
                    )}
                    {r.context && (
                      <div className="recipients-panel__context">
                        Saldo recordado:{' '}
                        {formatMoney(r.context.amount, r.context.currency)}
                        {r.context.items.length > 0 &&
                          ` · ${r.context.items.length} ${
                            r.context.items.length === 1 ? 'adeudo' : 'adeudos'
                          }`}
                      </div>
                    )}
                    {r.status === 'failed' && r.error && (
                      <div className="recipients-panel__error">{r.error}</div>
                    )}
                  </td>
                  <td>
                    <DeliveryStatusBadge status={r.status} />
                  </td>
                  {isAdmin && (
                    <td
                      className="table-cell--nowrap"
                      style={{ textAlign: 'right' }}
                    >
                      {r.status === 'failed' && (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => handleResend(r.id)}
                          disabled={resendingId === r.id}
                        >
                          {resendingId === r.id && <SpinnerIcon size={14} />}
                          Reenviar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
