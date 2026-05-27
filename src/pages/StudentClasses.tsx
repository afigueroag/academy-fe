import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../auth';
import {
  ApiError,
  enrollMe,
  listEnrollments,
  listStudentCourses,
  unenrollMe,
} from '../api';
import { formatMoney } from '../utils/money';
import { SearchIcon, SpinnerIcon } from '../brand';
import type {
  CourseInstructorLinkPublic,
  CourseStudentRead,
  ScheduleDay,
} from '../types';

const DAY_SHORT: Record<ScheduleDay, string> = {
  monday: 'Lun',
  tuesday: 'Mar',
  wednesday: 'Mié',
  thursday: 'Jue',
  friday: 'Vie',
  saturday: 'Sáb',
  sunday: 'Dom',
};

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

export default function StudentClasses() {
  const { me } = useAuth();
  const currency = me?.academy.currency ?? null;
  const canSelfUnenroll = me?.academy.students_self_unenroll === true;

  const [courses, setCourses] = useState<CourseStudentRead[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, enrollments] = await Promise.all([
        listStudentCourses(),
        listEnrollments({ status: 'active' }),
      ]);
      setCourses(list);
      setEnrolledIds(new Set(enrollments.map((e) => e.course.id)));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(q));
  }, [courses, search]);

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
    setError(null);
    try {
      await enrollMe(course.id, me.id);
      showToast(`Te inscribiste en ${course.name}`);
      setConfirm(null);
      await load();
    } catch (err) {
      setError(
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
    setError(null);
    try {
      await unenrollMe(course.id, me.id);
      showToast(`Te diste de baja de ${course.name}`);
      setConfirm(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Ocurrió un error, intenta de nuevo',
      );
      setConfirm(null);
    } finally {
      setActing(false);
    }
  };

  return (
    <Layout title="Clases">
      <div className="filter-bar" style={{ marginBottom: 16 }}>
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

      {error && (
        <div className="alert" role="alert">
          {error}
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

      {loading ? (
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
                  ) : !c.has_capacity ? (
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled
                    >
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
