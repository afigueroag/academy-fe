import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { ApiError, getToken, listMyAnnouncements } from '../api';
import type { AnnouncementRead } from '../types';
import { SpinnerIcon } from '../brand';
import { labelAnnouncementCategory } from '../utils/announcements';

function formatDateTime(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Bandeja de entrada de solo lectura del alumno. Solo se muestran subject, body,
// category y sent_at; el resto de campos administrativos se ignora.
export default function StudentAnnouncements() {
  const token = getToken();
  const [items, setItems] = useState<AnnouncementRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listMyAnnouncements({ limit: 100 });
        if (active) setItems(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'No se pudieron cargar los comunicados.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <Layout title="Comunicados">
      <section>
        {error && (
          <div className="alert" role="alert" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-row">
            <SpinnerIcon size={16} /> Cargando comunicados…
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">Sin comunicados</p>
            <p>Aquí aparecerán los avisos que te envíe tu academia.</p>
          </div>
        ) : (
          <div className="inbox-list">
            {items.map((a) => (
              <article key={a.id} className="inbox-item">
                <div className="inbox-item__head">
                  <span className="badge badge--qualitative">
                    {labelAnnouncementCategory(a.category)}
                  </span>
                  {a.sent_at && (
                    <span className="inbox-item__date">
                      {formatDateTime(a.sent_at)}
                    </span>
                  )}
                </div>
                <h3 className="inbox-item__subject">
                  {a.subject?.trim() || 'Sin asunto'}
                </h3>
                <div className="inbox-item__body">{a.body}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
