import type { UserStatus } from '../types';

const LABEL: Record<UserStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  inactive: 'Inactivo',
};

export default function StatusBadge({ status }: { status: UserStatus }) {
  return <span className={`badge badge--${status}`}>{LABEL[status]}</span>;
}
