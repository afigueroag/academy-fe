import { useState } from 'react';
import UsersModule from './UsersModule';
import type { Debt } from '../types';

export default function Students() {
  const [debtFilter, setDebtFilter] = useState<Debt | null>(null);
  const [enrollmentMonthFilter, setEnrollmentMonthFilter] = useState<
    number | null
  >(null);
  const [courseFilter, setCourseFilter] = useState<number | null>(null);

  return (
    <UsersModule
      role="student"
      pageTitle="Estudiantes"
      summaryLabel="Estudiantes activos"
      inviteButtonLabel="Invitar Estudiante"
      createButtonLabel="Crear Estudiante"
      inviteTitle="Invitar Estudiante"
      createTitle="Crear Estudiante"
      editTitle="Editar Estudiante"
      viewTitle="Detalles del Estudiante"
      showDebtColumns
      searchPlaceholder="Buscar por nombre, correo o expediente"
      courseFilter={courseFilter}
      onCourseFilterChange={setCourseFilter}
      debtFilter={debtFilter}
      onDebtFilterChange={setDebtFilter}
      enrollmentMonthFilter={enrollmentMonthFilter}
      onEnrollmentMonthFilterChange={setEnrollmentMonthFilter}
    />
  );
}
