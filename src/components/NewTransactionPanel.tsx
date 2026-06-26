import { useEffect, useState } from 'react';
import SidePanel from './SidePanel';
import TransactionForm from './TransactionForm';
import { ApiError, createTransaction } from '../api';
import type { TransactionCreate, TransactionKind } from '../types';
import { labelTransactionKind } from '../utils/salesLabels';

interface NewTransactionPanelProps {
  open: boolean;
  // Tipo preseleccionado al abrir (p. ej. desde "Nuevo gasto"). El usuario
  // puede cambiarlo con el toggle Venta/Gasto.
  defaultKind?: TransactionKind;
  onClose: () => void;
  // Se llama tras crear con éxito (el contenedor cierra, hace toast y refresca).
  onSuccess: (kind: TransactionKind) => void;
}

const KINDS: TransactionKind[] = ['sale', 'expense'];

export default function NewTransactionPanel({
  open,
  defaultKind,
  onClose,
  onSuccess,
}: NewTransactionPanelProps) {
  const [kind, setKind] = useState<TransactionKind>(defaultKind ?? 'sale');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  // Al (re)abrir el panel, restablecer el tipo y limpiar errores previos.
  useEffect(() => {
    if (open) {
      setKind(defaultKind ?? 'sale');
      setError(null);
      setApiError(null);
    }
  }, [open, defaultKind]);

  const handleCreate = async (payload: TransactionCreate) => {
    setSubmitting(true);
    setError(null);
    setApiError(null);
    try {
      await createTransaction(payload);
      onSuccess(kind);
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err);
        setError(err.message);
      } else {
        setError('No se pudo crear la transacción.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <SidePanel open={open} title="Nueva transacción" onClose={handleClose}>
      {open && (
        <>
          <div className="field">
            <label className="field__label">Tipo</label>
            <div className="tab-group" role="tablist" aria-label="Tipo de transacción">
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  className={
                    'tab-group__item' +
                    (kind === k ? ' tab-group__item--active' : '')
                  }
                  onClick={() => setKind(k)}
                  disabled={submitting}
                >
                  {labelTransactionKind(k)}
                </button>
              ))}
            </div>
          </div>

          {/* key={kind}: remonta el formulario al cambiar de tipo para reiniciar
              estado y filtrar categorías por el nuevo kind. */}
          <TransactionForm
            key={kind}
            mode="create"
            kind={kind}
            onSubmit={handleCreate}
            onCancel={handleClose}
            submitting={submitting}
            serverError={error}
            apiError={apiError}
          />
        </>
      )}
    </SidePanel>
  );
}
