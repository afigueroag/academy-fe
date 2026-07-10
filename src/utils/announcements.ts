import type {
  AnnouncementCategory,
  AnnouncementStatus,
  DeliveryStatus,
} from '../types';

const CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  debt_reminder: 'Recordatorio de deuda',
  discount: 'Descuento',
  event: 'Evento',
  holiday: 'Asueto',
  general: 'General',
};

export function labelAnnouncementCategory(c: AnnouncementCategory): string {
  return CATEGORY_LABEL[c];
}

export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  'general',
  'debt_reminder',
  'discount',
  'event',
  'holiday',
];

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programado',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Fallido',
};

export function labelAnnouncementStatus(s: AnnouncementStatus): string {
  return STATUS_LABEL[s];
}

export const ANNOUNCEMENT_STATUSES: AnnouncementStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'failed',
];

const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  delivered: 'Entregado',
  failed: 'Fallido',
  read: 'Leído',
};

export function labelDeliveryStatus(s: DeliveryStatus): string {
  return DELIVERY_LABEL[s];
}

export const DELIVERY_STATUSES: DeliveryStatus[] = [
  'pending',
  'sent',
  'delivered',
  'failed',
  'read',
];

// Título mostrado en listas: asunto, o las primeras palabras del cuerpo.
export function announcementTitle(subject: string | null, body: string): string {
  if (subject && subject.trim()) return subject.trim();
  const text = body.trim().replace(/\s+/g, ' ');
  if (!text) return 'Sin asunto';
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
