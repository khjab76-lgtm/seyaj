import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!url || !serviceKey || !anonKey || !openAiKey) return reply({ error: 'AI server integration is not configured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply({ error: 'Authentication required' }, 401);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData } = await userClient.auth.getUser(token);
  if (!userData.user) return reply({ error: 'Invalid session' }, 401);

  const adminClient = createClient(url, serviceKey);
  const { data: profile } = await adminClient.from('seyaj_user_profiles').select('role_code,active').eq('id', userData.user.id).maybeSingle();
  if (!profile?.active || !['admin','manager','system_admin'].includes(profile.role_code)) return reply({ error: 'ليس لديك صلاحية استخدام مدير الذكاء الاصطناعي' }, 403);

  const body = await req.json();
  const agent = String(body.agent || 'general_manager');
  const action = String(body.action || 'analyze');
  const context = body.context ?? {};
  const prompt = String(body.prompt || 'حلل البيانات التالية وحدد الإجراء الأنسب مع مبررات مختصرة.');

  const { data: task, error: taskError } = await adminClient.from('ai_tasks').insert({ agent, action, entity_type: body.entity_type ?? null, entity_id: body.entity_id ?? null, status: 'running', requires_approval: body.requires_approval ?? true, payload: { prompt, context } }).select().single();
  if (taskError) return reply({ error: taskError.message }, 500);

  try {
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4.1-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.2, response_format: { type: 'json_object' }, messages: [
        { role: 'system', content: 'أنت AI Manager لنظام سياج. التزم بسياسات الشركة ولا تنفذ إجراءً حساساً بنفسك. أعد JSON يحتوي على summary وrecommendation وrisk وnext_steps وrequires_approval.' },
        { role: 'user', content: `${prompt}\n\nAgent: ${agent}\nAction: ${action}\nContext:\n${JSON.stringify(context)}` },
      ] }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.error?.message || 'فشل استدعاء نموذج الذكاء الاصطناعي');
    let parsed: unknown = result?.choices?.[0]?.message?.content || '{}';
    try { parsed = JSON.parse(String(parsed)); } catch { /* keep raw text */ }

    await adminClient.from('ai_tasks').update({ status: 'completed', result: parsed, completed_at: new Date().toISOString() }).eq('id', task.id);
    await adminClient.from('audit_logs').insert({ actor_id: userData.user.id, actor_name: userData.user.email, action: 'تشغيل AI Manager', module: 'ai', entity_type: body.entity_type ?? null, entity_id: body.entity_id ?? null, details: `agent=${agent}; action=${action}` });
    return reply({ ok: true, task_id: task.id, result: parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI task failed';
    await adminClient.from('ai_tasks').update({ status: 'failed', error: message }).eq('id', task.id);
    return reply({ ok: false, task_id: task.id, error: message }, 502);
  }
});
