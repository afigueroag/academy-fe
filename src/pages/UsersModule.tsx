import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import ConfirmModal from '../components/ConfirmModal';
import StatusBadge from '../components/StatusBadge';
import UserForm from '../components/UserForm';
import InviteForm from '../components/InviteForm';
import InviteResult from '../components/InviteResult';
import UserDetails from '../components/UserDetails';
import {
  ApiError,
  createUser,
  deleteUser,
  getToken,
  inviteUser,
  listUsers,
  updateUser,
} from '../api';
import type {
  UserCreate,
  UserInvite,
  UserRead,
  UserRole,
  UserStatus,
  UserUpdate,
} from '../types';
import {
  EyeIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from '../brand';

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
}

type Filter = UserStatus | 'all';

type PanelState =
  | { kind: 'invite' }
  | { kind: 'create' }
  | { kind: 'edit'; user: UserRead }
  | { kind: 'view'; user: UserRead }
  | null;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'Activos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'all', label: 'Todos' },
];

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
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
  } = props;

  const token = getToken();

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
  }, [role, status, debouncedSearch]);

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

  const handleCreate = async (payload: UserCreate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await createUser(payload);
      showToast(`${payload.first_name} ${payload.last_name} creado`);
      setPanel(null);
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
                  <th>Nombre completo</th>
                  <th>Email</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
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
                    <td>{u.email ?? '—'}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="row-actions">
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
                ))}
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
        {panel?.kind === 'view' && <UserDetails user={panel.user} />}
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
