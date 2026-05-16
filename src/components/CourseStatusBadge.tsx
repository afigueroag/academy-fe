import type { CourseStatus } from '../types';

const LABEL: Record<CourseStatus, string> = {
  active: 'Activa',
  draft: 'Borrador',
  archived: 'Archivada',
};

export default function CourseStatusBadge({
  status,
}: {
  status: CourseStatus | null;
}) {
  const s: CourseStatus = status ?? 'active';
  return <span className={`badge badge--course-${s}`}>{LABEL[s]}</span>;
}
