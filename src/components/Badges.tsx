import type {
  AnnouncementStatus,
  CourseStatus,
  DeliveryStatus,
  TransactionStatus,
  UserStatus,
} from '../types';
import {
  labelAnnouncementStatus,
  labelDeliveryStatus,
} from '../utils/announcements';

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

const TRANSACTION_LABEL: Record<TransactionStatus, string> = {
  scheduled: 'Programada',
  pending: 'Pendiente',
  paid: 'Pagada',
  cancelled: 'Cancelada',
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return (
    <span className={`badge badge--tx-${status}`}>
      {TRANSACTION_LABEL[status]}
    </span>
  );
}

export function AnnouncementStatusBadge({
  status,
}: {
  status: AnnouncementStatus;
}) {
  return (
    <span className={`badge badge--ann-${status}`}>
      {labelAnnouncementStatus(status)}
    </span>
  );
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`badge badge--delivery-${status}`}>
      {labelDeliveryStatus(status)}
    </span>
  );
}
