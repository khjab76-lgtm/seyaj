-- Assign the two existing Supabase Auth users to the approved Seyaj roles.
-- No user is created and no password or secret is stored here.

insert into public.seyaj_user_profiles (id, full_name, role_code, active)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.email),
  case
    when lower(u.email) = lower('khalid@seyaj.net') then 'admin'
    when lower(u.email) = lower('khjab76@gmail.com') then 'manager'
    else 'viewer'
  end,
  true
from auth.users u
where lower(u.email) in (lower('khalid@seyaj.net'), lower('khjab76@gmail.com'))
on conflict (id) do update
set
  full_name = excluded.full_name,
  role_code = excluded.role_code,
  active = true,
  updated_at = now();

-- Explicitly enforce the approved roles for the two accounts.
update public.seyaj_user_profiles p
set role_code = 'admin', active = true, updated_at = now()
from auth.users u
where p.id = u.id and lower(u.email) = lower('khalid@seyaj.net');

update public.seyaj_user_profiles p
set role_code = 'manager', active = true, updated_at = now()
from auth.users u
where p.id = u.id and lower(u.email) = lower('khjab76@gmail.com');
