import { clearSupabaseSession, getSupabaseAccessToken, getSupabaseUrl, setSupabaseSession, supabaseConfigured, supabaseRequest } from './supabaseClient';

type SupabaseAuthResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id: string; email?: string; user_metadata?: Record<string, unknown> };
};

type SupabaseUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, unknown>;
};

const REFRESH_TOKEN_KEY = 'seyaj_supabase_refresh_token';

function getRefreshToken() {
  try { return localStorage.getItem(REFRESH_TOKEN_KEY); } catch { return null; }
}

export function isSupabaseAuthEnabled() {
  return supabaseConfigured && (import.meta.env.VITE_AUTH_MODE || 'legacy') === 'supabase';
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabaseConfigured) throw new Error('إعدادات Supabase غير مكتملة');
  const base = getSupabaseUrl();
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json() as SupabaseAuthResponse & { error_description?: string; msg?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.msg || 'بيانات الدخول غير صحيحة');
  setSupabaseSession(data.access_token, data.refresh_token);
  return data;
}

export async function getCurrentSupabaseUser(): Promise<SupabaseUser | null> {
  if (!supabaseConfigured) return null;
  const token = getSupabaseAccessToken();
  if (!token) return null;
  try {
    return await supabaseRequest<SupabaseUser>('/auth/v1/user');
  } catch {
    return null;
  }
}

export async function refreshSupabaseSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken || !supabaseConfigured) return null;
  const base = getSupabaseUrl();
  const response = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) { clearSupabaseSession(); return null; }
  const data = await response.json() as SupabaseAuthResponse;
  if (data.access_token) setSupabaseSession(data.access_token, data.refresh_token);
  return data;
}

export async function signOutSupabase() {
  const token = getSupabaseAccessToken();
  if (token && supabaseConfigured) {
    try {
      await fetch(`${getSupabaseUrl()}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
    } catch { /* local session is still cleared */ }
  }
  clearSupabaseSession();
}

export async function getSupabaseProfile(userId: string) {
  try {
    const rows = await supabaseRequest<any[]>(`/rest/v1/seyaj_user_profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
    return rows[0] || null;
  } catch {
    return null;
  }
}
