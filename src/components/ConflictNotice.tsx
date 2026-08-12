import { SpinnerIcon, WarningIcon } from '../brand';
import type { UserConflict, UserConflictCode, UserRole } from '../types';
import { labelUserRole } from '../utils/roles';
import { formatDateTimeShort } from '../utils/dates';

interface ConflictNoticeProps {
  code: UserConflictCode | null;
  // Persona que ya tiene ese correo. El backend solo la manda cuando es de la
  // misma academia, así que si llega aquí siempre hay algo que ofrecer.
  user: UserConflict;
  // Rol del módulo desde el que se está dando de alta. Si no coincide con el de
  // la ficha en conflicto no se ofrece reactivar: hay que ir al módulo correcto.
  moduleRole: UserRole;
  busy: boolean;
  // Fallo al intentar resolver. Se pinta dentro del aviso para no tapar el botón.
  error: string | null;
  onRestore: () => void;
  onView: () => void;
}

// Módulo donde vive cada rol, para poder decir dónde está la ficha cuando el
// conflicto es con alguien de otro rol.
const MODULE_OF_ROLE: Partial<Record<UserRole, string>> = {
  student: 'Estudiantes',
  instructor: 'Instructores',
  instructor_student: 'Instructores',
};

/**
 * Salida para el choque de correo al dar de alta o invitar. Sin esto el panel
 * solo puede pintar el campo en rojo, y si el correo es de una ficha archivada
 * —invisible en todas las listas— no hay forma de avanzar.
 */
export default function ConflictNotice({
  code,
  user,
  moduleRole,
  busy,
  error,
  onRestore,
  onView,
}: ConflictNoticeProps) {
  const name = `${user.first_name} ${user.last_name}`;
  // `role` puede venir null: ahí se asume el del módulo, que es lo más probable.
  const otherRole = user.role && user.role !== moduleRole ? user.role : null;
  const updated = formatDateTimeShort(user.updated_at);

  const headline = !user.is_active
    ? code === 'user_deleted'
      ? `No se puede invitar a ${name}: su ficha está eliminada.`
      : `${name} ya existe, pero su ficha está eliminada.`
    : `Ese correo ya es de ${name}.`;

  return (
    <div className="alert alert--warning" role="status">
      <div className="alert__head">
        <WarningIcon size={14} />
        {headline}
      </div>

      {otherRole ? (
        <p className="conflict-notice__text">
          Está registrada como {labelUserRole(otherRole).toLowerCase()}
          {MODULE_OF_ROLE[otherRole]
            ? `, así que se gestiona desde ${MODULE_OF_ROLE[otherRole]}.`
            : '.'}{' '}
          Ábrela desde ahí en vez de crear una ficha nueva.
        </p>
      ) : !user.is_active ? (
        <p className="conflict-notice__text">
          {updated ? `Última actualización: ${updated}. ` : ''}
          Al reactivarla vuelve como inactiva, sin sus cobros recurrentes y sin
          acceso a la plataforma; conserva su historial y su número. Después
          podrás revisar sus datos antes de guardar.
        </p>
      ) : (
        <p className="conflict-notice__text">
          El correo es único en todo el sistema, así que no se puede reutilizar.
          Abre su ficha para revisarla, o usa otro correo.
        </p>
      )}

      {error && <p className="conflict-notice__error">{error}</p>}

      {!otherRole && (
        <div className="conflict-notice__actions">
          {!user.is_active ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={onRestore}
              disabled={busy}
            >
              {busy && <SpinnerIcon />}
              Reactivar ficha
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onView}
              disabled={busy}
            >
              {busy && <SpinnerIcon />}
              Ver su ficha
            </button>
          )}
        </div>
      )}
    </div>
  );
}
