import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CourseRead, EnrollmentRead, GroupPublic } from '../types';
import {
  ApiError,
  createEnrollment,
  deleteEnrollment,
  listCourses,
  listEnrollments,
} from '../api';
import { PlusIcon, SpinnerIcon, TrashIcon, WarningIcon } from '../brand';
import { findStudentConflicts, type Conflict } from '../utils/conflicts';
import { requiredGroupsLabel, studentMeetsGroups } from '../utils/groups';
import { formatScheduleSummary } from '../utils/schedule';
import ConfirmModal from './ConfirmModal';

// Una clase sigue vigente si no tiene fin o su fin no ha pasado. Misma regla que
// usa el filtro de clases del listado de alumnos.
function isCurrentCourse(c: CourseRead): boolean {
  if (!c.end_date) return true;
  const today = new Date().toISOString().slice(0, 10);
  return c.end_date >= today;
}

// Horario en una línea. Las clases de fecha única no tienen día recurrente, así
// que se muestran por su fecha, igual que en el módulo de Clases.
function courseSchedule(c: {
  recurrence: CourseRead['recurrence'];
  schedules: CourseRead['schedules'];
  duration_minutes: number;
  start_date: string | null;
}): string {
  if (c.recurrence === 'one_time') {
    const date = c.start_date
      ? new Date(c.start_date + 'T00:00:00').toLocaleDateString('es-MX', {
          day: '2-digit',
          month: 'short',
          year: '2-digit',
        })
      : 'Sin fecha';
    const time = c.schedules[0]?.schedule_time.slice(0, 5);
    return time ? `${date} · ${time}` : date;
  }
  return formatScheduleSummary(c.schedules, c.duration_minutes);
}

interface StudentEnrollmentsSectionProps {
  studentId: number;
  studentName: string;
  // Categorías del alumno, para avisar si no cumple las que pide la clase.
  studentGroups: GroupPublic[];
  // Refresca el listado del módulo: la columna "Clases" cambia al inscribir.
  onChanged?: () => void;
}

/**
 * Clases del alumno dentro de su ficha: lista lo que tiene inscrito y permite
 * inscribirlo a otra sin salir del panel. Es el espejo de EnrollmentSection
 * (que hace lo mismo desde la clase) y comparte sus avisos: conflicto de
 * horario, categorías que no cumple y cupo lleno. Ninguno bloquea, solo piden
 * confirmación.
 */
export default function StudentEnrollmentsSection({
  studentId,
  studentName,
  studentGroups,
  onChanged,
}: StudentEnrollmentsSectionProps) {
  const [enrollments, setEnrollments] = useState<EnrollmentRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [courses, setCourses] = useState<CourseRead[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState<string | null>(null);

  const [pendingCourse, setPendingCourse] = useState<CourseRead | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [groupWarning, setGroupWarning] = useState(false);
  const [fullWarning, setFullWarning] = useState(false);
  const [inscribing, setInscribing] = useState(false);
  const [inscribeError, setInscribeError] = useState<string | null>(null);

  const [toRemove, setToRemove] = useState<EnrollmentRead | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Son las inscripciones de UN alumno: caben de sobra en una página.
      const data = await listEnrollments({ student_id: studentId, limit: 200 });
      setEnrollments(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las clases del alumno.',
      );
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const active = useMemo(
    () => enrollments.filter((e) => e.status === 'active'),
    [enrollments],
  );
  const waiting = useMemo(
    () =>
      enrollments
        .filter((e) => e.status === 'waiting')
        .sort((a, b) => (a.waiting_position ?? 0) - (b.waiting_position ?? 0)),
    [enrollments],
  );

  const takenIds = useMemo(
    () =>
      new Set(
        enrollments
          .filter((e) => e.status === 'active' || e.status === 'waiting')
          .map((e) => e.course.id),
      ),
    [enrollments],
  );

  // Catálogo del selector: clases vigentes en las que aún no está inscrito.
  const options = useMemo(
    () => courses.filter((c) => !takenIds.has(c.id)),
    [courses, takenIds],
  );

  const openPicker = async () => {
    setPickerOpen(true);
    setInscribeError(null);
    if (courses.length > 0) return;
    setCoursesLoading(true);
    setCoursesError(null);
    try {
      const data = await listCourses({
        active: true,
        status: 'active',
        limit: 200,
      });
      setCourses(data.filter(isCurrentCourse));
    } catch (err) {
      setCoursesError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las clases.',
      );
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPendingCourse(null);
    setConflicts([]);
    setGroupWarning(false);
    setFullWarning(false);
    setInscribeError(null);
  };

  const performInscribe = async (courseId: number) => {
    setInscribing(true);
    setInscribeError(null);
    try {
      await createEnrollment({ course_id: courseId, student_id: studentId });
      closePicker();
      await fetchEnrollments();
      onChanged?.();
    } catch (err) {
      setInscribeError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo inscribir al alumno.',
      );
    } finally {
      setInscribing(false);
    }
  };

  // Al elegir la clase se corren las tres verificaciones. Si todo está limpio se
  // inscribe de una vez (el punto de esta vista es ahorrar clics); si algo
  // chirría, se muestran los avisos y el admin decide.
  const handlePickCourse = async (course: CourseRead) => {
    setPendingCourse(course);
    setInscribeError(null);
    setConflicts([]);
    setGroupWarning(false);
    setFullWarning(false);
    setChecking(true);
    try {
      // El cupo solo se puede saber contando los inscritos de esa clase.
      const courseEnrollments = await listEnrollments({
        course_id: course.id,
        status: 'active',
        limit: 500,
      });
      const isFull =
        course.max_students !== null &&
        courseEnrollments.length >= course.max_students;
      // `allCourses` se arma con las clases anidadas en las inscripciones del
      // alumno: es justo el conjunto que la función busca por id.
      const scheduleConflicts = findStudentConflicts({
        studentName,
        newCourseSchedules: course.schedules,
        newCourseDuration: course.duration_minutes,
        newCourseId: course.id,
        studentActiveEnrollments: active,
        allCourses: active.map((e) => e.course),
      });
      const meetsGroups = studentMeetsGroups(studentGroups, course.groups);

      if (scheduleConflicts.length === 0 && meetsGroups && !isFull) {
        await performInscribe(course.id);
      } else {
        setConflicts(scheduleConflicts);
        setGroupWarning(!meetsGroups);
        setFullWarning(isFull);
      }
    } catch (err) {
      setInscribeError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo verificar la clase. Intenta de nuevo.',
      );
    } finally {
      setChecking(false);
    }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    setRemoving(true);
    try {
      await deleteEnrollment(toRemove.course.id, studentId);
      setToRemove(null);
      await fetchEnrollments();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo quitar la inscripción.',
      );
    } finally {
      setRemoving(false);
    }
  };

  const needsConfirm = conflicts.length > 0 || groupWarning || fullWarning;

  const renderRow = (e: EnrollmentRead, waitingRow: boolean) => (
    <div key={`${waitingRow ? 'w' : 'a'}-${e.course.id}`} className="enrollment-list__item">
      {waitingRow && (
        <span
          className="waitlist-position"
          aria-label={`Posición ${e.waiting_position ?? '?'}`}
        >
          {e.waiting_position ?? '?'}
        </span>
      )}
      <span className="enrollment-list__text">
        <span className="enrollment-list__title" title={e.course.name}>
          {e.course.name}
        </span>
        <span className="enrollment-list__meta">
          {courseSchedule(e.course)}
          {e.course.location && ` · ${e.course.location}`}
        </span>
      </span>
      <button
        type="button"
        className="icon-btn icon-btn--danger"
        onClick={() => setToRemove(e)}
        title="Quitar"
        aria-label={`Quitar a ${studentName} de ${e.course.name}`}
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );

  return (
    <section className="form-section">
      <h4 className="form-section__title">Clases</h4>

      {error && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="enrollment-list__header">
        <h4 className="enrollment-list__heading">
          Inscrito
          <span className="enrollment-list__count">· {active.length}</span>
        </h4>
        {!pickerOpen && (
          <button type="button" className="btn btn--ghost" onClick={openPicker}>
            <PlusIcon size={14} />
            Inscribir a clase
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

          {coursesError && (
            <div className="alert" role="alert">
              {coursesError}
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="alert alert--warning" role="status">
              <div className="alert__head">
                <WarningIcon size={14} />
                {conflicts.length === 1
                  ? 'Se detectó un conflicto:'
                  : `Se detectaron ${conflicts.length} conflictos:`}
              </div>
              <ul className="alert__list">
                {conflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>
          )}

          {groupWarning && pendingCourse && (
            <div className="alert alert--warning" role="status">
              <div className="alert__head">
                <WarningIcon size={14} />
                El alumno no cumple las categorías requeridas por la clase.
              </div>
              {pendingCourse.groups.length > 0 && (
                <ul className="alert__list">
                  <li>Requiere: {requiredGroupsLabel(pendingCourse.groups)}</li>
                </ul>
              )}
            </div>
          )}

          {fullWarning && (
            <div className="alert alert--warning" role="status">
              <div className="alert__head">
                <WarningIcon size={14} />
                Cupo lleno — al inscribirlo pasará a la lista de espera.
              </div>
            </div>
          )}

          {coursesLoading ? (
            <div className="loading-row" style={{ padding: 0 }}>
              <SpinnerIcon size={14} /> Cargando clases…
            </div>
          ) : needsConfirm && pendingCourse ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span className="pill">{pendingCourse.name}</span>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setPendingCourse(null);
                  setConflicts([]);
                  setGroupWarning(false);
                  setFullWarning(false);
                  setInscribeError(null);
                }}
                disabled={inscribing}
              >
                Otra clase
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => performInscribe(pendingCourse.id)}
                disabled={inscribing}
              >
                {inscribing && <SpinnerIcon size={14} />}
                Inscribir de todas formas
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="select"
                style={{ flex: 1, minWidth: 0 }}
                aria-label="Elegir clase"
                autoFocus
                value={pendingCourse?.id ?? ''}
                disabled={checking || inscribing || options.length === 0}
                onChange={(ev) => {
                  const id = Number(ev.target.value);
                  const course = options.find((c) => c.id === id);
                  if (course) handlePickCourse(course);
                }}
              >
                <option value="">
                  {options.length === 0
                    ? 'No hay clases disponibles'
                    : 'Elige una clase…'}
                </option>
                {options.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {courseSchedule(c)}
                  </option>
                ))}
              </select>
              {(checking || inscribing) && (
                <span className="loading-row" style={{ padding: 0, gap: 6 }}>
                  <SpinnerIcon size={14} />
                  {inscribing ? 'Inscribiendo…' : 'Verificando…'}
                </span>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={closePicker}
                disabled={checking || inscribing}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading-row" style={{ padding: 16 }}>
          <SpinnerIcon size={14} /> Cargando clases…
        </div>
      ) : (
        <div className="enrollment-list">
          {active.length === 0 ? (
            <p className="enrollment-list__empty">
              Sin clases inscritas.
            </p>
          ) : (
            active.map((e) => renderRow(e, false))
          )}
        </div>
      )}

      {waiting.length > 0 && (
        <>
          <div className="enrollment-list__header" style={{ marginTop: 18 }}>
            <h4 className="enrollment-list__heading">
              En espera
              <span className="enrollment-list__count">· {waiting.length}</span>
            </h4>
          </div>
          <div className="enrollment-list">
            {waiting.map((e) => renderRow(e, true))}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!toRemove}
        title="Quitar inscripción"
        message={
          toRemove
            ? `¿Quitar a ${studentName} de "${toRemove.course.name}"?`
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
