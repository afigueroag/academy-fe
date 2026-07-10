import type { AnnouncementRead } from '../types';
import { AnnouncementStatusBadge } from './Badges';
import { labelAnnouncementCategory } from '../utils/announcements';
import { UsersIcon } from '../brand';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AnnouncementDetailProps {
  announcement: AnnouncementRead;
  onViewRecipients?: () => void;
}

// Vista de solo lectura de un comunicado no editable (sending/sent/failed/scheduled).
// Incluye la barra de progreso del envío.
export default function AnnouncementDetail({
  announcement: a,
  onViewRecipients,
}: AnnouncementDetailProps) {
  const done = a.sent_count + a.failed_count;
  const pct =
    a.total_recipients > 0
      ? Math.min(100, Math.round((done / a.total_recipients) * 100))
      : 0;
  const showProgress =
    a.status === 'sending' || a.status === 'sent' || a.status === 'failed';

  return (
    <div className="announcement-detail">
      <div className="announcement-detail__head">
        <span className="badge badge--qualitative">
          {labelAnnouncementCategory(a.category)}
        </span>
        <AnnouncementStatusBadge status={a.status} />
      </div>

      <h3 className="announcement-detail__subject">
        {a.subject?.trim() || 'Sin asunto'}
      </h3>

      <div className="announcement-detail__body">{a.body}</div>

      {showProgress && (
        <div className="send-progress">
          <div className="send-progress__bar">
            <div
              className={
                'send-progress__fill' +
                (a.status === 'sending' ? ' send-progress__fill--active' : '')
              }
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="send-progress__label">
            {a.status === 'sending'
              ? `Enviando… ${done} de ${a.total_recipients}`
              : `${a.sent_count} enviados`}
            {a.failed_count > 0 && (
              <span className="send-progress__failed">
                {' '}
                · {a.failed_count} fallidos
              </span>
            )}
          </p>
        </div>
      )}

      <div className="detail-list detail-list--cols">
        <div className="detail-item">
          <div className="detail-item__label">Destinatarios</div>
          <div className="detail-item__value">{a.total_recipients}</div>
        </div>
        <div className="detail-item">
          <div className="detail-item__label">Enviados</div>
          <div className="detail-item__value">{a.sent_count}</div>
        </div>
        <div className="detail-item">
          <div className="detail-item__label">Fallidos</div>
          <div className="detail-item__value">{a.failed_count}</div>
        </div>
        <div className="detail-item">
          <div className="detail-item__label">Fecha de envío</div>
          <div
            className={
              'detail-item__value' +
              (a.sent_at ? '' : ' detail-item__value--empty')
            }
          >
            {formatDateTime(a.sent_at)}
          </div>
        </div>
        <div className="detail-item">
          <div className="detail-item__label">Creado</div>
          <div
            className={
              'detail-item__value' +
              (a.created_at ? '' : ' detail-item__value--empty')
            }
          >
            {formatDateTime(a.created_at)}
          </div>
        </div>
      </div>

      {onViewRecipients && a.total_recipients > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={onViewRecipients}
        >
          <UsersIcon size={16} /> Ver destinatarios
        </button>
      )}
    </div>
  );
}
