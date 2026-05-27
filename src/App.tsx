import { Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Students from './pages/Students';
import Instructors from './pages/Instructors';
import Classes from './pages/Classes';
import Sales from './pages/Sales';
import Invite from './pages/Invite';
import StudentHome from './pages/StudentHome';
import StudentClasses from './pages/StudentClasses';
import StudentConfig from './pages/StudentConfig';
import { DefaultRedirect, RoleRoute } from './routing';

const ADMIN_ROLES = ['admin', 'receptionist', 'instructor'] as const;

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
        path="/inicio"
        element={
          <RoleRoute allow={['student']}>
            <StudentHome />
          </RoleRoute>
        }
      />
      <Route
        path="/clases"
        element={
          <RoleRoute allow={['student']}>
            <StudentClasses />
          </RoleRoute>
        }
      />
      <Route
        path="/configuracion"
        element={
          <RoleRoute allow={['student']}>
            <StudentConfig />
          </RoleRoute>
        }
      />

      <Route path="*" element={<DefaultRedirect />} />
    </Routes>
  );
}
