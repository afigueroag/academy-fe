import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import { useAuth } from './auth';
import { getToken } from './api';
import { Logo } from './brand';

function StudentsPlaceholder() {
  const { me, logout } = useAuth();
  const token = getToken();

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="placeholder">
      <div style={{ textAlign: 'center' }}>
        <Logo size={36} />
        <h2 style={{ marginTop: 24, fontSize: 28 }}>
          {me ? `Hola, ${me.first_name}` : 'Cargando…'}
        </h2>
        {me && (
          <p style={{ marginTop: 8 }}>
            {me.academy.name} ·{' '}
            <span style={{ textTransform: 'capitalize' }}>
              {me.academy.plan}
            </span>
          </p>
        )}
        <p style={{ marginTop: 24, fontFamily: 'var(--font-body)' }}>
          Módulo de alumnos (placeholder).
        </p>
        <button
          type="button"
          className="btn btn--ghost"
          style={{ marginTop: 24 }}
          onClick={logout}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/students" element={<StudentsPlaceholder />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
