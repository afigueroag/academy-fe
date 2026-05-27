import type { AttendanceRole, AttendanceStatus } from '../types';

const STATUS: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  excused: 'Justificado',
};

const ROLE: Record<AttendanceRole, string> = {
  student: 'Estudiante',
  instructor: 'Instructor',
  assistant: 'Asistente',
};

export function labelAttendanceStatus(v: AttendanceStatus): string {
  return STATUS[v];
}

export function labelAttendanceRole(v: AttendanceRole): string {
  return ROLE[v];
}
