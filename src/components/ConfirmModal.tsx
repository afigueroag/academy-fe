import { useEffect, type ReactNode } from 'react';
import { SpinnerIcon } from '../brand';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  // Con un string se pinta el párrafo estándar. Con un nodo se pinta tal cual,
  // para casos que necesitan más de una línea (p. ej. explicar dos salidas).
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  // Salida alternativa opcional, para cuando el modal ofrece dos caminos en vez
  // de confirmar uno. Se pinta como la acción primaria y deja `onConfirm` como
  // la destructiva (p. ej. "Marcar como inactivo" junto a "Eliminar ficha").
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  secondaryLabel,
  onSecondary,
  secondaryLoading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Cualquiera de las dos acciones en vuelo bloquea el modal entero.
  const busy = loading || secondaryLoading;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, busy]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className={'modal' + (secondaryLabel ? ' modal--wide' : '')}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="modal__title">{title}</h3>
        {typeof message === 'string' ? (
          <p className="modal__body">{message}</p>
        ) : (
          message
        )}
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onSecondary}
              disabled={busy}
            >
              {secondaryLoading && <SpinnerIcon />}
              {secondaryLabel}
            </button>
          )}
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {loading && <SpinnerIcon />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
