/**
 * Fecha corta a partir de un ISO **con hora** (p. ej. `updated_at`). No sirve
 * para las fechas planas `YYYY-MM-DD` de la API: esas van sin zona y hay que
 * anclarlas a medianoche local para no correrse un día (ver `formatDateShort`
 * en las páginas que las muestran).
 */
export function formatDateTimeShort(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
