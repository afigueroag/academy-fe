import { Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Students from './pages/Students';
import Instructors from './pages/Instructors';
import Classes from './pages/Classes';
import Sales from './pages/Sales';
import AcademyConfig from './pages/AcademyConfig';
import Invite from './pages/Invite';
import StudentHome from './pages/StudentHome';
import StudentClasses from './pages/StudentClasses';
import StudentConfig from './pages/StudentConfig';
import InstructorHome from './pages/InstructorHome';
import InstructorClasses from './pages/InstructorClasses';
import InstructorConfig from './pages/InstructorConfig';
import { useAuth } from './auth';
import { DefaultRedirect, RoleRoute } from './routing';

const ADMIN_ROLES = ['admin', 'receptionist'] as const;

function HomeDispatcher() {
  const { me } = useAuth();
  return me?.role === 'instructor' ? <InstructorHome /> : <StudentHome />;
}

function ClassesDispatcher() {
  const { me } = useAuth();
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
        path="/classes"
        element={
          <RoleRoute allow={[...ADMIN_ROLES]}>
            <Classes />
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
          <RoleRoute allow={['student', 'instructor']}>
            <HomeDispatcher />
          </RoleRoute>
        }
      />
      <Route
        path="/clases"
        element={
          <RoleRoute allow={['student', 'instructor']}>
            <ClassesDispatcher />
          </RoleRoute>
        }
      />
      <Route
        path="/configuracion"
        element={
          <RoleRoute allow={['student', 'instructor']}>
            <ConfigDispatcher />
          </RoleRoute>
        }
      />

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
