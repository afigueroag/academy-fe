import type { CourseStatus, UserStatus } from '../types';

const USER_LABEL: Record<UserStatus, string> = {
  pending: 'Pendiente',
  active: 'Activo',
  inactive: 'Inactivo',
};

export function StatusBadge({ status }: { status: UserStatus }) {
  return <span className={`badge badge--${status}`}>{USER_LABEL[status]}</span>;
}

const COURSE_LABEL: Record<CourseStatus, string> = {
  active: 'Activa',
  draft: 'Borrador',
  archived: 'Archivada',
};

export function CourseStatusBadge({ status }: { status: CourseStatus | null }) {
  const s: CourseStatus = status ?? 'active';
  return (
    <span className={`badge badge--course-${s}`}>{COURSE_LABEL[s]}</span>
  );
}
