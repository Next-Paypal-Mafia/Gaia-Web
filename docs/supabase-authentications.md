# Supabase credentials (`public.users`)

The app stores an array of credential objects in `public.users.credentials` as **JSON** (use a single `jsonb` column whose value is a JSON array, e.g. `[{ "id": "...", "name": "...", ... }]`).

If your column is typed as `jsonb[]` (Postgres array of jsonb) instead of `jsonb`, adjust the schema or the client payload to match PostgREST expectations.

## Row creation

The client **upserts** `{ id: auth.uid(), credentials: [...] }`. The row is created on first save if it does not exist.

Optional: create the row when a user signs up:

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, credentials)
  values (new.id, '[]'::jsonb);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## Row Level Security

Enable RLS and allow users to manage only their own row:

```sql
alter table public.users enable row level security;

create policy "Users read own row"
  on public.users for select
  using (auth.uid() = id);

create policy "Users insert own row"
  on public.users for insert
  with check (auth.uid() = id);

create policy "Users update own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

Adjust policy names if they already exist in your project.

## JSON shape per item

Each element in the `credentials` array matches `SavedCredential` in `app/composables/useAuthentications.ts`:

| Field       | Type   | Description        |
|------------|--------|--------------------|
| `id`       | string | Stable client id   |
| `name`     | string | Tile label         |
| `url`      | string | Login / app URL    |
| `username` | string |                    |
| `password` | string | Stored as plain JSON; consider app-level encryption or Supabase Vault for production |
