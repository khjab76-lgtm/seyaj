-- Seyaj production foundation schema
create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  status text not null default 'lead',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text unique,
  full_name text not null,
  national_id text,
  phone text,
  email text,
  job_title text,
  status text not null default 'active',
  hire_date date,
  termination_date date,
  site_id uuid,
  blacklist boolean not null default false,
  blacklist_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  address text,
  latitude numeric,
  longitude numeric,
  required_headcount integer not null default 0,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees drop constraint if exists employees_site_id_fkey;
alter table public.employees add constraint employees_site_id_fkey foreign key (site_id) references public.sites(id) on delete set null;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'active',
  start_date date,
  end_date date,
  contract_value numeric(14,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists public.field_visits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  visitor_name text,
  visit_date timestamptz not null default now(),
  purpose text,
  findings text,
  actions text,
  status text not null default 'draft',
  report_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  attendance_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present',
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  unique(employee_id, attendance_date)
);

create table if not exists public.leaves (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending',
  reason text,
  attachment_path text,
  approved_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.violations (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  violation_type text not null,
  description text,
  amount numeric(12,2) default 0,
  status text not null default 'draft',
  incident_date date not null default current_date,
  evidence_path text,
  created_at timestamptz not null default now()
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

create index if not exists idx_employees_site on public.employees(site_id);
create index if not exists idx_contracts_end_date on public.contracts(end_date);
create index if not exists idx_visits_date on public.field_visits(visit_date);
create index if not exists idx_attendance_date on public.attendance(attendance_date);
create index if not exists idx_ai_tasks_status on public.ai_tasks(status);
create index if not exists idx_audit_created_at on public.audit_logs(created_at desc);

-- Development-safe initial policies. Tighten these with Supabase Auth/RLS roles before production data entry.
alter table public.clients enable row level security;
alter table public.employees enable row level security;
alter table public.sites enable row level security;
alter table public.projects enable row level security;
alter table public.contracts enable row level security;
alter table public.field_visits enable row level security;
alter table public.attendance enable row level security;
alter table public.leaves enable row level security;
alter table public.violations enable row level security;
alter table public.communication_templates enable row level security;
alter table public.ai_policies enable row level security;
alter table public.ai_tasks enable row level security;
alter table public.communication_log enable row level security;
alter table public.audit_logs enable row level security;

-- No anonymous write policies are created here. Authentication and role policies must be configured before enabling production writes.
