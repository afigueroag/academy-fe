// Helpers de formato para el módulo Finanzas. El backend agrega los valores; el
// frontend solo los pinta.
//
// ESCALA DE PORCENTAJES (confirmada con backend, ago 2026): todo campo tipado
// `number` que devuelve la API es una FRACCIÓN 0–1 — `pct_last_12`,
// `attendance_pct`, `delta_pct`, los `pct` de los breakdowns, `used_pct`,
// `margin` y `profit_margin.value`. Se multiplica por 100 solo al pintar, y ese
// ×100 vive aquí: no lo repliques en las páginas.
//
// Única excepción: los descuentos (`discount_percentage` de una transacción y
// `Discount.percentage`) son ENTEROS 0–100, porque los teclea el usuario y hay
// datos guardados con esa escala. No pasan por estos helpers.

export function formatPct(
  value: number | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

// Variación de KPI con signo explícito (para el chip ↑/↓ "vs. mes anterior").
// No está acotada: -0.25 => "-25.0%", 5 => "+500.0%". `null` significa "sin
// comparación" (el período anterior fue 0), no 0 %.
export function formatDeltaPct(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${(delta * 100).toFixed(1)}%`;
}

// Ancho de barra en % a partir de una fracción, topado a [0, 100]. El valor
// real puede pasar de 1 (presupuesto excedido): la barra se llena y el número
// que va al lado sigue mostrando el exceso.
export function pctBarWidth(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.min(100, Math.max(0, value * 100));
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
