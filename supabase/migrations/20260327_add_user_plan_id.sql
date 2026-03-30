alter table public.users
add column if not exists plan_id text not null default 'free';

update public.users
set plan_id = 'free'
where plan_id is null;
