import { useState } from 'react';
import { CheckIcon, CopyIcon, MailIcon } from '../brand';

interface InviteResultProps {
  firstName: string;
  lastName: string;
  email: string;
  link: string;
  onDone: () => void;
}

export default function InviteResult({
  firstName,
  lastName,
  email,
  link,
  onDone,
}: InviteResultProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById('invite-link') as HTMLInputElement | null;
      if (el) {
        el.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* ignore */
        }
      }
    }
  };

  const mailto = (() => {
    const subject = encodeURIComponent(`Invitación a tu academia`);
    const body = encodeURIComponent(
      `Hola ${firstName},\n\n` +
        `Te invitamos a unirte. Activa tu cuenta y define tu contraseña con este enlace:\n\n` +
        `${link}\n\n` +
        `Si tienes problemas, responde a este correo.`,
    );
    return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
  })();

  return (
    <div>
      <div
        className="alert alert--success"
        role="status"
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <CheckIcon size={16} />
        <span>
          Invitación generada para <strong>{firstName} {lastName}</strong>.
        </span>
      </div>

      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 14,
          margin: '0 0 16px',
        }}
      >
        Copia el enlace y compártelo con la persona invitada por el medio que
        prefieras. Es de un solo uso y expira tras ser canjeado.
      </p>

      <div className="field">
        <label className="field__label" htmlFor="invite-link">
          Enlace de invitación
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="invite-link"
            className="input"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13 }}
          />
          <button
            type="button"
            className={copied ? 'btn btn--ghost' : 'btn btn--primary'}
            onClick={copy}
            aria-live="polite"
            style={{ flexShrink: 0 }}
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <a href={mailto} className="btn btn--ghost btn--block" style={{ marginTop: 8 }}>
        <MailIcon size={14} />
        Abrir borrador de correo
      </a>

      <div className="form-actions form-actions--end" style={{ marginTop: 20 }}>
        <button type="button" className="btn btn--primary" onClick={onDone}>
          Listo
        </button>
      </div>
    </div>
  );
}
