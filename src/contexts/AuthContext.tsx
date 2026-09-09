import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../lib/auth';
import { getCurrentSupabaseUser, getSupabaseProfile, isSupabaseAuthEnabled, signInWithPassword, signOutSupabase } from '@/lib/supabaseAuth';

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

async function buildSupabaseUser(su: { id: string; email: string; user_metadata?: Record<string, unknown> }): Promise<User> {
  const profile = await getSupabaseProfile(su.id);
  return {
    id: su.id,
    email: su.email,
    name: String(profile?.full_name || su.user_metadata?.full_name || ''),
    role: String(profile?.role_code || 'viewer'),
  };
}

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
        setUser(await buildSupabaseUser(su));
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
      if (!result.user?.id || !result.user.email) throw new Error('تعذر قراءة بيانات المستخدم بعد تسجيل الدخول');
      setUser(await buildSupabaseUser(result.user as { id: string; email: string; user_metadata?: Record<string, unknown> }));
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
