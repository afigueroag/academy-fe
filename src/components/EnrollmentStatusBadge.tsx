import type { EnrollmentStatus } from '../types';

const LABEL: Record<EnrollmentStatus, string> = {
  active: 'Inscrito',
  waiting: 'En espera',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const CLASS: Record<EnrollmentStatus, string> = {
  active: 'badge--enrolled',
  waiting: 'badge--waiting',
  completed: 'badge--completed',
  cancelled: 'badge--cancelled',
};

export default function EnrollmentStatusBadge({
  status,
}: {
  status: EnrollmentStatus | null;
}) {
  const s: EnrollmentStatus = status ?? 'active';
  return <span className={`badge ${CLASS[s]}`}>{LABEL[s]}</span>;
}
