import UsersModule from './UsersModule';

export default function Students() {
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
    />
  );
}
