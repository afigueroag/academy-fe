import { useCallback, useEffect, useRef, useState } from 'react';
import SidePanel from './SidePanel';
import ConfirmModal from './ConfirmModal';
import PaymentAccountForm from './PaymentAccountForm';
import PaymentAccountTestPanel from './PaymentAccountTestPanel';
import {
  ApiError,
  createPaymentAccount,
  deletePaymentAccount,
  listPaymentAccounts,
  updatePaymentAccount,
} from '../api';
import type {
  PaymentAccountCreate,
  PaymentAccountRead,
  PaymentAccountUpdate,
  PaymentEnvironment,
  PaymentProvider,
} from '../types';
import { PencilIcon, PlusIcon, SpinnerIcon, TrashIcon } from '../brand';
import { formatDateTime } from '../utils/finance';

// Los paneles guardan el id, no la cuenta: así el panel se re-renderiza con los
// datos frescos cuando la lista se recarga (p. ej. tras una prueba completada,
// que actualiza last_tested_at).
type PanelState =
  | { kind: 'create' }
  | { kind: 'edit'; id: number }
  | { kind: 'test'; id: number }
  | null;

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  ath_movil: 'ATH Móvil',
  stripe: 'Stripe',
  paypal: 'PayPal',
};

const ENVIRONMENT_LABELS: Record<PaymentEnvironment, string> = {
  sandbox: 'Sandbox',
  production: 'Producción',
};

interface PaymentAccountsSectionProps {
  // Se llama tras crear/editar/eliminar una cuenta, para refrescar /me y que el
  // flag has_active_payment_account (que habilita el botón de pago) se actualice.
  onAccountsChanged?: () => void;
}

export default function PaymentAccountsSection({
  onAccountsChanged,
}: PaymentAccountsSectionProps) {
  const [accounts, setAccounts] = useState<PaymentAccountRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [panel, setPanel] = useState<PanelState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelApiError, setPanelApiError] = useState<ApiError | null>(null);

  const [toDelete, setToDelete] = useState<PaymentAccountRead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listPaymentAccounts();
      setAccounts(data);
    } catch (err) {
      setListError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las cuentas de cobro.',
      );
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarga silenciosa tras una prueba completada: sin estado de carga y sin
  // vaciar la lista si falla, porque el panel abierto sale de `accounts` y se
  // cerraría solo en medio de la pantalla de éxito.
  const refreshList = useCallback(async () => {
    try {
      setAccounts(await listPaymentAccounts());
    } catch {
      // El badge de verificación se pondrá al día al reabrir la sección.
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

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
  const openEdit = (account: PaymentAccountRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'edit', id: account.id });
  };

  // Cuenta viva del panel abierto; si desaparece de la lista (borrada), el
  // panel se cierra solo al no tener nada que renderizar.
  const panelAccount =
    panel && panel.kind !== 'create'
      ? (accounts.find((a) => a.id === panel.id) ?? null)
      : null;

  const handleCreate = async (payload: PaymentAccountCreate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await createPaymentAccount(payload);
      showToast('Cuenta de cobro creada');
      setPanel(null);
      fetchList();
      onAccountsChanged?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo crear la cuenta.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: number, payload: PaymentAccountUpdate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await updatePaymentAccount(id, payload);
      showToast('Cuenta de cobro actualizada');
      setPanel(null);
      fetchList();
      onAccountsChanged?.();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo actualizar la cuenta.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deletePaymentAccount(toDelete.id);
      showToast('Cuenta de cobro eliminada');
      setToDelete(null);
      fetchList();
      onAccountsChanged?.();
    } catch (err) {
      showToast(
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar la cuenta.',
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="config-section">
      <div className="config-section__header">
        <h3 className="form-section__title" style={{ marginBottom: 0 }}>
          Cuentas de cobro
        </h3>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={openCreate}
        >
          <PlusIcon size={14} />
          Nueva cuenta
        </button>
      </div>

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
            <SpinnerIcon size={16} /> Cargando cuentas…
          </div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">Sin cuentas de cobro</p>
            <p>Agrega una cuenta de ATH Móvil para cobrar en línea.</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Entorno</th>
                <th>Public token</th>
                <th>Verificación</th>
                <th>Predeterminada</th>
                <th>Estado</th>
                <th className="table-cell--nowrap" style={{ textAlign: 'right' }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.display_name ?? (
                      <span className="table-cell--muted">—</span>
                    )}
                  </td>
                  <td className="table-cell--nowrap">
                    {PROVIDER_LABELS[a.provider]}
                  </td>
                  <td className="table-cell--nowrap">
                    {ENVIRONMENT_LABELS[a.environment]}
                  </td>
                  <td className="table-cell--nowrap">
                    {a.public_token_masked ?? (
                      <span className="table-cell--muted">—</span>
                    )}
                  </td>
                  <td className="table-cell--nowrap">
                    {a.last_tested_at ? (
                      <>
                        <span className="badge badge--active">Verificada</span>
                        <div className="table-cell--muted">
                          {formatDateTime(a.last_tested_at)}
                        </div>
                      </>
                    ) : a.last_test_status === 'open' ||
                      a.last_test_status === 'confirm' ? (
                      <span className="badge badge--pending">En prueba</span>
                    ) : (
                      <span className="badge badge--inactive">
                        Sin verificar
                      </span>
                    )}
                  </td>
                  <td>
                    {a.is_default ? (
                      <span className="badge badge--active">Predeterminada</span>
                    ) : (
                      <span className="table-cell--muted">—</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        'badge ' +
                        (a.is_active ? 'badge--active' : 'badge--inactive')
                      }
                    >
                      {a.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="table-cell--nowrap" style={{ textAlign: 'right' }}>
                    <div className="row-actions">
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <SidePanel
        open={panel?.kind === 'create'}
        title="Nueva cuenta de cobro"
        onClose={closePanel}
      >
        {panel?.kind === 'create' && (
          <PaymentAccountForm
            mode="create"
            onSubmit={(payload) => handleCreate(payload as PaymentAccountCreate)}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
          />
        )}
      </SidePanel>

      <SidePanel
        open={!!panelAccount}
        title={
          panel?.kind === 'test'
            ? 'Probar cuenta de cobro'
            : 'Editar cuenta de cobro'
        }
        subtitle={
          panelAccount
            ? (panelAccount.display_name ??
              PROVIDER_LABELS[panelAccount.provider])
            : undefined
        }
        onClose={closePanel}
      >
        {panelAccount && panel?.kind === 'edit' && (
          <PaymentAccountForm
            mode="edit"
            account={panelAccount}
            onSubmit={(payload) =>
              handleEdit(panelAccount.id, payload as PaymentAccountUpdate)
            }
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
            onTest={() => setPanel({ kind: 'test', id: panelAccount.id })}
          />
        )}
        {panelAccount && panel?.kind === 'test' && (
          <PaymentAccountTestPanel
            account={panelAccount}
            onCompleted={refreshList}
            onBack={() => setPanel({ kind: 'edit', id: panelAccount.id })}
            onClose={() => setPanel(null)}
          />
        )}
      </SidePanel>

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar cuenta de cobro"
        message="¿Seguro que quieres eliminar esta cuenta? No podrás cobrar con ella hasta agregar otra."
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </section>
  );
}
