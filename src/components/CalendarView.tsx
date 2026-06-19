import { useMemo } from 'react';
import type { CalendarCourse } from '../types';
import { ChevronLeftIcon, ChevronRightIcon } from '../brand';
import {
  DAY_ORDER,
  DAY_SHORT_LABEL,
  HOUR_PX,
  addDays,
  buildWeekEvents,
  computeHourRange,
  dayFromDate,
  formatTime,
  formatWeekRange,
  groupEventsByDay,
  isSameDate,
  layoutDayEvents,
  startOfWeek,
} from '../utils/calendar';

interface CalendarViewProps<T extends CalendarCourse> {
  courses: T[];
  currentWeek: Date;
  onWeekChange: (next: Date) => void;
  onEventClick: (course: T) => void;
}

export default function CalendarView<T extends CalendarCourse>({
  courses,
  currentWeek,
  onWeekChange,
  onEventClick,
}: CalendarViewProps<T>) {
  const monday = currentWeek;
  const sunday = addDays(monday, 6);

  const weekDays = useMemo(
    () => DAY_ORDER.map((_, i) => addDays(monday, i)),
    [monday],
  );

  const { eventsByDay, startHour, endHour } = useMemo(() => {
    const all = buildWeekEvents(courses, monday);
    const range = computeHourRange(all);
    return {
      eventsByDay: groupEventsByDay(all),
      startHour: range.startHour,
      endHour: range.endHour,
    };
  }, [courses, monday]);

  const totalGridPx = (endHour - startHour) * HOUR_PX;

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  const goPrev = () => onWeekChange(addDays(monday, -7));
  const goNext = () => onWeekChange(addDays(monday, 7));
  const goToday = () => onWeekChange(startOfWeek(new Date()));

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    }
  };

  return (
    <div
      className="calendar"
      role="region"
      aria-label="Calendario semanal"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <header className="calendar__header">
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={goPrev}
          aria-label="Semana anterior"
          title="Semana anterior"
        >
          <ChevronLeftIcon size={16} />
        </button>
        <button
          type="button"
          className="calendar__nav-btn"
          onClick={goNext}
          aria-label="Semana siguiente"
          title="Semana siguiente"
        >
          <ChevronRightIcon size={16} />
        </button>
        <h2 className="calendar__week-label">
          {formatWeekRange(monday, sunday)}
        </h2>
        <button
          type="button"
          className="btn btn--ghost calendar__today-btn"
          onClick={goToday}
        >
          Hoy
        </button>
      </header>

      <div className="calendar__grid">
        <div className="calendar__corner" />
        {DAY_ORDER.map((day, i) => {
          const date = weekDays[i];
          const isToday = isSameDate(date, today);
          return (
            <div
              key={day}
              className={
                'calendar__day-header' +
                (isToday ? ' calendar__day-header--today' : '')
              }
              aria-current={isToday ? 'date' : undefined}
            >
              <span className="calendar__day-header__name">
                {DAY_SHORT_LABEL[day]}
              </span>
              <span className="calendar__day-header__num">{date.getDate()}</span>
            </div>
          );
        })}

        <div
          className="calendar__hours-col"
          style={{ height: totalGridPx }}
          aria-hidden="true"
        >
          {hours.map((h) => (
            <span
              key={h}
              className="calendar__hour-label"
              style={{ top: (h - startHour) * HOUR_PX }}
            >
              {String(h).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {DAY_ORDER.map((day) => {
          const positioned = layoutDayEvents(eventsByDay[day], startHour);
          return (
            <div
              key={day}
              className="calendar__day-col"
              style={{ height: totalGridPx }}
            >
              {positioned.map((pe) => {
                const widthPct = 100 / pe.totalCols;
                const leftPct = pe.col * widthPct;
                const primary = pe.course.instructor_links.find(
                  (l) => l.type === 'instructor',
                );
                return (
                  <button
                    key={`${pe.course.id}-${pe.scheduleIndex}`}
                    type="button"
                    className="calendar__event"
                    style={{
                      top: pe.topPx,
                      height: pe.heightPx - 2,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                    onClick={() => onEventClick(pe.course)}
                    title={pe.course.name}
                  >
                    <div className="calendar__event-title">
                      {pe.course.name}
                    </div>
                    <div className="calendar__event-meta">
                      {formatTime(
                        pe.course.recurrence === 'one_time'
                          ? pe.course.schedules[0]?.schedule_time ?? ''
                          : pe.course.schedules[pe.scheduleIndex]
                              ?.schedule_time ?? '',
                      )}
                      {primary && (
                        <>
                          {' · '}
                          {primary.instructor.first_name}{' '}
                          {primary.instructor.last_name}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { dayFromDate };
