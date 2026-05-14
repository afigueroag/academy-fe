import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from '../brand';

interface SidePanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export default function SidePanel({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: SidePanelProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="panel-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="side-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="side-panel__header">
          <div>
            <div className="side-panel__title">{title}</div>
            {subtitle && <div className="side-panel__subtitle">{subtitle}</div>}
          </div>
          <button
            type="button"
            className="side-panel__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <CloseIcon size={18} />
          </button>
        </header>
        <div className="side-panel__body">{children}</div>
        {footer && <footer className="side-panel__footer">{footer}</footer>}
      </aside>
    </>
  );
}
