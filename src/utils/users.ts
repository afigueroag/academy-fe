import type { UserListRead, UserRole } from '../types';

/**
 * Cómo se nombra en la UI el número correlativo (`role_consecutive`) según el
 * rol de quien lo lleva. El número es único **por academia**, no por rol, así
 * que en pantallas que mezclan personas (anuncios, buscador sin rol) o en el
 * híbrido `instructor_student` se cae al término neutro.
 *
 * El backend lo llama "expediente" en sus mensajes; es el mismo dato.
 */
export function userNumberLabel(role?: UserRole | null): string {
  if (role === 'student') return 'No. estudiante';
  if (role === 'instructor') return 'No. instructor';
  return 'No. de miembro';
}

/** El mismo término en minúscula, para incrustarlo dentro de una frase. */
export function userNumberTerm(role?: UserRole | null): string {
  return userNumberLabel(role).toLowerCase();
}

/**
 * Número de la persona con el año de ingreso como prefijo (p. ej. "2025-839").
 * Usa `entry_year` del backend y, si viene vacío, lo deriva de `start_date`.
 * Sin año disponible se muestra solo el consecutivo.
 *
 * Ojo: el `search` de GET /users busca por `role_consecutive` y `entry_year`
 * por separado y por coincidencia exacta, no por este número compuesto.
 */
export function userNumber(u: UserListRead): string | null {
  if (u.role_consecutive == null) return null;
  const year = entryYear(u);
  return year ? `${year}-${u.role_consecutive}` : String(u.role_consecutive);
}

/** Año que prefija el número: el del backend o, si falta, el de `start_date`. */
export function entryYear(u: UserListRead): number | null {
  return u.entry_year ?? yearOf(u.start_date);
}

function yearOf(value: string | null): number | null {
  if (!value) return null;
  const year = Number(value.slice(0, 4));
  return Number.isFinite(year) && year > 0 ? year : null;
}
