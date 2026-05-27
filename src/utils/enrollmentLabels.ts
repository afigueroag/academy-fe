import type { EnrollmentStatus } from '../types';

const STATUS: Record<EnrollmentStatus, string> = {
  active: 'Inscrito',
  waiting: 'En lista de espera',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export function labelEnrollmentStatus(v: EnrollmentStatus): string {
  return STATUS[v];
}
