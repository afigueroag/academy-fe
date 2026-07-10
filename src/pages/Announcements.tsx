import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import ConfirmModal from '../components/ConfirmModal';
import AnnouncementComposer from '../components/AnnouncementComposer';
import AnnouncementDetail from '../components/AnnouncementDetail';
import RecipientsPanel from '../components/RecipientsPanel';
import { AnnouncementStatusBadge } from '../components/Badges';
import { useAuth } from '../auth';
import {
  ApiError,
  deleteAnnouncement,
  getAnnouncement,
  getToken,
  listAnnouncements,
  suggestDebtReminder,
} from '../api';
import type {
  AnnouncementCategory,
  AnnouncementCreate,
  AnnouncementRead,
  AnnouncementStatus,
  AnnouncementTemplate,
} from '../types';
import { EyeIcon, MailIcon, PencilIcon, PlusIcon, SearchIcon, SpinnerIcon, TrashIcon } from '../brand';
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_STATUSES,
  announcementTitle,
  labelAnnouncementCategory,
  labelAnnouncementStatus,
} from '../utils/announcements';

type Panel =
  | {
      kind: 'compose';
      announcement?: AnnouncementRead;
      initial?: AnnouncementCreate | null;
      template?: AnnouncementTemplate;
    }
  | { kind: 'detail'; announcement: AnnouncementRead }
  | { kind: 'recipients'; announcement: AnnouncementRead }
  | null;

function formatDateShort(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
}

// ¿Puede reenviar a un destinatario fallido de este comunicado?
function canResend(
  role: string | undefined,
  a: AnnouncementRead | null,
): boolean {
  if (role === 'admin') return true;
  return role === 'receptionist' && a?.template === 'debt_reminder';
}

export default function Announcements() {
  const token = getToken();
  const { me } = useAuth();
  const role = me?.role;

  const [status, setStatus] = useState<AnnouncementStatus | 'all'>('all');
  const [category, setCategory] = useState<AnnouncementCategory | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [items, setItems] = useState<AnnouncementRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [panel, setPanel] = useState<Panel>(null);
  const [debtLoading, setDebtLoading] = useState(false);

  const [toDelete, setToDelete] = useState<AnnouncementRead | null>(null);
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

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listAnnouncements({
        status: status === 'all' ? undefined : status,
        category: category || undefined,
        search: debouncedSearch || undefined,
      });
      setItems(data);
    } catch (err) {
      setListError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar los comunicados.',
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, category, debouncedSearch]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Polling del detalle abierto desde la lista mientras esté "sending".
  const detailId = panel?.kind === 'detail' ? panel.announcement.id : null;
  const detailStatus = panel?.kind === 'detail' ? panel.announcement.status : null;
  useEffect(() => {
    if (detailId == null || detailStatus !== 'sending') return;
    const interval = window.setInterval(async () => {
      try {
        const fresh = await getAnnouncement(detailId);
        setPanel((p) =>
          p?.kind === 'detail' && p.announcement.id === detailId
            ? { kind: 'detail', announcement: fresh }
            : p,
        );
        if (fresh.status !== 'sending') fetchList();
      } catch {
        /* reintenta */
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [detailId, detailStatus, fetchList]);

  const closePanel = useCallback(() => {
    setPanel(null);
  }, []);

  const openCreate = () => setPanel({ kind: 'compose' });
  const openEdit = (a: AnnouncementRead) =>
    setPanel({ kind: 'compose', announcement: a });
  const openDetail = (a: AnnouncementRead) =>
    setPanel({ kind: 'detail', announcement: a });

  const openDebtBulk = async () => {
    setDebtLoading(true);
    try {
      const suggested = await suggestDebtReminder();
      setPanel({
        kind: 'compose',
        initial: suggested,
        template: 'debt_reminder',
      });
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'No se pudo preparar el recordatorio de deuda.',
      );
    } finally {
      setDebtLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteAnnouncement(toDelete.id);
      showToast('Borrador eliminado');
      setToDelete(null);
      fetchList();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar el borrador.',
      );
    } finally {
      setDeleting(false);
    }
  };

  if (!token) return <Navigate to="/login" replace />;

  const actions = (
    <>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={openDebtBulk}
        disabled={debtLoading}
      >
        {debtLoading ? <SpinnerIcon size={14} /> : <MailIcon size={14} />}
        Recordatorio de deuda
      </button>
      <button type="button" className="btn btn--primary" onClick={openCreate}>
        <PlusIcon size={14} /> Nuevo comunicado
      </button>
    </>
  );

  const composeTitle =
    panel?.kind === 'compose'
      ? panel.template === 'debt_reminder'
        ? 'Recordatorio de deuda'
        : panel.announcement
          ? 'Editar comunicado'
          : 'Nuevo comunicado'
      : '';

  return (
    <Layout title="Comunicados" actions={actions}>
      <section className="filter-bar-stack">
        <div className="filter-bar">
          <div className="search-input">
            <SearchIcon size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por asunto o contenido"
              aria-label="Buscar comunicados"
            />
          </div>
          <select
            className="select"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as AnnouncementCategory | '')
            }
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labelAnnouncementCategory(c)}
              </option>
            ))}
          </select>
          <div className="tab-group" role="tablist" aria-label="Estado">
            <button
              type="button"
              role="tab"
              aria-selected={status === 'all'}
              className={
                'tab-group__item' +
                (status === 'all' ? ' tab-group__item--active' : '')
              }
              onClick={() => setStatus('all')}
            >
              Todos
            </button>
            {ANNOUNCEMENT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={status === s}
                className={
                  'tab-group__item' +
                  (status === s ? ' tab-group__item--active' : '')
                }
                onClick={() => setStatus(s)}
              >
                {labelAnnouncementStatus(s)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        {listError && (
          <div className="alert" role="alert" style={{ marginBottom: 12 }}>
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
              <SpinnerIcon size={16} /> Cargando comunicados…
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">Sin comunicados</p>
              <p>Crea uno nuevo o ajusta los filtros.</p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Asunto</th>
                  <th>Categoría</th>
                  <th>Estado</th>
                  <th className="table-cell--nowrap" style={{ textAlign: 'right' }}>
                    Enviados
                  </th>
                  <th className="table-cell--nowrap">Fecha</th>
                  <th className="table-cell--nowrap" style={{ textAlign: 'right' }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => {
                  const isDraft = a.status === 'draft';
                  return (
                    <tr key={a.id}>
                      <td>{announcementTitle(a.subject, a.body)}</td>
                      <td className="table-cell--nowrap">
                        <span className="badge badge--qualitative">
                          {labelAnnouncementCategory(a.category)}
                        </span>
                      </td>
                      <td>
                        <AnnouncementStatusBadge status={a.status} />
                      </td>
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        {a.sent_count}/{a.total_recipients}
                      </td>
                      <td className="table-cell--nowrap">
                        {formatDateShort(a.sent_at ?? a.created_at)}
                      </td>
                      <td
                        className="table-cell--nowrap"
                        style={{ textAlign: 'right' }}
                      >
                        <div className="row-actions">
                          {isDraft ? (
                            <>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => openEdit(a)}
                                title="Editar"
                                aria-label="Editar"
                              >
                                <PencilIcon size={14} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn icon-btn--danger"
                                onClick={() => setToDelete(a)}
                                title="Eliminar"
                                aria-label="Eliminar"
                              >
                                <TrashIcon size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => openDetail(a)}
                              title="Ver detalle"
                              aria-label="Ver detalle"
                            >
                              <EyeIcon size={14} />
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

      {/* Composición / edición / recordatorio de deuda */}
      <SidePanel
        open={panel?.kind === 'compose'}
        title={composeTitle}
        onClose={closePanel}
      >
        {panel?.kind === 'compose' && (
          <AnnouncementComposer
            existing={panel.announcement}
            initial={panel.initial}
            template={panel.template}
            role={role}
            onClose={closePanel}
            onChanged={fetchList}
          />
        )}
      </SidePanel>

      {/* Detalle (solo lectura) + progreso de envío */}
      <SidePanel
        open={panel?.kind === 'detail'}
        title="Detalle del comunicado"
        onClose={closePanel}
        footer={
          <button type="button" className="btn btn--ghost" onClick={closePanel}>
            Cerrar
          </button>
        }
      >
        {panel?.kind === 'detail' && (
          <AnnouncementDetail
            announcement={panel.announcement}
            onViewRecipients={() =>
              setPanel({ kind: 'recipients', announcement: panel.announcement })
            }
          />
        )}
      </SidePanel>

      {/* Destinatarios */}
      <SidePanel
        open={panel?.kind === 'recipients'}
        title="Destinatarios"
        subtitle={
          panel?.kind === 'recipients'
            ? announcementTitle(
                panel.announcement.subject,
                panel.announcement.body,
              )
            : undefined
        }
        onClose={() =>
          panel?.kind === 'recipients'
            ? setPanel({ kind: 'detail', announcement: panel.announcement })
            : closePanel()
        }
        footer={
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() =>
              panel?.kind === 'recipients'
                ? setPanel({ kind: 'detail', announcement: panel.announcement })
                : closePanel()
            }
          >
            Volver
          </button>
        }
      >
        {panel?.kind === 'recipients' && (
          <RecipientsPanel
            announcementId={panel.announcement.id}
            isAdmin={canResend(role, panel.announcement)}
          />
        )}
      </SidePanel>

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar borrador"
        message="¿Eliminar este borrador? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </Layout>
  );
}
