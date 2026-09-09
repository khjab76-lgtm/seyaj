import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../lib/auth';
import { getCurrentSupabaseUser, isSupabaseAuthEnabled, signInWithPassword, signOutSupabase } from '@/lib/supabaseAuth';

type User = { id: string; email: string; name?: string; role: string; last_login?: string };
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  isAdmin: boolean;
  supabaseMode: boolean;
}
const AuthContext = createContext<AuthContextType | null>(null);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const supabaseMode = isSupabaseAuthEnabled();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuthStatus = async () => {
    setLoading(true); setError(null);
    try {
      if (supabaseMode) {
        const su = await getCurrentSupabaseUser();
        if (!su) { setUser(null); return; }
        const role = String(su.user_metadata?.role || 'viewer');
        setUser({ id: su.id, email: su.email, name: String(su.user_metadata?.full_name || ''), role });
      } else {
        setUser(await authApi.getCurrentUser());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحقق من الجلسة');
      setUser(null);
    } finally { setLoading(false); }
  };

  const login = async () => {
    setError(null);
    try { await authApi.login(); } catch (err) { setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول'); }
  };

  const loginWithPassword = async (email: string, password: string) => {
    setError(null);
    try {
      const result = await signInWithPassword(email, password);
      const meta = result.user?.user_metadata || {};
      setUser({ id: result.user?.id || '', email: result.user?.email || email, name: String(meta.full_name || ''), role: String(meta.role || 'viewer') });
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول'); throw err; }
  };

  const logout = async () => {
    setError(null);
    try {
      if (supabaseMode) await signOutSupabase(); else await authApi.logout();
    } catch (err) { setError(err instanceof Error ? err.message : 'فشل تسجيل الخروج'); }
    finally { setUser(null); }
  };

  useEffect(() => { void checkAuthStatus(); }, [supabaseMode]);

  return <AuthContext.Provider value={{ user, loading, error, login, loginWithPassword, logout, refetch: checkAuthStatus, isAdmin: user?.role === 'admin' || user?.role === 'manager' || user?.role === 'system_admin', supabaseMode }}>{children}</AuthContext.Provider>;
};
