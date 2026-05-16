import type {
  CourseRead,
  EnrollmentRead,
  ScheduleCreate,
  ScheduleDay,
} from '../types';
import { parseTimeMinutes } from './calendar';

const DAY_LOWER: Record<ScheduleDay, string> = {
  monday: 'lunes',
  tuesday: 'martes',
  wednesday: 'miércoles',
  thursday: 'jueves',
  friday: 'viernes',
  saturday: 'sábado',
  sunday: 'domingo',
};

export type ConflictCategory = 'instructor' | 'location' | 'student';

export interface Conflict {
  category: ConflictCategory;
  message: string;
}

function minutesToHHmm(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function schedulesOverlap(
  a: ScheduleCreate,
  aDur: number,
  b: ScheduleCreate,
  bDur: number,
): boolean {
  if (a.schedule_day !== b.schedule_day) return false;
  const aStart = parseTimeMinutes(a.schedule_time);
  const bStart = parseTimeMinutes(b.schedule_time);
  return aStart < bStart + bDur && bStart < aStart + aDur;
}

function firstOverlap(
  ours: ScheduleCreate[],
  oursDur: number,
  theirs: ScheduleCreate[],
  theirsDur: number,
): ScheduleCreate | null {
  for (const o of ours) {
    for (const t of theirs) {
      if (schedulesOverlap(o, oursDur, t, theirsDur)) return t;
    }
  }
  return null;
}

function rangeLabel(s: ScheduleCreate, durationMin: number): string {
  const start = parseTimeMinutes(s.schedule_time);
  const end = start + durationMin;
  return `los ${DAY_LOWER[s.schedule_day]} de ${minutesToHHmm(start)} a ${minutesToHHmm(end)}`;
}

interface FormConflictsInput {
  schedules: ScheduleCreate[];
  durationMin: number;
  location: string | null;
  instructors: { id: number; name: string }[];
  currentCourseId: number | null;
  allCourses: CourseRead[];
}

export function findFormConflicts(input: FormConflictsInput): Conflict[] {
  const out: Conflict[] = [];
  const {
    schedules,
    durationMin,
    location,
    instructors,
    currentCourseId,
    allCourses,
  } = input;

  if (schedules.length === 0 || durationMin <= 0) return out;

  for (const row of instructors) {
    for (const c of allCourses) {
      if (c.id === currentCourseId) continue;
      if (c.status !== 'active') continue;
      const linked = c.instructor_links.some(
        (l) => l.instructor_id === row.id,
      );
      if (!linked) continue;
      const conflict = firstOverlap(
        schedules,
        durationMin,
        c.schedules,
        c.duration_minutes,
      );
      if (conflict) {
        out.push({
          category: 'instructor',
          message: `${row.name} ya imparte "${c.name}" ${rangeLabel(conflict, c.duration_minutes)}.`,
        });
      }
    }
  }

  const loc = (location ?? '').trim().toLowerCase();
  if (loc) {
    for (const c of allCourses) {
      if (c.id === currentCourseId) continue;
      if (c.status !== 'active') continue;
      if ((c.location ?? '').trim().toLowerCase() !== loc) continue;
      const conflict = firstOverlap(
        schedules,
        durationMin,
        c.schedules,
        c.duration_minutes,
      );
      if (conflict) {
        out.push({
          category: 'location',
          message: `La ubicación "${location?.trim()}" ya tiene clase "${c.name}" ${rangeLabel(conflict, c.duration_minutes)}.`,
        });
      }
    }
  }

  return out;
}

interface StudentConflictsInput {
  studentName: string;
  newCourseSchedules: ScheduleCreate[];
  newCourseDuration: number;
  newCourseId: number;
  studentActiveEnrollments: EnrollmentRead[];
  allCourses: CourseRead[];
}

export function findStudentConflicts(
  input: StudentConflictsInput,
): Conflict[] {
  const {
    studentName,
    newCourseSchedules,
    newCourseDuration,
    newCourseId,
    studentActiveEnrollments,
    allCourses,
  } = input;

  const out: Conflict[] = [];
  for (const enr of studentActiveEnrollments) {
    if (enr.course.id === newCourseId) continue;
    const c = allCourses.find((x) => x.id === enr.course.id);
    if (!c) continue;
    if (c.status !== 'active') continue;
    const conflict = firstOverlap(
      newCourseSchedules,
      newCourseDuration,
      c.schedules,
      c.duration_minutes,
    );
    if (conflict) {
      out.push({
        category: 'student',
        message: `${studentName} ya está inscrito en "${c.name}" ${rangeLabel(conflict, c.duration_minutes)}.`,
      });
    }
  }
  return out;
}
