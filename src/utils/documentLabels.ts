import type { DocumentCategory, DocumentVisibility } from '../types';

const CATEGORY: Record<DocumentCategory, string> = {
  contract: 'Contrato',
  certificate: 'Certificado',
  id_document: 'Identificación',
  medical: 'Médico',
  other: 'Otro',
};

const VISIBILITY: Record<DocumentVisibility, string> = {
  private: 'Privado',
  academy: 'Toda la academia',
};

// Texto de ayuda mostrado junto al selector de visibilidad.
const VISIBILITY_HINT: Record<DocumentVisibility, string> = {
  private: 'Lo ven el propio usuario y la administración.',
  academy: 'Lo ve toda la academia.',
};

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'contract',
  'certificate',
  'id_document',
  'medical',
  'other',
];

export const DOCUMENT_VISIBILITIES: DocumentVisibility[] = [
  'private',
  'academy',
];

export function labelDocumentCategory(v: DocumentCategory): string {
  return CATEGORY[v];
}

export function labelDocumentVisibility(v: DocumentVisibility): string {
  return VISIBILITY[v];
}

export function hintDocumentVisibility(v: DocumentVisibility): string {
  return VISIBILITY_HINT[v];
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
