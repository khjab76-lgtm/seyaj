const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function assertConfigured() {
  if (!supabaseConfigured) {
    throw new Error('Supabase غير مهيأ: أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY إلى بيئة التشغيل.');
  }
}

export async function dbSelect<T = any>(table: string, query = 'select=*'): Promise<T[]> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY!}` },
  });
  if (!response.ok) throw new Error(`Supabase SELECT ${table}: ${response.status}`);
  return response.json();
}

export async function dbInsert<T = any>(table: string, payload: Record<string, unknown> | Record<string, unknown>[]): Promise<T[]> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Supabase INSERT ${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function dbUpdate<T = any>(table: string, filter: string, payload: Record<string, unknown>): Promise<T[]> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${SUPABASE_ANON_KEY!}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Supabase UPDATE ${table}: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function dbDelete(table: string, filter: string): Promise<void> {
  assertConfigured();
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { apikey: SUPABASE_ANON_KEY!, Authorization: `Bearer ${SUPABASE_ANON_KEY!}` },
  });
  if (!response.ok) throw new Error(`Supabase DELETE ${table}: ${response.status} ${await response.text()}`);
}

export function getSupabaseUrl() { return SUPABASE_URL || ''; }
