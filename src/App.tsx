import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Students from './pages/Students';
import Instructors from './pages/Instructors';
import Classes from './pages/Classes';
import Invite from './pages/Invite';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/students" replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/invite" element={<Invite />} />
      <Route path="/students" element={<Students />} />
      <Route path="/instructors" element={<Instructors />} />
      <Route path="/classes" element={<Classes />} />
      <Route path="*" element={<Navigate to="/students" replace />} />
    </Routes>
  );
}
