import type { InstructorType } from '../types';

const LABEL: Record<InstructorType, string> = {
  instructor: 'Instructor',
  assistant: 'Asistente',
};

export function instructorTypeLabel(type: InstructorType): string {
  return LABEL[type];
}
