# نشر وربط سياج بالإنتاج

## 1) متغيرات الواجهة
ضع في منصة الاستضافة:
- `VITE_SUPABASE_URL=https://umvzzzivlpucsdiwubaw.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>`
- `VITE_AUTH_MODE=supabase` عند اعتماد تسجيل دخول Supabase
- `VITE_REQUIRE_AUTH=true` عند إغلاق وضع العرض التجريبي وفرض تسجيل الدخول

لا تضع `service_role` أو أي Secret في واجهة React أو GitHub.

## 2) قاعدة البيانات
نفّذ `supabase/migrations/20260909_production_security.sql` بعد التأكد من الجداول الموجودة. لا تحذف الجداول القديمة؛ الملف يضيف الأعمدة والجداول المشتركة الناقصة بشكل idempotent.

## 3) إنشاء أول مدير
بعد إنشاء مستخدم من Supabase Authentication، نفّذ:

```sql
insert into public.seyaj_user_profiles(id, full_name, role_code)
values ('AUTH_USER_UUID', 'مدير النظام', 'admin')
on conflict (id) do update set role_code='admin', full_name='مدير النظام', active=true;
```

واربط حساب المستخدم بصف الموظف نفسه عند الحاجة:

```sql
update public.employees
set auth_user_id = 'AUTH_USER_UUID'
where employee_number = 'EMP-1001';
```

## 4) Edge Functions
الدوال تحت `supabase/functions`:
- `seyaj-ai`: مدير الذكاء الاصطناعي وتسجيل مهام AI.
- `seyaj-communications`: إرسال البريد وWhatsApp وتسجيل العملية.

الأسرار في Supabase Edge Functions:
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION`

بعد ضبط الأسرار، انشر الدوال من Supabase CLI.

## 5) ربط الواجهة
طبقة `src/lib/supabaseClient.ts` تمنع حفظ المفاتيح السرية داخل الكود وتستخدم مفتاح العميل العام فقط. و`src/lib/seyajCloud.ts` توفر طبقة CRUD بسيطة لـSupabase.
