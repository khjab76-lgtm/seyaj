-- Seyaj production hardening and missing shared tables.
-- Safe to run after the existing project schema; all DDL is idempotent.
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
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_contracts_updated_at on public.contracts;
create trigger trg_contracts_updated_at before update on public.contracts for each row execute function public.set_updated_at();
drop trigger if exists trg_ai_policies_updated_at on public.ai_policies;
create trigger trg_ai_policies_updated_at before update on public.ai_policies for each row execute function public.set_updated_at();
drop trigger if exists trg_user_profiles_updated_at on public.seyaj_user_profiles;
create trigger trg_user_profiles_updated_at before update on public.seyaj_user_profiles for each row execute function public.set_updated_at();

create or replace function public.is_seyaj_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.seyaj_user_profiles p
    where p.id = auth.uid()
      and p.active = true
      and p.role_code in ('admin','manager','system_admin')
  );
$$;

alter table public.seyaj_user_profiles enable row level security;
create policy if not exists seyaj_profile_self_select on public.seyaj_user_profiles
for select to authenticated using (id = auth.uid() or public.is_seyaj_admin());
create policy if not exists seyaj_profile_admin_write on public.seyaj_user_profiles
for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

-- Core application access: authenticated users may read; privileged roles may mutate.
-- More granular branch/project scoping is handled by the existing Seyaj scope tables.

alter table public.clients enable row level security;
alter table public.sites enable row level security;
alter table public.projects enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.field_visits enable row level security;
alter table public.contracts enable row level security;
alter table public.violations enable row level security;
alter table public.leaves enable row level security;
alter table public.communication_templates enable row level security;
alter table public.ai_policies enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.communication_log enable row level security;
alter table public.audit_logs enable row level security;

create policy if not exists clients_auth_select on public.clients for select to authenticated using (true);
create policy if not exists clients_admin_write on public.clients for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists sites_auth_select on public.sites for select to authenticated using (true);
create policy if not exists sites_admin_write on public.sites for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists projects_auth_select on public.projects for select to authenticated using (true);
create policy if not exists projects_admin_write on public.projects for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists employees_auth_select on public.employees for select to authenticated using (auth_user_id = auth.uid() or public.is_seyaj_admin());
create policy if not exists employees_admin_write on public.employees for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists attendance_auth_select on public.attendance for select to authenticated using (public.is_seyaj_admin() or employee_number in (select e.employee_number from public.employees e where e.auth_user_id = auth.uid()));
create policy if not exists attendance_admin_write on public.attendance for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists visits_auth_select on public.field_visits for select to authenticated using (true);
create policy if not exists visits_admin_write on public.field_visits for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists contracts_auth_select on public.contracts for select to authenticated using (true);
create policy if not exists contracts_admin_write on public.contracts for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists violations_auth_select on public.violations for select to authenticated using (public.is_seyaj_admin() or employee_id in (select e.id from public.employees e where e.auth_user_id = auth.uid()));
create policy if not exists violations_admin_write on public.violations for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists leaves_auth_select on public.leaves for select to authenticated using (public.is_seyaj_admin() or employee_id in (select e.id from public.employees e where e.auth_user_id = auth.uid()));
create policy if not exists leaves_admin_write on public.leaves for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists templates_auth_select on public.communication_templates for select to authenticated using (true);
create policy if not exists templates_admin_write on public.communication_templates for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists ai_policies_auth_select on public.ai_policies for select to authenticated using (true);
create policy if not exists ai_policies_admin_write on public.ai_policies for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists ai_tasks_auth_select on public.ai_tasks for select to authenticated using (public.is_seyaj_admin());
create policy if not exists ai_tasks_admin_write on public.ai_tasks for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists comm_log_auth_select on public.communication_log for select to authenticated using (public.is_seyaj_admin());
create policy if not exists comm_log_admin_write on public.communication_log for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

create policy if not exists audit_auth_select on public.audit_logs for select to authenticated using (public.is_seyaj_admin());
create policy if not exists audit_admin_write on public.audit_logs for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());

insert into public.ai_policies(key,label,mode,description)
values
('email_followups','المتابعات البريدية','auto','متابعة العملاء والعروض والعقود عبر البريد.'),
('whatsapp_followups','متابعات WhatsApp','approve','إرسال رسائل WhatsApp بعد اعتماد السياسة.'),
('external_letters','الخطابات الخارجية','approve','إنشاء وإرسال الخطابات الخارجية.'),
('employee_warnings','إنذارات الموظفين','approve','تجهيز وحفظ الإنذارات قبل الإرسال.'),
('reports','التقارير الدورية','auto','إنشاء التقارير اليومية والأسبوعية والشهرية.'),
('contract_alerts','تنبيهات العقود','auto','متابعة العقود القريبة من الانتهاء.'),
('escalation','التصعيد الإداري','approve','رفع الحالات الحساسة للإدارة.')
on conflict (key) do update set label=excluded.label, description=excluded.description;
