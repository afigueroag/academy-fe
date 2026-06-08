import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './auth';
import type { UserRole } from './types';

export function homePathForRole(role: UserRole | undefined | null): string {
  if (role === 'student' || role === 'instructor') return '/inicio';
  return '/students';
}

export function DefaultRedirect() {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForRole(me.role)} replace />;
}

interface RoleRouteProps {
  allow: UserRole[];
  children: ReactNode;
}

export function RoleRoute({ allow, children }: RoleRouteProps) {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me) return <Navigate to="/login" replace />;
  if (!allow.includes(me.role)) {
    return <Navigate to={homePathForRole(me.role)} replace />;
  }
  return <>{children}</>;
}
