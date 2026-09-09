import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'Server integration is not configured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Authentication required' }, 401);
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData } = await userClient.auth.getUser(token);
  if (!userData.user) return json({ error: 'Invalid session' }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await adminClient.from('seyaj_user_profiles').select('role_code,active').eq('id', userData.user.id).maybeSingle();
  if (!profile?.active || !['admin', 'manager', 'system_admin'].includes(profile.role_code)) {
    return json({ error: 'ليس لديك صلاحية تنفيذ الإرسال' }, 403);
  }

  const body = await req.json();
  const channel = body.channel as 'email' | 'whatsapp';
  const recipient = String(body.recipient || '');
  const subject = body.subject ? String(body.subject) : null;
  const messageBody = String(body.body || '');
  const entityType = body.entity_type ? String(body.entity_type) : null;
  const entityId = body.entity_id ? String(body.entity_id) : null;
  if (!['email', 'whatsapp'].includes(channel) || !recipient || !messageBody) return json({ error: 'بيانات الإرسال ناقصة' }, 400);

  const { data: logRow, error: logError } = await adminClient.from('communication_log').insert({ channel, recipient, subject, body: messageBody, entity_type: entityType, entity_id: entityId, status: 'queued' }).select().single();
  if (logError) return json({ error: logError.message }, 500);

  try {
    let providerMessageId = '';
    if (channel === 'email') {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      const from = Deno.env.get('RESEND_FROM_EMAIL');
      if (!resendKey || !from) throw new Error('إعدادات البريد غير مكتملة');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [recipient], subject: subject || 'مراسلة من شركة سياج', text: messageBody }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || 'فشل إرسال البريد');
      providerMessageId = result?.id || '';
    } else {
      const waToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
      const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
      const graphVersion = Deno.env.get('WHATSAPP_GRAPH_VERSION') || 'v23.0';
      if (!waToken || !phoneId) throw new Error('إعدادات WhatsApp غير مكتملة');
      const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient.replace(/\D/g, ''), type: 'text', text: { body: messageBody } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message || 'فشل إرسال WhatsApp');
      providerMessageId = result?.messages?.[0]?.id || '';
    }

    await adminClient.from('communication_log').update({ status: 'sent', provider_message_id: providerMessageId, sent_at: new Date().toISOString() }).eq('id', logRow.id);
    await adminClient.from('audit_logs').insert({ actor_id: userData.user.id, actor_name: userData.user.email, action: `إرسال ${channel === 'email' ? 'بريد' : 'WhatsApp'}`, module: 'communications', entity_type: entityType, entity_id: entityId, details: `تم إرسال رسالة إلى ${recipient}` });
    return json({ ok: true, id: logRow.id, provider_message_id: providerMessageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'فشل الإرسال';
    await adminClient.from('communication_log').update({ status: 'failed' }).eq('id', logRow.id);
    return json({ ok: false, error: message, id: logRow.id }, 502);
  }
});
