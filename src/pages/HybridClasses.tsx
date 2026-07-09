import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import InstructorCourseDetail from '../components/InstructorCourseDetail';
import CalendarView from '../components/CalendarView';
import DayList from '../components/DayList';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../auth';
import {
  ApiError,
  enrollMe,
  getInstructorPmt,
  getMeHome,
  listEnrollments,
  listInstructorCourses,
  listStudentCourses,
  unenrollMe,
} from '../api';
import { startOfWeek } from '../utils/calendar';
import { formatMoney } from '../utils/money';
import { requiredGroupsLabel } from '../utils/groups';
import { labelAttendanceRole } from '../utils/attendanceLabels';
import { CalendarIcon, EyeIcon, ListIcon, SearchIcon, SpinnerIcon } from '../brand';
import type {
  AssignedCourseRead,
  CourseInstructorLinkPublic,
  CourseInstructorRead,
  CoursePmtRead,
  CourseStudentRead,
  ScheduleDay,
} from '../types';

type ViewMode = 'calendar' | 'list';

const VIEW_STORAGE_KEY = 'instructor_classes_view';

const DAY_SHORT: Record<ScheduleDay, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

interface ClassRow {
  courseId: number;
  name: string;
  nextSession: string | null;
  pmt: CoursePmtRead | null;
}

function currentMonthRange(): { from_date: string; to_date: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  return {
    from_date: iso(new Date(y, m, 1)),
    to_date: iso(new Date(y, m + 1, 0)),
  };
}

function formatNextSession(iso: string | null): string {
  if (!iso) return 'Sin próxima sesión';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} · ${time}`;
}

function schedulesPreview(
  schedules: { schedule_day: ScheduleDay; schedule_time: string }[],
): string {
  if (!schedules.length) return 'Sin horarios';
  return schedules
    .slice(0, 3)
    .map((s) => `${DAY_SHORT[s.schedule_day]} ${s.schedule_time.slice(0, 5)}`)
    .join(' · ');
}

function instructorsPreview(links: CourseInstructorLinkPublic[]): string {
  if (!links.length) return 'Sin instructores';
  return links
    .slice(0, 3)
    .map((l) => {
      const role = l.type === 'instructor' ? 'Instructor' : 'Asistente';
      const last = l.instructor.last_name?.[0] ?? '';
      return `${role}: ${l.instructor.first_name} ${last}.`;
    })
    .join(' · ');
}

type ConfirmAction =
  | { kind: 'enroll'; course: CourseStudentRead }
  | { kind: 'unenroll'; course: CourseStudentRead };

export default function HybridClasses() {
  const { me } = useAuth();
  const currency = me?.academy.currency ?? null;
  const canSelfUnenroll = me?.academy.students_self_unenroll === true;
  const canSelfEnroll = me?.academy.students_self_enroll === true;

  // ---- Clases que imparte (instructor) ----
  const [assigned, setAssigned] = useState<AssignedCourseRead[]>([]);
  const [byCourse, setByCourse] = useState<CoursePmtRead[]>([]);
  const [courses, setCourses] = useState<CourseInstructorRead[]>([]);
  const [teachLoading, setTeachLoading] = useState(true);
  const [teachError, setTeachError] = useState<string | null>(null);
  const [panelCourse, setPanelCourse] = useState<number | null>(null);

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'calendar';
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === 'list' ? 'list' : 'calendar';
  });
  const [currentWeek, setCurrentWeek] = useState<Date>(() =>
    startOfWeek(new Date()),
  );

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      try {
        const [home, pmt, instructorCourses] = await Promise.all([
          getMeHome(),
          getInstructorPmt(me.id, currentMonthRange()),
          listInstructorCourses(),
        ]);
        if (cancelled) return;
        setAssigned(home.assigned_courses ?? []);
        setByCourse(pmt.by_course ?? []);
        setCourses(instructorCourses);
        setTeachError(null);
      } catch (err) {
        if (!cancelled) {
          setTeachError(
            err instanceof ApiError
              ? err.message
              : 'Ocurrió un error, intenta de nuevo',
          );
        }
      } finally {
        if (!cancelled) setTeachLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  const rows = useMemo<ClassRow[]>(() => {
    const map = new Map<number, ClassRow>();
    for (const ac of assigned) {
      map.set(ac.course.id, {
        courseId: ac.course.id,
        name: ac.course.name,
        nextSession: ac.next_session_datetime,
        pmt: null,
      });
    }
    for (const pmt of byCourse) {
      const existing = map.get(pmt.course_id);
      if (existing) {
        existing.pmt = pmt;
      } else {
        map.set(pmt.course_id, {
          courseId: pmt.course_id,
          name: pmt.course_name,
          nextSession: null,
          pmt,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [assigned, byCourse]);

  // Auto-abrir el detalle si venimos del CTA "Pasar lista" de Inicio.
  useEffect(() => {
    const courseParam = searchParams.get('course');
    if (!teachLoading && courseParam) {
      const id = Number(courseParam);
      if (!Number.isNaN(id)) setPanelCourse(id);
    }
  }, [teachLoading, searchParams]);

  const closePanel = () => {
    setPanelCourse(null);
    if (searchParams.has('course')) {
      searchParams.delete('course');
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  };

  // ---- Explorar / inscripciones (estudiante) ----
  const [catalog, setCatalog] = useState<CourseStudentRead[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<number>>(new Set());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [acting, setActing] = useState(false);

  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const [list, enrollments] = await Promise.all([
        listStudentCourses(),
        listEnrollments({ status: 'active' }),
      ]);
      setCatalog(list);
      setEnrolledIds(new Set(enrollments.map((e) => e.course.id)));
    } catch (err) {
      setCatalogError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => c.name.toLowerCase().includes(q));
  }, [catalog, search]);

  const handleEnrollClick = (course: CourseStudentRead) => {
    const cost = course.individual_cost ?? 0;
    if (cost > 0) {
      setConfirm({ kind: 'enroll', course });
    } else {
      void doEnroll(course);
    }
  };

  const doEnroll = async (course: CourseStudentRead) => {
    if (!me) return;
    setActing(true);
    setCatalogError(null);
    try {
      await enrollMe(course.id, me.id);
      showToast(`Te inscribiste en ${course.name}`);
      setConfirm(null);
      await loadCatalog();
    } catch (err) {
      setCatalogError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
      setConfirm(null);
    } finally {
      setActing(false);
    }
  };

  const doUnenroll = async (course: CourseStudentRead) => {
    if (!me) return;
    setActing(true);
    setCatalogError(null);
    try {
      await unenrollMe(course.id, me.id);
      showToast(`Te diste de baja de ${course.name}`);
      setConfirm(null);
      await loadCatalog();
    } catch (err) {
      setCatalogError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
      setConfirm(null);
    } finally {
      setActing(false);
    }
  };

  const teachHeaderActions = (
    <div className="view-toggle" role="tablist" aria-label="Vista">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'calendar'}
        className={
          'view-toggle__item' +
          (view === 'calendar' ? ' view-toggle__item--active' : '')
        }
        onClick={() => setView('calendar')}
      >
        <CalendarIcon size={14} />
        Calendario
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'list'}
        className={
          'view-toggle__item' +
          (view === 'list' ? ' view-toggle__item--active' : '')
        }
        onClick={() => setView('list')}
      >
        <ListIcon size={14} />
        Lista
      </button>
    </div>
  );

  return (
    <Layout title="Mis clases">
      {/* ===== Clases que imparto ===== */}
      <div className="section-header">
        <h2 className="section-header__title">Clases que imparto</h2>
        {teachHeaderActions}
      </div>

      {teachError && (
        <div className="alert" role="alert" style={{ marginBottom: 12 }}>
          {teachError}
        </div>
      )}

      {view === 'calendar' ? (
        teachLoading ? (
          <div className="table-wrapper" style={{ padding: 0 }}>
            <div className="loading-row">
              <SpinnerIcon size={16} /> Cargando clases…
            </div>
          </div>
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__title">No tienes clases asignadas.</p>
          </div>
        ) : (
          <div className="calendar-layout">
            <CalendarView
              courses={courses}
              currentWeek={currentWeek}
              onWeekChange={setCurrentWeek}
              onEventClick={(c) => setPanelCourse(c.id)}
            />
            <DayList
              courses={courses}
              currentWeek={currentWeek}
              onCourseClick={(c) => setPanelCourse(c.id)}
            />
          </div>
        )
      ) : (
        <div className="table-wrapper">
          {teachLoading ? (
            <div className="loading-row">
              <SpinnerIcon size={16} /> Cargando…
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__title">No tienes clases asignadas.</p>
            </div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>Curso</th>
                  <th>Rol</th>
                  <th className="table-cell--nowrap">Próxima sesión</th>
                  <th style={{ textAlign: 'right' }}>Sesiones (mes)</th>
                  <th style={{ textAlign: 'right' }}>Horas (mes)</th>
                  <th style={{ textAlign: 'right' }}>Tarifa/hr</th>
                  <th style={{ textAlign: 'right' }}>Pago acumulado</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.courseId}>
                    <td>
                      <span className="user-cell__name">{row.name}</span>
                    </td>
                    <td>
                      {row.pmt
                        ? labelAttendanceRole(row.pmt.attendance_role)
                        : '—'}
                    </td>
                    <td className="table-cell--nowrap">
                      {formatNextSession(row.nextSession)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.pmt?.sessions ?? 0}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {(row.pmt?.hours ?? 0).toFixed(1)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.pmt ? formatMoney(row.pmt.hourly_rate, currency) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {row.pmt ? formatMoney(row.pmt.payment, currency) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setPanelCourse(row.courseId)}
                        title="Ver detalle"
                        aria-label="Ver detalle"
                      >
                        <EyeIcon size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== Explorar / mis inscripciones ===== */}
      <div className="section-header" style={{ marginTop: 32 }}>
        <h2 className="section-header__title">Explorar / mis inscripciones</h2>
        <div className="search-input">
          <SearchIcon />
          <input
            type="search"
            placeholder="Buscar clase…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {catalogError && (
        <div className="alert" role="alert">
          {catalogError}
        </div>
      )}

      {toast && (
        <div
          className="alert alert--success"
          role="status"
          style={{ marginBottom: 12 }}
        >
          {toast}
        </div>
      )}

      {catalogLoading ? (
        <div className="loading-row">
          <SpinnerIcon size={16} /> Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state__title">
            {search ? 'Sin resultados' : 'No hay clases disponibles'}
          </p>
        </div>
      ) : (
        <div className="course-card-grid">
          {filtered.map((c) => {
            const isEnrolled = enrolledIds.has(c.id);
            const cost = c.individual_cost ?? 0;
            const showCost = cost > 0;
            const locked = !isEnrolled && c.can_enroll === false;

            return (
              <article className="course-card" key={c.id}>
                <div className="course-card__head">
                  <h3 className="course-card__name">{c.name}</h3>
                  {isEnrolled && (
                    <span className="badge badge--enrolled">Inscrito</span>
                  )}
                </div>

                <div className="course-card__meta">
                  <span>{instructorsPreview(c.instructor_links)}</span>
                  <span>{schedulesPreview(c.schedules)}</span>
                  {c.location && <span>{c.location}</span>}
                </div>

                {showCost && (
                  <div className="course-card__cost">
                    {formatMoney(c.individual_cost, currency)}
                  </div>
                )}

                {locked && c.groups.length > 0 && (
                  <div className="course-card__lock">
                    <span className="badge badge--locked">Requiere</span>
                    <span className="course-card__lock-text">
                      {requiredGroupsLabel(c.groups)}
                    </span>
                  </div>
                )}

                <div className="course-card__footer">
                  {isEnrolled ? (
                    canSelfUnenroll ? (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() =>
                          setConfirm({ kind: 'unenroll', course: c })
                        }
                        disabled={acting}
                      >
                        Darme de baja
                      </button>
                    ) : null
                  ) : !canSelfEnroll ? null : locked ? (
                    <button type="button" className="btn btn--ghost" disabled>
                      No disponible
                    </button>
                  ) : !c.has_capacity ? (
                    <button type="button" className="btn btn--ghost" disabled>
                      Sin cupo
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={() => handleEnrollClick(c)}
                      disabled={acting}
                    >
                      Inscribirme
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {panelCourse !== null && (
        <InstructorCourseDetail
          courseId={panelCourse}
          open={panelCourse !== null}
          onClose={closePanel}
        />
      )}

      <ConfirmModal
        open={confirm?.kind === 'enroll'}
        title="Confirmar inscripción"
        message={
          confirm?.kind === 'enroll'
            ? `Se generará un cobro programado de ${formatMoney(
                confirm.course.individual_cost,
                currency,
              )}. ¿Continuar?`
            : ''
        }
        confirmLabel="Inscribirme"
        loading={acting}
        onConfirm={() => {
          if (confirm?.kind === 'enroll') void doEnroll(confirm.course);
        }}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmModal
        open={confirm?.kind === 'unenroll'}
        danger
        title="Darte de baja"
        message={
          confirm?.kind === 'unenroll'
            ? `¿Darte de baja de ${confirm.course.name}?`
            : ''
        }
        confirmLabel="Darme de baja"
        loading={acting}
        onConfirm={() => {
          if (confirm?.kind === 'unenroll') void doUnenroll(confirm.course);
        }}
        onCancel={() => setConfirm(null)}
      />
    </Layout>
  );
}
