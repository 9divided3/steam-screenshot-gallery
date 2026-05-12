import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { auth as authApi } from '../api/client';

interface User {
  id: number;
  username: string;
  display_name?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authApi.me()
        .then((data) => setUser(data.user))
        .catch(() => { localStorage.removeItem('token'); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // authApi is a stable module import, no need to list as dep
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await authApi.login(username, password);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const data = await authApi.register(username, password);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
