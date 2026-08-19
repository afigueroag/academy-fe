import UsersModule from './UsersModule';

export default function Instructors() {
  return (
    <UsersModule
      role="instructor"
      pageTitle="Instructores"
      summaryLabel="Instructores activos"
      inviteButtonLabel="Invitar Instructor"
      createButtonLabel="Crear Instructor"
      inviteTitle="Invitar Instructor"
      createTitle="Crear Instructor"
      editTitle="Editar Instructor"
      viewTitle="Detalles del Instructor"
    />
  );
}
