import { Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Students from './pages/Students';
import Instructors from './pages/Instructors';
import Classes from './pages/Classes';
import Groups from './pages/Groups';
import Sales from './pages/Sales';
import Announcements from './pages/Announcements';
import StudentAnnouncements from './pages/StudentAnnouncements';
import Gastos from './pages/Gastos';
import Dashboard from './pages/Dashboard';
import AcademyConfig from './pages/AcademyConfig';
import Invite from './pages/Invite';
import StudentHome from './pages/StudentHome';
import StudentClasses from './pages/StudentClasses';
import StudentConfig from './pages/StudentConfig';
import InstructorHome from './pages/InstructorHome';
import InstructorClasses from './pages/InstructorClasses';
import InstructorConfig from './pages/InstructorConfig';
import HybridHome from './pages/HybridHome';
import HybridClasses from './pages/HybridClasses';
import { useAuth } from './auth';
import { DefaultRedirect, RoleRoute } from './routing';

const ADMIN_ROLES = ['admin', 'receptionist'] as const;
// Roles con el shell de autoservicio (Inicio / Clases / Configuración).
const SELF_SERVICE_ROLES = [
  'student',
  'instructor',
  'instructor_student',
] as const;

function HomeDispatcher() {
  const { me } = useAuth();
  if (me?.role === 'instructor_student') return <HybridHome />;
  return me?.role === 'instructor' ? <InstructorHome /> : <StudentHome />;
}

function ClassesDispatcher() {
  const { me } = useAuth();
  if (me?.role === 'instructor_student') return <HybridClasses />;
  return me?.role === 'instructor' ? <InstructorClasses /> : <StudentClasses />;
}

function ConfigDispatcher() {
  const { me } = useAuth();
  return me?.role === 'instructor' ? <InstructorConfig /> : <StudentConfig />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DefaultRedirect />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/invite" element={<Invite />} />

      <Route
        path="/students"
        element={
          <RoleRoute allow={[...ADMIN_ROLES]}>
            <Students />
          </RoleRoute>
        }
      />
      <Route
        path="/instructors"
        element={
          <RoleRoute allow={[...ADMIN_ROLES]}>
            <Instructors />
          </RoleRoute>
        }
      />
      <Route
        path="/ventas"
        element={
          <RoleRoute allow={['admin', 'receptionist']}>
            <Sales />
          </RoleRoute>
        }
      />
      <Route
        path="/gastos"
        element={
          <RoleRoute allow={['admin', 'receptionist']}>
            <Gastos />
          </RoleRoute>
        }
      />
      <Route
        path="/comunicados"
        element={
          <RoleRoute allow={['admin', 'receptionist']}>
            <Announcements />
          </RoleRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RoleRoute allow={['admin']}>
            <Dashboard />
          </RoleRoute>
        }
      />
      <Route
        path="/classes"
        element={
          <RoleRoute allow={[...ADMIN_ROLES]}>
            <Classes />
          </RoleRoute>
        }
      />
      <Route
        path="/groups"
        element={
          <RoleRoute allow={[...ADMIN_ROLES]}>
            <Groups />
          </RoleRoute>
        }
      />
      <Route
        path="/ajustes"
        element={
          <RoleRoute allow={['admin']}>
            <AcademyConfig />
          </RoleRoute>
        }
      />

      <Route
        path="/inicio"
        element={
          <RoleRoute allow={[...SELF_SERVICE_ROLES]}>
            <HomeDispatcher />
          </RoleRoute>
        }
      />
      <Route
        path="/clases"
        element={
          <RoleRoute allow={[...SELF_SERVICE_ROLES]}>
            <ClassesDispatcher />
          </RoleRoute>
        }
      />
      <Route
        path="/configuracion"
        element={
          <RoleRoute allow={[...SELF_SERVICE_ROLES]}>
            <ConfigDispatcher />
          </RoleRoute>
        }
      />
      <Route
        path="/mis-comunicados"
        element={
          <RoleRoute allow={[...SELF_SERVICE_ROLES]}>
            <StudentAnnouncements />
          </RoleRoute>
        }
      />

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
