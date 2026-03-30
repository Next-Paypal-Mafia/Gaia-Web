-- Update browser agent limits per plan tier for authenticated users
-- guest: 1 (unchanged)
-- free: 2 (was 1)
-- pro: 5 (was 3)
-- enterprise: 20 (unchanged)

update public.plans
set max_browser_agents = case id
  when 'free' then 2
  when 'pro' then 5
  else max_browser_agents
end
where id in ('free', 'pro');
