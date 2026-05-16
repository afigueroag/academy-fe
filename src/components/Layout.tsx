import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import {
  CalendarIcon,
  GraduationIcon,
  Logo,
  LogoutIcon,
  UsersIcon,
} from '../brand';

interface LayoutProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

export default function Layout({ title, actions, children }: LayoutProps) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <Logo size={26} />
        </div>

        <nav className="sidebar__nav" aria-label="Navegación principal">
          <NavLink
            to="/students"
            className={({ isActive }) =>
              'sidebar__link' + (isActive ? ' sidebar__link--active' : '')
            }
          >
            <GraduationIcon size={18} />
            <span>Estudiantes</span>
          </NavLink>
          <NavLink
            to="/instructors"
            className={({ isActive }) =>
              'sidebar__link' + (isActive ? ' sidebar__link--active' : '')
            }
          >
            <UsersIcon size={18} />
            <span>Instructores</span>
          </NavLink>
          <NavLink
            to="/classes"
            className={({ isActive }) =>
              'sidebar__link' + (isActive ? ' sidebar__link--active' : '')
            }
          >
            <CalendarIcon size={18} />
            <span>Clases</span>
          </NavLink>
        </nav>

        <div className="sidebar__user">
          <div className="sidebar__avatar" aria-hidden="true">
            {me ? initials(me.first_name, me.last_name) : '—'}
          </div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">
              {me ? `${me.first_name} ${me.last_name}` : 'Cargando…'}
            </div>
            <div className="sidebar__user-academy">
              {me?.academy.name ?? ''}
            </div>
          </div>
          <button
            type="button"
            className="sidebar__logout"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            <LogoutIcon size={16} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="topbar__title">{title}</h1>
          {actions && <div className="topbar__actions">{actions}</div>}
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
