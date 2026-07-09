import type { UserRole } from '../types';

// Roles de autoservicio: usan el shell de app con sidebar reducido (Inicio /
// Clases / Configuración) en lugar del panel administrativo.
export function isSelfServiceRole(role: UserRole | null | undefined): boolean {
  return (
    role === 'student' || role === 'instructor' || role === 'instructor_student'
  );
}

// ¿El rol ve las funciones de instructor (pasar lista, clases asignadas, pagos)?
export function hasInstructorView(role: UserRole | null | undefined): boolean {
  return role === 'instructor' || role === 'instructor_student';
}

// ¿El rol ve las funciones de estudiante (inscribirse, deuda, asistencia propia)?
export function hasStudentView(role: UserRole | null | undefined): boolean {
  return role === 'student' || role === 'instructor_student';
}

const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  receptionist: 'Recepción',
  instructor: 'Instructor',
  instructor_student: 'Instructor-estudiante',
  student: 'Estudiante',
};

export function labelUserRole(role: UserRole): string {
  return USER_ROLE_LABEL[role];
}
