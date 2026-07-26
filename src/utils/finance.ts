// Helpers de formato para el módulo Finanzas. El backend agrega los valores; el
// frontend solo los pinta.
//
// TODO: confirmar escala con respuesta real del backend. De momento asumimos:
//   - `delta_pct` (variación de KPIs) YA viene como porcentaje (12.5 => 12.5%).
//   - `margin` (P&L) viene como fracción 0–1 (0.25 => 25%).
// Si el backend usa otra escala, ajustar SOLO estas dos funciones.

export function formatPct(
  value: number | null | undefined,
  fromFraction = false,
): string {
  if (value === null || value === undefined) return '—';
  const pct = fromFraction ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

// Variación de KPI con signo explícito (para el chip ↑/↓ "vs. mes anterior").
export function formatDeltaPct(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

const MONTHS_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const MONTHS_ABBR = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

// Nombre completo del mes (1-12). Para el selector de periodo: "Junio".
export function monthName(month: number): string {
  return MONTHS_FULL[month - 1] ?? String(month);
}

// Etiqueta corta de un mes que viene del backend ("2026-06" → "Jun").
export function formatMonthLabel(value: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(value);
  if (m) {
    const idx = parseInt(m[2], 10) - 1;
    if (idx >= 0 && idx < 12) return MONTHS_ABBR[idx];
  }
  return value;
}

// Fecha y hora en español ("25 jun 2026, 02:30 p.m."). Para sellos que devuelve
// el backend como datetime, p. ej. last_tested_at de una cuenta de cobro.
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Fecha corta día/mes en español ("2026-06-25" → "25 jun").
export function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
