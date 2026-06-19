import type { GroupPublic } from '../types';

// Replica en el front la regla de elegibilidad por grupos que calcula el backend.
// Se usa SOLO para la advertencia no bloqueante del admin (la vista del alumno
// confía en `can_enroll`).
//
// Un estudiante cumple una clase si cumple TODAS las categorías en las que la
// clase tiene al menos un grupo (AND entre categorías):
//   - Si el estudiante no tiene ningún grupo en esa categoría → no cumple.
//   - Categoría NO ordinal → intersección no vacía (coincide al menos un grupo).
//   - Categoría ordinal → rank_máx(estudiante) >= rank_mín(clase).
//
// Casos borde:
//   - Clase sin grupos → abierta para todos (true).
//   - Estudiante sin grupos → solo cumple clases sin grupos.
export function studentMeetsGroups(
  studentGroups: GroupPublic[],
  courseGroups: GroupPublic[],
): boolean {
  if (courseGroups.length === 0) return true;

  // Agrupa los grupos de la clase por categoría.
  const byCategory = new Map<
    number,
    { isOrdinal: boolean; groups: GroupPublic[] }
  >();
  for (const g of courseGroups) {
    const entry = byCategory.get(g.category_id) ?? {
      isOrdinal: g.category.is_ordinal,
      groups: [],
    };
    entry.groups.push(g);
    byCategory.set(g.category_id, entry);
  }

  for (const [categoryId, { isOrdinal, groups }] of byCategory) {
    const studentInCategory = studentGroups.filter(
      (g) => g.category_id === categoryId,
    );
    if (studentInCategory.length === 0) return false;

    if (!isOrdinal) {
      const courseIds = new Set(groups.map((g) => g.id));
      const intersects = studentInCategory.some((g) => courseIds.has(g.id));
      if (!intersects) return false;
    } else {
      const studentMax = Math.max(
        ...studentInCategory.map((g) => g.rank ?? Number.NEGATIVE_INFINITY),
      );
      const courseMin = Math.min(
        ...groups.map((g) => g.rank ?? Number.POSITIVE_INFINITY),
      );
      if (studentMax < courseMin) return false;
    }
  }

  return true;
}

// Texto corto de los grupos requeridos por una clase, para mostrar el motivo del
// bloqueo (p. ej. "Cinta Azul, Adultos").
export function requiredGroupsLabel(courseGroups: GroupPublic[]): string {
  return courseGroups.map((g) => g.name).join(', ');
}
