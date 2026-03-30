create table if not exists public.plans (
  id text primary key,
  name text not null,
  active boolean not null default true,
  rpm integer not null,
  max_sessions integer not null,
  max_browser_agents integer not null,
  session_max_duration_ms bigint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create or replace function public.set_plans_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_plans_updated_at on public.plans;

create trigger set_plans_updated_at
before update on public.plans
for each row
execute function public.set_plans_updated_at();

insert into public.plans (
  id,
  name,
  active,
  rpm,
  max_sessions,
  max_browser_agents,
  session_max_duration_ms,
  metadata
)
values
  ('guest', 'Guest', true, 5, 1, 1, 1800000, '{}'::jsonb),
  ('free', 'Free', true, 20, 3, 1, 7200000, '{}'::jsonb),
  ('pro', 'Pro', true, 60, 10, 3, 28800000, '{}'::jsonb),
  ('enterprise', 'Enterprise', true, 300, 100, 20, 86400000, '{"prioritySupport": true, "managedOnboarding": true}'::jsonb)
on conflict (id) do update
set
  name = excluded.name,
  active = excluded.active,
  rpm = excluded.rpm,
  max_sessions = excluded.max_sessions,
  max_browser_agents = excluded.max_browser_agents,
  session_max_duration_ms = excluded.session_max_duration_ms,
  metadata = excluded.metadata,
  updated_at = now();

update public.users u
set plan_id = 'free'
where u.plan_id is null
   or not exists (
     select 1
     from public.plans p
     where p.id = u.plan_id
   );

alter table public.users
drop constraint if exists users_plan_id_fkey;

alter table public.users
add constraint users_plan_id_fkey
foreign key (plan_id) references public.plans(id);
