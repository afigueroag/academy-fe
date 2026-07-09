import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserMe } from './types';
import { applyTheme, resetTheme } from './theme';
import { clearToken, getMe, getToken, setSessionExpiredHandler } from './api';

interface AuthContextValue {
  me: UserMe | null;
  loading: boolean;
  setMe: (user: UserMe) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [me, setMeState] = useState<UserMe | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!getToken());

  const setMe = useCallback((user: UserMe) => {
    setMeState(user);
    applyTheme({
      primary_color: user.academy.primary_color,
      secondary_color: user.academy.secondary_color,
      accent_color: user.academy.accent_color,
    });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setMeState(null);
    resetTheme();
  }, []);

  // Sesión expirada (401 en cualquier llamada autenticada): api.ts ya limpió el
  // token; aquí limpiamos el estado de React y navegamos a /login. Las guardas
  // de ruta (RoleRoute/DefaultRedirect) hacen el resto sin recargar la página.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setMeState(null);
      resetTheme();
      navigate('/login', { replace: true });
    });
    return () => setSessionExpiredHandler(null);
  }, [navigate]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const user = await getMe();
        if (!cancelled) setMe(user);
      } catch {
        if (!cancelled) {
          clearToken();
          setMeState(null);
          resetTheme();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setMe]);

  const value = useMemo(
    () => ({ me, loading, setMe, logout }),
    [me, loading, setMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
