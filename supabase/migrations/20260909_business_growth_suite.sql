-- Seyaj business / CRM / growth suite. Additive and idempotent.
create table if not exists public.seyaj_sales_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  lead_number text unique,
  source text,
  contact_name text,
  phone text,
  email text,
  stage text not null default 'new',
  estimated_value numeric(14,2) default 0,
  notes text,
  owner_user_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.seyaj_sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.seyaj_sales_leads(id) on delete set null,
  opportunity_number text unique,
  title text not null,
  stage text not null default 'qualification',
  probability numeric(5,2) default 0,
  expected_value numeric(14,2) default 0,
  expected_close_date date,
  owner_user_id uuid,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.seyaj_marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_number text unique,
  name text not null,
  channel text,
  objective text,
  budget numeric(14,2) default 0,
  status text not null default 'planned',
  start_date date,
  end_date date,
  leads_generated integer default 0,
  conversions integer default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.seyaj_blacklist_entries (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  employee_number text,
  person_name text not null,
  reason text not null,
  severity text not null default 'standard',
  source text,
  active boolean not null default true,
  blocked_from_reassignment boolean not null default true,
  notes text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.seyaj_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text unique not null,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  contract_type text default 'security_services',
  status text default 'draft',
  start_date date,
  end_date date,
  value numeric(14,2) default 0,
  renewal_notice_days integer default 60,
  auto_renew boolean default false,
  document_url text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_seyaj_sales_leads_client on public.seyaj_sales_leads(client_id);
create index if not exists idx_seyaj_sales_opportunities_client on public.seyaj_sales_opportunities(client_id);
create index if not exists idx_seyaj_marketing_status on public.seyaj_marketing_campaigns(status);
create index if not exists idx_seyaj_blacklist_employee on public.seyaj_blacklist_entries(employee_id);
create index if not exists idx_seyaj_contracts_client on public.seyaj_contracts(client_id);

-- Reuse the existing timestamp trigger helper when available.
drop trigger if exists trg_seyaj_sales_leads_updated on public.seyaj_sales_leads;
create trigger trg_seyaj_sales_leads_updated before update on public.seyaj_sales_leads for each row execute function public.set_updated_at();
drop trigger if exists trg_seyaj_sales_opportunities_updated on public.seyaj_sales_opportunities;
create trigger trg_seyaj_sales_opportunities_updated before update on public.seyaj_sales_opportunities for each row execute function public.set_updated_at();
drop trigger if exists trg_seyaj_marketing_updated on public.seyaj_marketing_campaigns;
create trigger trg_seyaj_marketing_updated before update on public.seyaj_marketing_campaigns for each row execute function public.set_updated_at();
drop trigger if exists trg_seyaj_blacklist_updated on public.seyaj_blacklist_entries;
create trigger trg_seyaj_blacklist_updated before update on public.seyaj_blacklist_entries for each row execute function public.set_updated_at();
drop trigger if exists trg_seyaj_contracts_updated on public.seyaj_contracts;
create trigger trg_seyaj_contracts_updated before update on public.seyaj_contracts for each row execute function public.set_updated_at();

alter table public.seyaj_sales_leads enable row level security;
alter table public.seyaj_sales_opportunities enable row level security;
alter table public.seyaj_marketing_campaigns enable row level security;
alter table public.seyaj_blacklist_entries enable row level security;
alter table public.seyaj_contracts enable row level security;

do $$ begin
  create policy seyaj_sales_leads_select on public.seyaj_sales_leads for select to authenticated using (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_sales_leads_write on public.seyaj_sales_leads for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_sales_opp_select on public.seyaj_sales_opportunities for select to authenticated using (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_sales_opp_write on public.seyaj_sales_opportunities for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_marketing_select on public.seyaj_marketing_campaigns for select to authenticated using (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_marketing_write on public.seyaj_marketing_campaigns for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_blacklist_select on public.seyaj_blacklist_entries for select to authenticated using (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_blacklist_write on public.seyaj_blacklist_entries for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_contracts_select on public.seyaj_contracts for select to authenticated using (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy seyaj_contracts_write on public.seyaj_contracts for all to authenticated using (public.is_seyaj_admin()) with check (public.is_seyaj_admin());
exception when duplicate_object then null; end $$;

-- Add the explicit employee blacklist flags used by the UI.
alter table public.employees add column if not exists blacklisted boolean default false;
alter table public.employees add column if not exists blacklist_reason text;
