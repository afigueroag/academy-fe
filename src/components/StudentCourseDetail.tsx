import type { ReactNode } from 'react';
import type { CourseStudentRead, ScheduleDay } from '../types';
import { formatMoney } from '../utils/money';
import { CourseStatusBadge } from './Badges';

const DAY_LABEL: Record<ScheduleDay, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m} min`;
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function Item({
  label,
  value,
}: {
  label: string;
  value: string | null | ReactNode;
}) {
  const isEmpty =
    value === null || value === undefined || value === '' || value === '—';
  return (
    <div className="detail-item">
      <span className="detail-item__label">{label}</span>
      <span
        className={
          'detail-item__value' + (isEmpty ? ' detail-item__value--empty' : '')
        }
      >
        {isEmpty ? '—' : value}
      </span>
    </div>
  );
}

interface StudentCourseDetailProps {
  course: CourseStudentRead;
  currency: string | null;
}

export default function StudentCourseDetail({
  course,
  currency,
}: StudentCourseDetailProps) {
  const recurrenceLabel =
    course.recurrence === 'one_time' ? 'Sesión única' : 'Semanal';

  const showCost =
    course.individual_cost !== null && course.individual_cost > 0;

  return (
    <div>
      <section className="form-section">
        <h3 className="form-section__title">Información general</h3>
        <div className="detail-list">
          <Item label="Nombre" value={course.name} />
          <Item label="Descripción" value={course.description} />
          <Item label="Ubicación" value={course.location} />
          <Item label="Recurrencia" value={recurrenceLabel} />
          <Item
            label="Estado"
            value={<CourseStatusBadge status={course.status} />}
          />
        </div>
      </section>

      <section className="form-section">
        <h3 className="form-section__title">Programación</h3>
        <div className="detail-list">
          <Item
            label="Duración"
            value={formatDuration(course.duration_minutes)}
          />
          <Item label="Fecha de inicio" value={formatDate(course.start_date)} />
          {course.recurrence !== 'one_time' && (
            <Item label="Fecha de fin" value={formatDate(course.end_date)} />
          )}
          <Item
            label="Horarios"
            value={
              course.schedules.length === 0 ? null : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {course.schedules.map((s, i) => (
                    <li key={s.id ?? i}>
                      {DAY_LABEL[s.schedule_day]} · {formatTime(s.schedule_time)}
                    </li>
                  ))}
                </ul>
              )
            }
          />
        </div>
      </section>

      {showCost && (
        <section className="form-section">
          <h3 className="form-section__title">Costo</h3>
          <div className="detail-list">
            <Item
              label="Costo individual"
              value={formatMoney(course.individual_cost as number, currency)}
            />
          </div>
        </section>
      )}

      <section className="form-section">
        <h3 className="form-section__title">Instructores</h3>
        {course.instructor_links.length === 0 ? (
          <p
            className="detail-item__value detail-item__value--empty"
            style={{ marginTop: 4 }}
          >
            Sin instructores asignados.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {course.instructor_links.map((link, i) => {
              const name = `${link.instructor.first_name} ${link.instructor.last_name}`;
              const typeLabel =
                link.type === 'instructor' ? 'Instructor' : 'Asistente';
              return (
                <li
                  key={`${link.instructor.id}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <span
                    className={
                      'avatar-stack__item' +
                      (link.type === 'assistant'
                        ? ' avatar-stack__item--assistant'
                        : '')
                    }
                    style={{ marginLeft: 0 }}
                    aria-hidden="true"
                  >
                    {initials(
                      link.instructor.first_name,
                      link.instructor.last_name,
                    )}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{name}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {typeLabel}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
