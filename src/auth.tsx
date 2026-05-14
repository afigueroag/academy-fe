import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { UserMe } from './types';
import { applyTheme, resetTheme } from './theme';
import { clearToken } from './api';

interface AuthContextValue {
  me: UserMe | null;
  setMe: (user: UserMe) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMeState] = useState<UserMe | null>(null);

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

  const value = useMemo(() => ({ me, setMe, logout }), [me, setMe, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
