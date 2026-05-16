import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Layout from '../components/Layout';
import SidePanel from '../components/SidePanel';
import ConfirmModal from '../components/ConfirmModal';
import CourseStatusBadge from '../components/CourseStatusBadge';
import CourseForm from '../components/CourseForm';
import CourseDetails from '../components/CourseDetails';
import CalendarView from '../components/CalendarView';
import DayList from '../components/DayList';
import { useAuth } from '../auth';
import { buildWeekEvents, startOfWeek } from '../utils/calendar';
import {
  ApiError,
  createCourse,
  deleteCourse,
  getToken,
  listCourses,
  listEnrollments,
  updateCourse,
} from '../api';
import type {
  CourseCreate,
  CourseRead,
  CourseStatus,
  CourseUpdate,
  ScheduleDay,
} from '../types';
import {
  CalendarIcon,
  EyeIcon,
  ListIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
} from '../brand';

type StatusFilter = CourseStatus | 'all';
type ViewMode = 'calendar' | 'list';

const VIEW_STORAGE_KEY = 'classes_view';

type PanelState =
  | { kind: 'create' }
  | { kind: 'edit'; course: CourseRead }
  | { kind: 'view'; course: CourseRead }
  | null;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'active', label: 'Activas' },
  { value: 'draft', label: 'Borrador' },
  { value: 'archived', label: 'Archivadas' },
  { value: 'all', label: 'Todas' },
];

const DAY_SHORT: Record<ScheduleDay, string> = {
  monday: 'L',
  tuesday: 'M',
  wednesday: 'X',
  thursday: 'J',
  friday: 'V',
  saturday: 'S',
  sunday: 'D',
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function formatDateShort(value: string | null): string {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
  });
}

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

export default function Classes() {
  const token = getToken();
  const { me } = useAuth();

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'calendar';
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return stored === 'list' ? 'list' : 'calendar';
  });
  const [currentWeek, setCurrentWeek] = useState<Date>(() =>
    startOfWeek(new Date()),
  );

  const [status, setStatus] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');
  const [instructorFilter, setInstructorFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedInstructor, setDebouncedInstructor] = useState('');

  useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  const [courses, setCourses] = useState<CourseRead[]>([]);
  const [activeCourses, setActiveCourses] = useState<CourseRead[]>([]);
  const [enrollmentCounts, setEnrollmentCounts] = useState<
    Record<number, number>
  >({});
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [panel, setPanel] = useState<PanelState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelApiError, setPanelApiError] = useState<ApiError | null>(null);

  const [toDelete, setToDelete] = useState<CourseRead | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setDebouncedInstructor(instructorFilter.trim()),
      300,
    );
    return () => window.clearTimeout(t);
  }, [instructorFilter]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listCourses({
        status: status === 'all' ? undefined : status,
        search: debouncedSearch || undefined,
        instructor: debouncedInstructor || undefined,
      });
      setCourses(data);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudieron cargar las clases.';
      setListError(message);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [status, debouncedSearch, debouncedInstructor]);

  const fetchEnrollmentCounts = useCallback(async () => {
    try {
      const all = await listEnrollments({ status: 'active' });
      const map: Record<number, number> = {};
      for (const e of all) {
        map[e.course.id] = (map[e.course.id] ?? 0) + 1;
      }
      setEnrollmentCounts(map);
    } catch {
      setEnrollmentCounts({});
    }
  }, []);

  const fetchActiveCourses = useCallback(async () => {
    try {
      const data = await listCourses({ status: 'active' });
      setActiveCourses(data);
    } catch {
      setActiveCourses([]);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchEnrollmentCounts();
  }, [fetchEnrollmentCounts]);

  useEffect(() => {
    fetchActiveCourses();
  }, [fetchActiveCourses]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const filtered = useMemo(() => {
    const term = locationFilter.trim().toLowerCase();
    if (!term) return courses;
    return courses.filter((c) =>
      (c.location ?? '').toLowerCase().includes(term),
    );
  }, [courses, locationFilter]);

  const kpis = useMemo(() => {
    const activeCount = activeCourses.length;
    const weeklySessions = buildWeekEvents(activeCourses, currentWeek).length;
    const instructorIds = new Set<number>();
    for (const c of activeCourses) {
      for (const link of c.instructor_links) instructorIds.add(link.instructor_id);
    }
    return {
      activeCount,
      weeklySessions,
      instructorCount: instructorIds.size,
    };
  }, [activeCourses, currentWeek]);

  const closePanel = useCallback(() => {
    if (submitting) return;
    setPanel(null);
    setPanelError(null);
    setPanelApiError(null);
  }, [submitting]);

  const openCreate = () => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'create' });
  };
  const openEdit = (course: CourseRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'edit', course });
  };
  const openView = (course: CourseRead) => {
    setPanelError(null);
    setPanelApiError(null);
    setPanel({ kind: 'view', course });
  };

  const handleCreate = async (payload: CourseCreate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      const created = await createCourse(payload);
      setCourses((list) => [created, ...list]);
      showToast('Clase creada');
      setPanel(null);
      fetchActiveCourses();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo crear la clase.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: number, payload: CourseUpdate) => {
    setSubmitting(true);
    setPanelError(null);
    setPanelApiError(null);
    try {
      const updated = await updateCourse(id, payload);
      setCourses((list) => list.map((c) => (c.id === id ? updated : c)));
      showToast('Clase actualizada');
      setPanel(null);
      fetchActiveCourses();
    } catch (err) {
      if (err instanceof ApiError) {
        setPanelApiError(err);
        setPanelError(err.message);
      } else {
        setPanelError('No se pudo actualizar la clase.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteCourse(toDelete.id);
      setCourses((list) => list.filter((c) => c.id !== toDelete.id));
      showToast('Clase eliminada');
      setToDelete(null);
      fetchEnrollmentCounts();
      fetchActiveCourses();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar la clase.';
      showToast(message);
    } finally {
      setDeleting(false);
    }
  };

  if (!token) return <Navigate to="/login" replace />;

  const headerActions = (
    <>
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
      <button type="button" className="btn btn--primary" onClick={openCreate}>
        <PlusIcon size={14} />
        Crear clase
      </button>
    </>
  );

  const currency = me?.academy.currency ?? null;
  const defaultInstructorRate =
    me?.academy.default_instructor_hourly_rate ?? null;
  const defaultAssistantRate =
    me?.academy.default_assistant_hourly_rate ?? null;

  return (
    <Layout title="Clases" actions={headerActions}>
      <section className="summary-grid">
        <div className="summary-card">
          <p className="summary-card__label">Clases activas</p>
          <div className="summary-card__value">{kpis.activeCount}</div>
        </div>
        <div className="summary-card">
          <p className="summary-card__label">Sesiones esta semana</p>
          <div className="summary-card__value">{kpis.weeklySessions}</div>
        </div>
        <div className="summary-card">
          <p className="summary-card__label">Instructores asignados</p>
          <div className="summary-card__value">{kpis.instructorCount}</div>
        </div>
      </section>

      <section className="filter-bar">
        <div className="search-input">
          <SearchIcon size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre"
            aria-label="Buscar por nombre"
          />
        </div>
        <div className="search-input">
          <SearchIcon size={16} />
          <input
            type="search"
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value)}
            placeholder="Filtrar por instructor"
            aria-label="Filtrar por instructor"
          />
        </div>
        <div className="search-input">
          <MapPinIcon size={16} />
          <input
            type="search"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            placeholder="Filtrar por ubicación"
            aria-label="Filtrar por ubicación"
          />
        </div>
        <div className="tab-group" role="tablist">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={status === f.value}
              className={
                'tab-group__item' +
                (status === f.value ? ' tab-group__item--active' : '')
              }
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        {listError && (
          <div className="alert" role="alert" style={{ marginBottom: 12 }}>
            {listError}
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

        {view === 'calendar' ? (
          loading ? (
            <div
              className="table-wrapper"
              style={{ padding: 0 }}
            >
              <div className="loading-row">
                <SpinnerIcon size={16} /> Cargando clases…
              </div>
            </div>
          ) : (
            <div className="calendar-layout">
              <CalendarView
                courses={filtered}
                currentWeek={currentWeek}
                onWeekChange={setCurrentWeek}
                onEventClick={openView}
              />
              <DayList
                courses={filtered}
                currentWeek={currentWeek}
                onCourseClick={openView}
              />
            </div>
          )
        ) : (
          <div className="table-wrapper">
            {loading ? (
              <div className="loading-row">
                <SpinnerIcon size={16} /> Cargando clases…
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__title">
                  Sin clases que coincidan con los filtros
                </p>
                <p>Ajusta la búsqueda o crea una clase nueva.</p>
              </div>
            ) : (
              <table className="users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Horarios</th>
                  <th>Duración</th>
                  <th>Instructores</th>
                  <th>Ubicación</th>
                  <th>Cupos</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const count = enrollmentCounts[c.id] ?? 0;
                  const capacity =
                    c.max_students !== null
                      ? `${count} / ${c.max_students}`
                      : String(count);
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="user-cell__name">{c.name}</div>
                      </td>
                      <td>
                        {c.recurrence === 'one_time' ? (
                          <span className="schedule-chip">
                            {formatDateShort(c.start_date)}
                            {c.schedules[0] &&
                              ` · ${formatTime(c.schedules[0].schedule_time)}`}
                          </span>
                        ) : c.schedules.length === 0 ? (
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            —
                          </span>
                        ) : (
                          <div className="schedule-chips">
                            {c.schedules.map((s, i) => (
                              <span key={i} className="schedule-chip">
                                {DAY_SHORT[s.schedule_day]}{' '}
                                {formatTime(s.schedule_time)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{formatDuration(c.duration_minutes)}</td>
                      <td>
                        {c.instructor_links.length === 0 ? (
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            —
                          </span>
                        ) : (
                          <div className="avatar-stack">
                            {c.instructor_links.map((link) => (
                              <span
                                key={link.id}
                                className={
                                  'avatar-stack__item' +
                                  (link.type === 'assistant'
                                    ? ' avatar-stack__item--assistant'
                                    : '')
                                }
                                title={`${link.instructor.first_name} ${link.instructor.last_name} · ${link.type === 'instructor' ? 'Instructor' : 'Asistente'}`}
                              >
                                {initials(
                                  link.instructor.first_name,
                                  link.instructor.last_name,
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{c.location ?? '—'}</td>
                      <td>{capacity}</td>
                      <td>
                        <CourseStatusBadge status={c.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openView(c)}
                            title="Ver detalles"
                            aria-label="Ver detalles"
                          >
                            <EyeIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => openEdit(c)}
                            title="Editar"
                            aria-label="Editar"
                          >
                            <PencilIcon size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            onClick={() => setToDelete(c)}
                            title="Eliminar"
                            aria-label="Eliminar"
                          >
                            <TrashIcon size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      <SidePanel
        open={panel?.kind === 'create'}
        title="Crear clase"
        subtitle="Define el horario, capacidad e instructores"
        onClose={closePanel}
      >
        {panel?.kind === 'create' && (
          <CourseForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
            defaultInstructorRate={defaultInstructorRate}
            defaultAssistantRate={defaultAssistantRate}
            currency={currency}
            allCourses={activeCourses}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'edit'}
        title="Editar clase"
        subtitle={panel?.kind === 'edit' ? panel.course.name : undefined}
        onClose={closePanel}
      >
        {panel?.kind === 'edit' && (
          <CourseForm
            mode="edit"
            course={panel.course}
            onSubmit={(payload) => handleUpdate(panel.course.id, payload)}
            onCancel={closePanel}
            submitting={submitting}
            serverError={panelError}
            apiError={panelApiError}
            defaultInstructorRate={defaultInstructorRate}
            defaultAssistantRate={defaultAssistantRate}
            currency={currency}
            allCourses={activeCourses}
          />
        )}
      </SidePanel>

      <SidePanel
        open={panel?.kind === 'view'}
        title="Detalle de la clase"
        subtitle={panel?.kind === 'view' ? panel.course.name : undefined}
        onClose={closePanel}
        footer={
          panel?.kind === 'view' ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setToDelete(panel.course)}
              >
                <TrashIcon size={14} />
                Eliminar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => panel.kind === 'view' && openEdit(panel.course)}
              >
                <PencilIcon size={14} />
                Editar
              </button>
            </>
          ) : undefined
        }
      >
        {panel?.kind === 'view' && (
          <CourseDetails
            course={panel.course}
            enrollmentCount={enrollmentCounts[panel.course.id] ?? 0}
            currency={currency}
            allCourses={activeCourses}
            onCountsChanged={fetchEnrollmentCounts}
          />
        )}
      </SidePanel>

      <ConfirmModal
        open={!!toDelete}
        title="Eliminar clase"
        message={
          toDelete
            ? `¿Eliminar la clase “${toDelete.name}”? Esta acción no se puede deshacer y eliminará también todas las inscripciones.`
            : ''
        }
        confirmLabel="Eliminar"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </Layout>
  );
}
