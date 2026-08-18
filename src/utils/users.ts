import type { UserListRead } from '../types';

/**
 * Número de la persona con el año de ingreso como prefijo (p. ej. "2025-839").
 * Usa `entry_year` del backend y, si viene vacío, lo deriva de `start_date`.
 * Sin año disponible se muestra solo el consecutivo.
 *
 * Ojo: el `search` de GET /users busca por `role_consecutive` y `entry_year`
 * por separado, no por este número compuesto.
 */
export function userNumber(u: UserListRead): string | null {
  if (u.role_consecutive == null) return null;
  const year = u.entry_year ?? yearOf(u.start_date);
  return year ? `${year}-${u.role_consecutive}` : String(u.role_consecutive);
}

function yearOf(value: string | null): number | null {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}
