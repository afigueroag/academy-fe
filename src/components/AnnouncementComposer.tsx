import { useCallback, useEffect, useState } from 'react';
import type {
  AnnouncementCreate,
  AnnouncementRead,
  AnnouncementTemplate,
  UserRole,
} from '../types';
import {
  ApiError,
  createAnnouncement,
  getAnnouncement,
  sendAnnouncement,
  updateAnnouncement,
} from '../api';
import AnnouncementForm from './AnnouncementForm';
import AnnouncementDetail from './AnnouncementDetail';
import RecipientsPanel from './RecipientsPanel';
import ConfirmModal from './ConfirmModal';

interface AnnouncementComposerProps {
  existing?: AnnouncementRead; // edición de un borrador existente
  initial?: AnnouncementCreate | null; // pre-llenado para uno nuevo (ej. suggest)
  template?: AnnouncementTemplate; // fuerza plantilla (flujos de deuda)
  lockedUser?: { id: number; name: string } | null;
  role: UserRole | undefined;
  onClose: () => void;
  onChanged?: () => void; // refrescar listas del contenedor
}

// Compositor autocontenido: redactar/editar borrador, guardar, enviar (con confirm),
// y seguir el progreso del envío (polling) + destinatarios. Reutilizable desde el
// módulo de Comunicados y desde la ficha del alumno (recordatorio de deuda).
export default function AnnouncementComposer({
  existing,
  initial,
  template,
  lockedUser,
  role,
  onClose,
  onChanged,
}: AnnouncementComposerProps) {
  const effectiveTemplate: AnnouncementTemplate =
    existing?.template ?? initial?.template ?? template ?? 'plain';
  // Enviar: admin siempre; recepcionista solo recordatorios de deuda.
  const canSend =
    role === 'admin' ||
    (role === 'receptionist' && effectiveTemplate === 'debt_reminder');

  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelApiError, setPanelApiError] = useState<ApiError | null>(null);

  const [sendReq, setSendReq] = useState<{
    payload: AnnouncementCreate;
    total: number;
  } | null>(null);
  const [sending, setSending] = useState(false);

  // Envío en curso / terminado (fase de progreso).
  const [sent, setSent] = useState<AnnouncementRead | null>(null);
  const [showRecipients, setShowRecipients] = useState(false);

  const persist = useCallback(
    async (payload: AnnouncementCreate): Promise<AnnouncementRead> => {
      if (existing) return updateAnnouncement(existing.id, payload);
      return createAnnouncement(payload);
    },
    [existing],
  );

  const handleSaveDraft = async (payload: AnnouncementCreate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      await persist(payload);
      onChanged?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo guardar el borrador.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestSend = (payload: AnnouncementCreate, total: number) => {
    setSendReq({ payload, total });
  };

  const confirmSend = async () => {
    if (!sendReq) return;
    setSending(true);
    try {
      const saved = await persist(sendReq.payload);
      const result = await sendAnnouncement(saved.id);
      setSendReq(null);
      setSent(result);
      onChanged?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo enviar el comunicado.';
      setPanelError(message);
      setSendReq(null);
    } finally {
      setSending(false);
    }
  };

  // Polling mientras el envío esté "sending".
  const sentId = sent?.id ?? null;
  const sentStatus = sent?.status ?? null;
  useEffect(() => {
    if (sentId == null || sentStatus !== 'sending') return;
    const interval = window.setInterval(async () => {
      try {
        const fresh = await getAnnouncement(sentId);
        setSent(fresh);
        if (fresh.status !== 'sending') onChanged?.();
      } catch {
        /* reintenta en el próximo tick */
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [sentId, sentStatus, onChanged]);

  // ---- Fase de progreso / resultado ----
  if (sent) {
    if (showRecipients) {
      return (
        <div>
          <RecipientsPanel announcementId={sent.id} isAdmin={canSend} />
          <div className="announcement-form__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setShowRecipients(false)}
            >
              Volver
            </button>
          </div>
        </div>
      );
    }
    return (
      <div>
        {sent.status === 'sent' && (
          <div className="alert alert--success" role="status" style={{ marginBottom: 12 }}>
            Enviado a {sent.sent_count}{' '}
            {sent.sent_count === 1 ? 'persona' : 'personas'}.
          </div>
        )}
        {sent.status === 'failed' && (
          <div className="alert" role="alert" style={{ marginBottom: 12 }}>
            Envío con errores: {sent.failed_count} de {sent.total_recipients}{' '}
            fallaron.
          </div>
        )}
        <AnnouncementDetail
          announcement={sent}
          onViewRecipients={() => setShowRecipients(true)}
        />
        <div className="announcement-form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  // ---- Fase de composición ----
  return (
    <>
      <AnnouncementForm
        announcement={existing}
        initial={initial}
        template={template}
        lockedUser={lockedUser}
        canSend={canSend}
        submitting={submitting}
        serverError={panelError}
        apiError={panelApiError}
        onSaveDraft={handleSaveDraft}
        onRequestSend={handleRequestSend}
      />

      <ConfirmModal
        open={!!sendReq}
        title="Enviar comunicado"
        message={
          sendReq
            ? `Se enviará a ${sendReq.total} ${
                sendReq.total === 1 ? 'persona' : 'personas'
              } y no se puede deshacer.`
            : ''
        }
        confirmLabel="Enviar"
        danger
        loading={sending}
        onConfirm={confirmSend}
        onCancel={() => !sending && setSendReq(null)}
      />
    </>
  );
}
