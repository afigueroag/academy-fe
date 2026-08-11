import { ApiError } from '../api';
import type { UserConflict, UserConflictCode } from '../types';

/**
 * Los endpoints de alta, edición e invitación devuelven el conflicto como
 * `detail: { code, message, user? }`, que `parseError` deja en `err.code` y
 * `err.conflictUser`. Estos helpers son la única forma de leerlos: nunca
 * ramificar mirando el texto del mensaje.
 *
 * Códigos y dónde aparecen:
 *
 * - `email_taken` — POST /users, /users/invite, /users/{id}/invite y también
 *   PATCH /users/{id}. Es del **campo** correo: el correo es único en todo el
 *   sistema (no por academia), así que hay que corregirlo sin cerrar el panel...
 *   salvo que venga `user`, y entonces hay salida (ver `conflictUser`).
 * - `already_registered` — esa persona ya entra a la plataforma: la pantalla
 *   estaba desactualizada y toca recargar la lista.
 * - `user_deleted` — la ficha está archivada. Invitar antes de reactivar crearía
 *   una cuenta muerta (el backend bloquea el login de los archivados), así que
 *   el orden obligatorio es reactivar → editar → invitar.
 * - `email_required` — llega con **422**, no con 409.
 */
export function conflictCode(err: unknown): UserConflictCode | null {
  return err instanceof ApiError && err.code
    ? (err.code as UserConflictCode)
    : null;
}

/**
 * Usuario en conflicto, o `null`. Solo llega cuando es de la misma academia: si
 * el correo lo tiene otra academia el backend omite la clave para no filtrar
 * nada. Por eso `null` significa "no hay nada que ofrecer, error de campo y ya".
 */
export function conflictUser(err: unknown): UserConflict | null {
  return err instanceof ApiError ? err.conflictUser : null;
}

/**
 * ¿Este conflicto se puede resolver reactivando la ficha? Solo si el backend
 * identificó a la persona (misma academia) y está archivada.
 */
export function restorableUser(err: unknown): UserConflict | null {
  const user = conflictUser(err);
  return user && !user.is_active ? user : null;
}

/**
 * Mensaje del correo repetido, listo para pintar en el campo, o `null` si el
 * error es otro. Se usa cuando no hay nada mejor que ofrecer que corregirlo.
 *
 * Mantiene el reconocimiento por texto como respaldo: si el backend responde un
 * 409 sin `code` (despliegue viejo), seguimos marcando el campo en vez de
 * mostrar un "Error 409" pelado.
 */
export function emailTakenMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  if (err.code) return err.code === 'email_taken' ? err.message : null;
  return /correo/i.test(err.message) ? err.message : null;
}
