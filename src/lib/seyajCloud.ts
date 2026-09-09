import { supabaseConfigured, supabaseRequest } from './supabaseClient';

export type CloudRow = Record<string, unknown>;

export async function cloudSelect(table: string, query = '*', params = 'limit=1000') {
  if (!supabaseConfigured) return [] as CloudRow[];
  return supabaseRequest<CloudRow[]>(`/rest/v1/${table}?select=${encodeURIComponent(query)}${params ? `&${params}` : ''}`);
}

export async function cloudInsert(table: string, rows: CloudRow | CloudRow[]) {
  return supabaseRequest<CloudRow[]>(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  });
}

export async function cloudUpdate(table: string, filter: string, row: CloudRow) {
  return supabaseRequest<CloudRow[]>(`/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
}

export async function cloudDelete(table: string, filter: string) {
  await supabaseRequest(` /rest/v1/${table}?${filter}`.trim(), { method: 'DELETE' });
}

export async function cloudHealth() {
  if (!supabaseConfigured) return { ok: false, configured: false, message: 'Supabase غير مهيأ' };
  try {
    await cloudSelect('app_settings', 'id', 'limit=1');
    return { ok: true, configured: true, message: 'اتصال Supabase متاح' };
  } catch (error) {
    return { ok: false, configured: true, message: error instanceof Error ? error.message : 'تعذر الاتصال' };
  }
}

export async function getAiPolicies() {
  return cloudSelect('ai_policies', 'key,label,mode,description,updated_at', 'order=key.asc');
}
