-- Only the service-role function and the project owner may change identities.
create table public.workbench_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  employee_id text not null unique check (employee_id ~ '^[a-z0-9][a-z0-9_.-]{0,39}$'),
  role text not null default 'staff' check (role in ('admin', 'staff')),
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.workbench_profiles enable row level security;
revoke all on public.workbench_profiles from anon, authenticated;
grant select on public.workbench_profiles to authenticated;
grant all on public.workbench_profiles to service_role;
create policy own_active_identity on public.workbench_profiles
  for select to authenticated using (id = (select auth.uid()) and active);

comment on table public.workbench_profiles is
  'Administrator-issued workbench identities; clients cannot register or change names, employee IDs or privileges.';
