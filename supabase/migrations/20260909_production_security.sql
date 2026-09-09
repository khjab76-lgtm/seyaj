-- Seyaj production hardening and missing shared tables.
-- Safe for the existing project: additive/idempotent changes only.
create extension if not exists pgcrypto;

alter table public.clients add column if not exists notes text;
alter table public.employees add column if not exists email varchar;
alter table public.employees add column if not exists blacklist boolean not null default false;
alter table public.employees add column if not exists blacklist_reason text;
alter table public.employees add column if not exists auth_user_id uuid;
alter table public.sites add column if not exists client_id uuid;
alter table public.sites add column if not exists required_headcount integer not null default 0;
alter table public.projects add column if not exists client_id uuid;
alter table public.projects add column if not exists start_date date;
alter table public.projects add column if not exists end_date date;
alter table public.projects add column if not exists contract_value numeric(14,2);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  contract_no text,
  title text not null,
  start_date date,
  end_date date,
  value numeric(14,2),
  status text not null default 'active',
  document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email','whatsapp')),
  subject text,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.ai_policies (
  key text primary key,
  label text not null,
  mode text not null check (mode in ('off','suggest','approve','auto')),
  description text,
  updated_at timestamptz not null default now()
);
create table if not exists public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  action text not null,
  entity_type text,
  entity_id text,
  status text not null default 'pending',
  requires_approval boolean not null default true,
  approved_by uuid,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists public.communication_log (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email','whatsapp')),
  recipient text not null,
  subject text,
  body text not null,
  entity_type text,
  entity_id text,
  status text not null default 'queued',
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  action text not null,
  module text not null,
  entity_type text,
  entity_id text,
  details text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.seyaj_user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role_code text not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contracts_end_date on public.contracts(end_date);
create index if not exists idx_ai_tasks_status on public.ai_tasks(status);
create index if not exists idx_communication_log_created on public.communication_log(created_at desc);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
create index if not exists idx_employee_auth_user on public.employees(auth_user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_contracts_updated_at on public.contracts;
create trigger trg_contracts_updated_at before update on public.contracts for each row execute function public.set_updated_at();
drop trigger if exists trg_ai_policies_updated_at on public.ai_policies;
create trigger trg_ai_policies_updated_at before update on public.ai_policies for each row execute function public.set_updated_at();
drop trigger if exists trg_user_profiles_updated_at on public.seyaj_user_profiles;
create trigger trg_user_profiles_updated_at before update on public.seyaj_user_profiles for each row execute function public.set_updated_at();

create or replace function public.is_seyaj_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.seyaj_user_profiles
    where id = auth.uid() and active = true
      and role_code in ('admin','manager','system_admin')
  );
$$;

create or replace function public.handle_seyaj_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.seyaj_user_profiles(id, full_name, role_code)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_seyaj on auth.users;
create trigger on_auth_user_created_seyaj after insert on auth.users for each row execute function public.handle_seyaj_new_user();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM (VALUES
    ('clients'),('sites'),('projects'),('employees'),('attendance'),('field_visits'),
    ('contracts'),('communication_templates'),('ai_policies'),('ai_tasks'),('communication_log'),('audit_logs'),('seyaj_user_profiles')
  ) AS t(tablename)
  LOOP
    IF to_regclass('public.' || r.tablename) IS NOT NULL THEN
      EXECUTE format('alter table public.%I enable row level security', r.tablename);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='seyaj_user_profiles' and policyname='seyaj_profile_self_select') THEN
    create policy seyaj_profile_self_select on public.seyaj_user_profiles for select to authenticated using (id=auth.uid() or public.is_seyaj_admin());
  END IF;
  IF NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='seyaj_user_profiles' and policyname='seyaj_profile_admin_write') THEN
    create policy seyaj_profile_admin_write on public.seyaj_user_profiles for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.clients') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='clients_auth_select') THEN
    create policy clients_auth_select on public.clients for select to authenticated using (true);
  END IF;
  IF to_regclass('public.clients') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='clients_admin_write') THEN
    create policy clients_admin_write on public.clients for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
  IF to_regclass('public.sites') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='sites' and policyname='sites_auth_select') THEN
    create policy sites_auth_select on public.sites for select to authenticated using (true);
  END IF;
  IF to_regclass('public.sites') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='sites' and policyname='sites_admin_write') THEN
    create policy sites_admin_write on public.sites for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
  IF to_regclass('public.projects') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='projects_auth_select') THEN
    create policy projects_auth_select on public.projects for select to authenticated using (true);
  END IF;
  IF to_regclass('public.projects') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='projects' and policyname='projects_admin_write') THEN
    create policy projects_admin_write on public.projects for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    IF NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees_auth_select') THEN
      create policy employees_auth_select on public.employees for select to authenticated using (auth_user_id=auth.uid() or public.is_seyaj_admin());
    END IF;
    IF NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='employees' and policyname='employees_admin_write') THEN
      create policy employees_admin_write on public.employees for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.attendance') IS NOT NULL THEN
    IF NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='attendance' and policyname='attendance_auth_select') THEN
      create policy attendance_auth_select on public.attendance for select to authenticated using (public.is_seyaj_admin() or employee_number in (select e.employee_number from public.employees e where e.auth_user_id=auth.uid()));
    END IF;
    IF NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='attendance' and policyname='attendance_admin_write') THEN
      create policy attendance_admin_write on public.attendance for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.field_visits') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='field_visits' and policyname='field_visits_auth_select') THEN
    create policy field_visits_auth_select on public.field_visits for select to authenticated using (true);
  END IF;
  IF to_regclass('public.field_visits') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='field_visits' and policyname='field_visits_admin_write') THEN
    create policy field_visits_admin_write on public.field_visits for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
  IF to_regclass('public.contracts') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='contracts' and policyname='contracts_auth_select') THEN
    create policy contracts_auth_select on public.contracts for select to authenticated using (true);
  END IF;
  IF to_regclass('public.contracts') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='contracts' and policyname='contracts_admin_write') THEN
    create policy contracts_admin_write on public.contracts for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.communication_templates') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='communication_templates' and policyname='templates_auth_select') THEN
    create policy templates_auth_select on public.communication_templates for select to authenticated using (true);
  END IF;
  IF to_regclass('public.communication_templates') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='communication_templates' and policyname='templates_admin_write') THEN
    create policy templates_admin_write on public.communication_templates for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
  IF to_regclass('public.ai_policies') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='ai_policies' and policyname='ai_policies_auth_select') THEN
    create policy ai_policies_auth_select on public.ai_policies for select to authenticated using (true);
  END IF;
  IF to_regclass('public.ai_policies') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='ai_policies' and policyname='ai_policies_admin_write') THEN
    create policy ai_policies_admin_write on public.ai_policies for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
  IF to_regclass('public.ai_tasks') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='ai_tasks' and policyname='ai_tasks_admin') THEN
    create policy ai_tasks_admin on public.ai_tasks for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
  IF to_regclass('public.communication_log') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='communication_log' and policyname='communication_log_admin') THEN
    create policy communication_log_admin on public.communication_log for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
  IF to_regclass('public.audit_logs') IS NOT NULL AND NOT EXISTS (select 1 from pg_policies where schemaname='public' and tablename='audit_logs' and policyname='audit_logs_admin') THEN
    create policy audit_logs_admin on public.audit_logs for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
  END IF;
END $$;

insert into public.ai_policies(key,label,mode,description) values
('email_followups','المتابعات البريدية','auto','متابعة العملاء والعروض والعقود عبر البريد.'),
('whatsapp_followups','متابعات WhatsApp','approve','إرسال رسائل WhatsApp بعد اعتماد السياسة.'),
('external_letters','الخطابات الخارجية','approve','إنشاء وإرسال الخطابات الخارجية.'),
('employee_warnings','إنذارات الموظفين','approve','تجهيز وحفظ الإنذارات قبل الإرسال.'),
('reports','التقارير الدورية','auto','إنشاء التقارير اليومية والأسبوعية والشهرية.'),
('contract_alerts','تنبيهات العقود','auto','متابعة العقود القريبة من الانتهاء.'),
('escalation','التصعيد الإداري','approve','رفع الحالات الحساسة للإدارة.')
on conflict (key) do update set label=excluded.label, mode=excluded.mode, description=excluded.description, updated_at=now();
