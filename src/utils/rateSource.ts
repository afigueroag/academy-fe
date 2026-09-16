import type { AttendanceRole, CoursePmtRead } from '../types';

// Textos de la tarifa por hora ausente (`rate_source === 'undefined'`). El
// backend manda `hourly_rate` y `payment` en null: no es que se pague cero, es
// que falta el dato, así que nunca se formatea como dinero.
export const MISSING_RATE_LABEL = 'Sin definir';

export const MISSING_RATE_TOTAL_NOTE =
  'Hay cursos sin tarifa por hora, por lo que el total no se puede calcular.';

// La tarifa por defecto de la academia es por rol: hay una de instructor y otra
// de asistente, y la que falta es la del rol con el que se asistió a la clase.
const DEFAULT_RATE_ROLE: Record<AttendanceRole, string> = {
  instructor: 'de instructor',
  assistant: 'de asistente',
  student: 'del rol',
};

// Roles distintos entre las filas sin tarifa, en orden estable. La nota es una
// sola al pie de la tabla, así que puede cubrir los dos roles a la vez.
function missingRoles(byCourse: CoursePmtRead[]): AttendanceRole[] {
  const order: AttendanceRole[] = ['instructor', 'assistant', 'student'];
  const found = new Set(
    byCourse.filter((c) => c.rate_source === 'undefined').map(
      (c) => c.attendance_role,
    ),
  );
  return order.filter((r) => found.has(r));
}

function rolesPhrase(roles: AttendanceRole[]): string {
  return roles.map((r) => DEFAULT_RATE_ROLE[r]).join(' y ');
}

// Para el admin (ficha del instructor): las dos formas de resolverlo, con la
// ruta real de cada una. Devuelve null si no falta ninguna tarifa.
export function missingRateAdminNote(byCourse: CoursePmtRead[]): string | null {
  const roles = missingRoles(byCourse);
  if (roles.length === 0) return null;
  const many = roles.length > 1;
  return (
    'No se especificó una tarifa por hora para este instructor en los cursos ' +
    `marcados como "${MISSING_RATE_LABEL}", ni ` +
    `${many ? 'existen las tarifas' : 'existe la tarifa'} por defecto ` +
    `${rolesPhrase(roles)} de la academia, por lo que no se puede calcular el ` +
    'pago. Puedes resolverlo de dos maneras: asignando una tarifa al ' +
    'instructor en la ficha del curso (sección Instructores), o definiendo ' +
    `${many ? 'esas tarifas' : 'esa tarifa'} por defecto en Configuración → ` +
    'Tarifas por hora.'
  );
}

// Para el propio instructor: no tiene acceso a Configuración de la academia,
// así que no se le manda a una ruta que no puede abrir.
export function missingRateSelfNote(byCourse: CoursePmtRead[]): string | null {
  const roles = missingRoles(byCourse);
  if (roles.length === 0) return null;
  const many = roles.length > 1;
  return (
    `No hay una tarifa por hora definida para ti en los cursos marcados como ` +
    `"${MISSING_RATE_LABEL}", ni ` +
    `${many ? 'existen las tarifas' : 'existe la tarifa'} por defecto ` +
    `${rolesPhrase(roles)} de la academia, por lo que no se puede calcular el ` +
    'pago. Pídele a la administración de la academia que ' +
    `${many ? 'las defina' : 'la defina'}.`
  );
}

export function hasMissingRate(byCourse: CoursePmtRead[]): boolean {
  return byCourse.some((c) => c.rate_source === 'undefined');
}
