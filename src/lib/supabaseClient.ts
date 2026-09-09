const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const ACCESS_TOKEN_KEY = 'seyaj_supabase_access_token';
const REFRESH_TOKEN_KEY = 'seyaj_supabase_refresh_token';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export function getSupabaseUrl(): string { return SUPABASE_URL; }
export function getSupabaseAccessToken(): string | null {
  try { return localStorage.getItem(ACCESS_TOKEN_KEY); } catch { return null; }
}
export function setSupabaseSession(accessToken: string, refreshToken?: string) {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch { /* storage may be unavailable */ }
}
export function clearSupabaseSession() {
  try { localStorage.removeItem(ACCESS_TOKEN_KEY); localStorage.removeItem(REFRESH_TOKEN_KEY); } catch { /* ignore */ }
}

export type SupabaseRequestOptions = RequestInit & { auth?: boolean };

export async function supabaseRequest<T = unknown>(path: string, options: SupabaseRequestOptions = {}): Promise<T> {
  if (!supabaseConfigured) throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  const headers = new Headers(options.headers || {});
  headers.set('apikey', SUPABASE_ANON_KEY);
  const token = getSupabaseAccessToken();
  if (options.auth !== false && token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${SUPABASE_URL}${path.startsWith('/') ? path : `/${path}`}`, { ...options, headers });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data ? String((data as { message: unknown }).message) : `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function supabaseSelect<T = unknown>(table: string, query = '*', params = 'limit=1000'): Promise<T[]> {
  const suffix = params ? `&${params}` : '';
  return supabaseRequest<T[]>(`/rest/v1/${table}?select=${encodeURIComponent(query)}${suffix}`);
}

export async function supabaseRpc<T = unknown>(fn: string, body: Record<string, unknown> = {}): Promise<T> {
  return supabaseRequest<T>(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(body) });
}
