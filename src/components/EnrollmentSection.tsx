import { useCallback, useEffect, useState } from 'react';
import type { CourseRead, EnrollmentRead } from '../types';
import {
  ApiError,
  createEnrollment,
  deleteEnrollment,
  getUser,
  listEnrollments,
} from '../api';
import { PlusIcon, SpinnerIcon, TrashIcon, WarningIcon } from '../brand';
import { findStudentConflicts, type Conflict } from '../utils/conflicts';
import { requiredGroupsLabel, studentMeetsGroups } from '../utils/groups';
import ConfirmModal from './ConfirmModal';
import UserAutocomplete from './UserAutocomplete';

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

interface EnrollmentSectionProps {
  course: CourseRead;
  allCourses: CourseRead[];
  onCountsChanged?: () => void;
}

export default function EnrollmentSection({
  course,
  allCourses,
  onCountsChanged,
}: EnrollmentSectionProps) {
  const [enrollments, setEnrollments] = useState<EnrollmentRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [inscribing, setInscribing] = useState(false);
  const [inscribeError, setInscribeError] = useState<string | null>(null);
  const [pendingStudent, setPendingStudent] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [studentConflicts, setStudentConflicts] = useState<Conflict[]>([]);
  // Advertencia no bloqueante: el alumno no cumple los grupos de la clase.
  const [groupWarning, setGroupWarning] = useState(false);

  const [toRemove, setToRemove] = useState<EnrollmentRead | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEnrollments({ course_id: course.id });
      setEnrollments(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las inscripciones.';
      setError(message);
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [course.id]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const active = enrollments.filter((e) => e.status === 'active');
  const waiting = enrollments
    .filter((e) => e.status === 'waiting')
    .sort((a, b) => (a.waiting_position ?? 0) - (b.waiting_position ?? 0));

  const isFull =
    course.max_students !== null && active.length >= course.max_students;

  const enrolledIds = enrollments
    .filter((e) => e.status === 'active' || e.status === 'waiting')
    .map((e) => e.student.id);

  // El admin debe confirmar manualmente si hay conflictos de horario o si el
  // alumno no cumple los grupos. Ninguno bloquea: solo advierte.
  const needsConfirm = studentConflicts.length > 0 || groupWarning;

  const performInscribe = async (studentId: number) => {
    setInscribing(true);
    setInscribeError(null);
    try {
      await createEnrollment({ course_id: course.id, student_id: studentId });
      setPickerOpen(false);
      setPendingStudent(null);
      setStudentConflicts([]);
      setGroupWarning(false);
      await fetchEnrollments();
      onCountsChanged?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo inscribir al alumno.';
      setInscribeError(message);
    } finally {
      setInscribing(false);
    }
  };

  const handlePickStudent = async (u: {
    id: number;
    first_name: string;
    last_name: string;
  }) => {
    const name = `${u.first_name} ${u.last_name}`;
    setPendingStudent({ id: u.id, name });
    setInscribeError(null);
    setStudentConflicts([]);
    setGroupWarning(false);
    setCheckingConflicts(true);
    try {
      const [studentEnrollments, student] = await Promise.all([
        listEnrollments({ student_id: u.id, status: 'active' }),
        getUser(u.id),
      ]);
      const conflicts = findStudentConflicts({
        studentName: name,
        newCourseSchedules: course.schedules,
        newCourseDuration: course.duration_minutes,
        newCourseId: course.id,
        studentActiveEnrollments: studentEnrollments,
        allCourses,
      });
      const meetsGroups = studentMeetsGroups(
        student.groups ?? [],
        course.groups,
      );
      if (conflicts.length === 0 && meetsGroups) {
        await performInscribe(u.id);
      } else {
        setStudentConflicts(conflicts);
        setGroupWarning(!meetsGroups);
      }
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo verificar conflictos del alumno.';
      setInscribeError(message);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleClearPending = () => {
    setPendingStudent(null);
    setStudentConflicts([]);
    setGroupWarning(false);
    setInscribeError(null);
  };

  const handleClosePicker = () => {
    setPickerOpen(false);
    setPendingStudent(null);
    setStudentConflicts([]);
    setGroupWarning(false);
    setInscribeError(null);
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await deleteEnrollment(course.id, toRemove.student.id);
      setToRemove(null);
      await fetchEnrollments();
      onCountsChanged?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo quitar la inscripción.';
      setError(message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="form-section">
      <h3 className="form-section__title">Inscripciones</h3>

      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {isFull && !pickerOpen && (
        <div style={{ marginBottom: 10 }}>
          <span className="capacity-notice">
            Cupo lleno — los nuevos pasan a lista de espera
          </span>
        </div>
      )}

      <div className="enrollment-list__header">
        <h4 className="enrollment-list__heading">
          Inscritos
          <span className="enrollment-list__count">· {active.length}</span>
        </h4>
        {!pickerOpen && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setInscribeError(null);
              setPickerOpen(true);
            }}
          >
            <PlusIcon size={14} />
            Inscribir alumno
          </button>
        )}
      </div>

      {pickerOpen && (
        <div style={{ marginBottom: 12 }}>
          {inscribeError && (
            <div className="alert" role="alert">
              {inscribeError}
            </div>
          )}

          {pendingStudent && studentConflicts.length > 0 && (
            <div className="alert alert--warning" role="status">
              <div className="alert__head">
                <WarningIcon size={14} />
                {studentConflicts.length === 1
                  ? 'Se detectó un conflicto:'
                  : `Se detectaron ${studentConflicts.length} conflictos:`}
              </div>
              <ul className="alert__list">
                {studentConflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>
          )}

          {pendingStudent && groupWarning && (
            <div className="alert alert--warning" role="status">
              <div className="alert__head">
                <WarningIcon size={14} />
                El alumno no cumple los grupos requeridos por la clase.
              </div>
              {course.groups.length > 0 && (
                <ul className="alert__list">
                  <li>Requiere: {requiredGroupsLabel(course.groups)}</li>
                </ul>
              )}
            </div>
          )}

          {!pendingStudent && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <UserAutocomplete
                  role="student"
                  excludeIds={enrolledIds}
                  placeholder="Buscar alumno por nombre, correo o expediente"
                  ariaLabel="Buscar alumno"
                  autoFocus
                  onSelect={handlePickStudent}
                />
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleClosePicker}
                disabled={inscribing || checkingConflicts}
              >
                Cancelar
              </button>
            </div>
          )}

          {pendingStudent && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: needsConfirm ? 0 : 4,
              }}
            >
              <span className="pill">{pendingStudent.name}</span>
              {checkingConflicts ? (
                <span
                  className="loading-row"
                  style={{ padding: 0, gap: 6 }}
                >
                  <SpinnerIcon size={14} /> Verificando…
                </span>
              ) : (
                needsConfirm && (
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={handleClearPending}
                      disabled={inscribing}
                    >
                      Otro alumno
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => performInscribe(pendingStudent.id)}
                      disabled={inscribing}
                    >
                      {inscribing && <SpinnerIcon />}
                      Inscribir de todas formas
                    </button>
                  </>
                )
              )}
              {inscribing && !needsConfirm && (
                <span
                  className="loading-row"
                  style={{ padding: 0, gap: 6 }}
                >
                  <SpinnerIcon size={14} /> Inscribiendo…
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading-row" style={{ padding: 16 }}>
          <SpinnerIcon size={14} /> Cargando inscripciones…
        </div>
      ) : (
        <div className="enrollment-list">
          {active.length === 0 ? (
            <p className="enrollment-list__empty">Sin alumnos inscritos.</p>
          ) : (
            active.map((e) => (
              <div
                key={`active-${e.student.id}`}
                className="enrollment-list__item"
              >
                <span
                  className="avatar-stack__item"
                  style={{ marginLeft: 0 }}
                  aria-hidden="true"
                >
                  {initials(e.student.first_name, e.student.last_name)}
                </span>
                <span className="enrollment-list__name">
                  {e.student.first_name} {e.student.last_name}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => setToRemove(e)}
                  title="Quitar"
                  aria-label={`Quitar a ${e.student.first_name} ${e.student.last_name}`}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {waiting.length > 0 && (
        <>
          <div
            className="enrollment-list__header"
            style={{ marginTop: 18 }}
          >
            <h4 className="enrollment-list__heading">
              En espera
              <span className="enrollment-list__count">· {waiting.length}</span>
            </h4>
          </div>
          <div className="enrollment-list">
            {waiting.map((e) => (
              <div
                key={`waiting-${e.student.id}`}
                className="enrollment-list__item"
              >
                <span
                  className="waitlist-position"
                  aria-label={`Posición ${e.waiting_position ?? '?'}`}
                >
                  {e.waiting_position ?? '?'}
                </span>
                <span
                  className="avatar-stack__item"
                  style={{ marginLeft: 0 }}
                  aria-hidden="true"
                >
                  {initials(e.student.first_name, e.student.last_name)}
                </span>
                <span className="enrollment-list__name">
                  {e.student.first_name} {e.student.last_name}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => setToRemove(e)}
                  title="Quitar"
                  aria-label={`Quitar a ${e.student.first_name} ${e.student.last_name} de la lista de espera`}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!toRemove}
        title="Quitar inscripción"
        message={
          toRemove
            ? `¿Quitar a ${toRemove.student.first_name} ${toRemove.student.last_name} de la clase?`
            : ''
        }
        confirmLabel="Quitar"
        danger
        loading={removing}
        onConfirm={handleRemove}
        onCancel={() => !removing && setToRemove(null)}
      />
    </section>
  );
}
