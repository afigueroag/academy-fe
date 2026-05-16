import { useMemo, useState } from 'react';
import type { CourseRead, ScheduleDay } from '../types';
import {
  DAY_FULL_LABEL,
  DAY_ORDER,
  addDays,
  buildWeekEvents,
  dayFromDate,
  groupEventsByDay,
  isSameDate,
} from '../utils/calendar';

interface DayListProps {
  courses: CourseRead[];
  currentWeek: Date;
  onCourseClick: (course: CourseRead) => void;
}

function minutesToHHmm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function DayList({
  courses,
  currentWeek,
  onCourseClick,
}: DayListProps) {
  const [onlyToday, setOnlyToday] = useState(false);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const weekEnd = useMemo(() => {
    const d = addDays(currentWeek, 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [currentWeek]);

  const todayInWeek = today >= currentWeek && today <= weekEnd;

  const events = useMemo(
    () => buildWeekEvents(courses, currentWeek),
    [courses, currentWeek],
  );

  const grouped = useMemo(() => groupEventsByDay(events), [events]);

  const dayDates = useMemo(() => {
    const r: Record<ScheduleDay, Date> = {} as Record<ScheduleDay, Date>;
    DAY_ORDER.forEach((d, i) => {
      r[d] = addDays(currentWeek, i);
    });
    return r;
  }, [currentWeek]);

  const todayDay = dayFromDate(today);
  const visibleDays =
    onlyToday && todayInWeek ? [todayDay] : onlyToday ? [] : DAY_ORDER;
  const visibleCount = visibleDays.reduce(
    (acc, d) => acc + grouped[d].length,
    0,
  );

  return (
    <aside className="day-list" aria-label="Agenda de la semana">
      <h3 className="day-list__title">Agenda de la semana</h3>
      <label
        className="day-list__toggle"
        style={{ opacity: todayInWeek ? 1 : 0.5 }}
      >
        <input
          type="checkbox"
          checked={onlyToday}
          onChange={(e) => setOnlyToday(e.target.checked)}
          disabled={!todayInWeek}
        />
        Solo hoy
      </label>

      {visibleCount === 0 ? (
        <p className="day-list__empty">
          {onlyToday
            ? todayInWeek
              ? 'Sin clases programadas para hoy.'
              : 'Hoy no está en esta semana.'
            : 'Sin clases programadas para esta semana.'}
        </p>
      ) : (
        visibleDays.map((day) => {
          const dayEvents = grouped[day];
          if (dayEvents.length === 0) return null;
          const date = dayDates[day];
          const isToday = isSameDate(date, today);
          return (
            <div key={day} className="day-list__day">
              <h4
                className={
                  'day-list__day-heading' +
                  (isToday ? ' day-list__day-heading--today' : '')
                }
              >
                {DAY_FULL_LABEL[day]} {date.getDate()}
              </h4>
              <div className="day-list__items">
                {dayEvents.map((e) => {
                  const primary = e.course.instructor_links.find(
                    (l) => l.type === 'instructor',
                  );
                  return (
                    <button
                      key={`${e.course.id}-${e.scheduleIndex}`}
                      type="button"
                      className="day-list__item"
                      onClick={() => onCourseClick(e.course)}
                    >
                      <span className="day-list__time">
                        {minutesToHHmm(e.startMin)}
                      </span>
                      <span>
                        <span className="day-list__name">{e.course.name}</span>
                        <span className="day-list__meta">
                          {primary && (
                            <span>
                              {primary.instructor.first_name}{' '}
                              {primary.instructor.last_name}
                            </span>
                          )}
                          {e.course.location && (
                            <span>· {e.course.location}</span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </aside>
  );
}
