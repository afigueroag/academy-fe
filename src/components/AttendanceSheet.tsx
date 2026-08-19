import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AttendanceRead,
  AttendanceRole,
  AttendanceStatus,
  CourseRead,
} from '../types';
import {
  ApiError,
  createAttendance,
  deleteAttendance,
  openAttendanceSession,
  updateAttendance,
} from '../api';
import { PlusIcon, SpinnerIcon, TrashIcon } from '../brand';
import SidePanel from './SidePanel';
import ConfirmModal from './ConfirmModal';
import UserAutocomplete from './UserAutocomplete';
import {
  labelAttendanceRole,
  labelAttendanceStatus,
} from '../utils/attendanceLabels';
import { formatSessionDay, formatSessionTime } from '../utils/sessions';

const STATUS_OPTIONS: { value: AttendanceStatus; short: string }[] = [
  { value: 'present', short: 'P' },
  { value: 'absent', short: 'A' },
  { value: 'excused', short: 'J' },
];

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function rowKey(r: AttendanceRead): string {
  return `${r.user_id}|${r.attendance_role}`;
}

const inflightSessions = new Map<string, Promise<AttendanceRead[]>>();

function openSessionDeduped(
  course_id: number,
  scheduled_datetime: string,
): Promise<AttendanceRead[]> {
  const key = `${course_id}|${scheduled_datetime}`;
  const existing = inflightSessions.get(key);
  if (existing) return existing;
  const promise = openAttendanceSession({ course_id, scheduled_datetime })
    .finally(() => {
      inflightSessions.delete(key);
    });
  inflightSessions.set(key, promise);
  return promise;
}

interface AttendanceSheetProps {
  open: boolean;
  course: CourseRead;
  scheduledDatetime: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function AttendanceSheet({
  open,
  course,
  scheduledDatetime,
  onClose,
  onSaved,
}: AttendanceSheetProps) {
  const [rows, setRows] = useState<AttendanceRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<AttendanceRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffRole, setStaffRole] = useState<AttendanceRole>('instructor');
  const [staffSubmitting, setStaffSubmitting] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  const courseInstructorIds = useMemo(
    () => new Set(course.instructor_links.map((l) => l.instructor_id)),
    [course.instructor_links],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await openSessionDeduped(course.id, scheduledDatetime);
      setRows(data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'No se pudo abrir la sesión.';
      setLoadError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [course.id, scheduledDatetime]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  useEffect(() => {
    if (open) return;
    setStaffOpen(false);
    setStaffError(null);
    setRowError(null);
    setDeleteError(null);
  }, [open]);

  const staff = useMemo(
    () =>
      rows
        .filter((r) => r.attendance_role !== 'student')
        .sort((a, b) => {
          if (a.attendance_role !== b.attendance_role) {
            return a.attendance_role === 'instructor' ? -1 : 1;
          }
          return `${a.user.first_name} ${a.user.last_name}`.localeCompare(
            `${b.user.first_name} ${b.user.last_name}`,
          );
        }),
    [rows],
  );

  const students = useMemo(
    () =>
      rows
        .filter((r) => r.attendance_role === 'student')
        .sort((a, b) =>
          `${a.user.first_name} ${a.user.last_name}`.localeCompare(
            `${b.user.first_name} ${b.user.last_name}`,
          ),
        ),
    [rows],
  );

  const excludeForAdd = useMemo(
    () =>
      rows
        .filter((r) => r.attendance_role !== 'student')
        .map((r) => r.user_id),
    [rows],
  );

  const handleStatusChange = async (
    row: AttendanceRead,
    status: AttendanceStatus,
  ) => {
    if (row.status === status) return;
    const key = rowKey(row);
    const prev = rows;
    setSavingKey(key);
    setRowError(null);
    setRows((list) =>
      list.map((r) => (rowKey(r) === key ? { ...r, status } : r)),
    );
    try {
      const updated = await updateAttendance(
        row.course_id,
        row.user_id,
        row.scheduled_datetime,
        { status, attendance_role: row.attendance_role },
      );
      setRows((list) => list.map((r) => (rowKey(r) === key ? updated : r)));
      onSaved?.();
    } catch (err) {
      setRows(prev);
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo guardar el cambio.';
      setRowError(message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAttendance(
        toDelete.course_id,
        toDelete.user_id,
        toDelete.scheduled_datetime,
      );
      const key = rowKey(toDelete);
      setRows((list) => list.filter((r) => rowKey(r) !== key));
      setToDelete(null);
      onSaved?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar la fila.';
      setDeleteError(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleAddStaff = async (user: {
    id: number;
    first_name: string;
    last_name: string;
  }) => {
    setStaffSubmitting(true);
    setStaffError(null);
    try {
      const created = await createAttendance({
        course_id: course.id,
        user_id: user.id,
        scheduled_datetime: scheduledDatetime,
        status: 'present',
        attendance_role: staffRole,
      });
      setRows((list) => [...list, created]);
      setStaffOpen(false);
      onSaved?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo agregar al staff.';
      setStaffError(message);
    } finally {
      setStaffSubmitting(false);
    }
  };

  const renderRow = (row: AttendanceRead, hint?: string) => {
    const key = rowKey(row);
    const fullName = `${row.user.first_name} ${row.user.last_name}`;
    const isSaving = savingKey === key;
    return (
      <div className="attendance-row" key={key}>
        <span
          className={
            'avatar-stack__item' +
            (row.attendance_role === 'assistant'
              ? ' avatar-stack__item--assistant'
              : '')
          }
          style={{ marginLeft: 0 }}
          aria-hidden="true"
        >
          {initials(row.user.first_name, row.user.last_name)}
        </span>
        <div className="attendance-row__main">
          <div className="attendance-row__name">{fullName}</div>
          {hint && <div className="attendance-row__hint">{hint}</div>}
        </div>
        <div
          className="status-toggle-group"
          role="group"
          aria-label={`Estado de ${fullName}`}
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              title={labelAttendanceStatus(opt.value)}
              aria-label={labelAttendanceStatus(opt.value)}
              aria-pressed={row.status === opt.value}
              className={
                'status-toggle-group__item status-toggle-group__item--' +
                opt.value +
                (row.status === opt.value ? ' is-active' : '')
              }
              disabled={isSaving}
              onClick={() => handleStatusChange(row, opt.value)}
            >
              {opt.short}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          onClick={() => {
            setDeleteError(null);
            setToDelete(row);
          }}
          title="Eliminar fila"
          aria-label="Eliminar fila"
          disabled={isSaving}
        >
          <TrashIcon size={14} />
        </button>
      </div>
    );
  };

  const subtitle = `${formatSessionDay(scheduledDatetime, 'long')} · ${formatSessionTime(scheduledDatetime)}`;

  return (
    <>
      <SidePanel
        open={open}
        title={`Pasar lista — ${course.name}`}
        subtitle={subtitle}
        onClose={onClose}
      >
        {loading ? (
          <div className="loading-row">
            <SpinnerIcon size={16} /> Cargando…
          </div>
        ) : loadError ? (
          <div className="alert" role="alert">
            {loadError}
          </div>
        ) : (
          <>
            {rowError && (
              <div className="alert" role="alert" style={{ marginBottom: 12 }}>
                {rowError}
              </div>
            )}

            <section className="attendance-section">
              <div className="attendance-section__header">
                <h4 className="attendance-section__title">Staff</h4>
                <span className="attendance-section__count">{staff.length}</span>
              </div>
              {staff.length === 0 ? (
                <p
                  className="empty-state__title"
                  style={{ fontSize: 14, margin: '8px 0' }}
                >
                  Sin staff registrado en esta sesión.
                </p>
              ) : (
                <div className="attendance-list">
                  {staff.map((r) => {
                    const roleLabel = labelAttendanceRole(r.attendance_role);
                    const hint = courseInstructorIds.has(r.user_id)
                      ? roleLabel
                      : `${roleLabel} · Suplente`;
                    return renderRow(r, hint);
                  })}
                </div>
              )}

              {staffOpen ? (
                <div className="attendance-add-staff">
                  <div
                    className="attendance-add-staff__field"
                    style={{ flex: '2 1 220px' }}
                  >
                    <label className="attendance-add-staff__label">
                      Buscar instructor
                    </label>
                    <UserAutocomplete
                      role="instructor"
                      excludeIds={excludeForAdd}
                      onSelect={handleAddStaff}
                      placeholder="Instructor por nombre, correo o expediente"
                      ariaLabel="Buscar instructor"
                    />
                  </div>
                  <div className="attendance-add-staff__field">
                    <label
                      className="attendance-add-staff__label"
                      htmlFor="staff-role"
                    >
                      Rol
                    </label>
                    <select
                      id="staff-role"
                      className="select"
                      value={staffRole}
                      onChange={(e) =>
                        setStaffRole(e.target.value as AttendanceRole)
                      }
                      disabled={staffSubmitting}
                    >
                      <option value="instructor">Instructor</option>
                      <option value="assistant">Asistente</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setStaffOpen(false)}
                    disabled={staffSubmitting}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    setStaffError(null);
                    setStaffOpen(true);
                  }}
                >
                  <PlusIcon size={14} /> Agregar staff
                </button>
              )}

              {staffError && (
                <div className="alert" role="alert" style={{ marginTop: 8 }}>
                  {staffError}
                </div>
              )}
            </section>

            <section
              className="attendance-section"
              style={{ marginTop: 24 }}
            >
              <div className="attendance-section__header">
                <h4 className="attendance-section__title">Estudiantes</h4>
                <span className="attendance-section__count">
                  {students.length}
                </span>
              </div>
              {students.length === 0 ? (
                <p
                  className="empty-state__title"
                  style={{ fontSize: 14, margin: '8px 0' }}
                >
                  Sin estudiantes inscritos activos.
                </p>
              ) : (
                <div className="attendance-list">
                  {students.map((r) => renderRow(r))}
                </div>
              )}
            </section>
          </>
        )}
      </SidePanel>

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar fila"
        message={
          deleteError ??
          (toDelete
            ? `¿Eliminar a ${toDelete.user.first_name} ${toDelete.user.last_name} de esta sesión?`
            : '')
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) {
            setToDelete(null);
            setDeleteError(null);
          }
        }}
      />
    </>
  );
}
