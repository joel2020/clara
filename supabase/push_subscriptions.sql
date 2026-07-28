-- Push notification subscriptions (one row per device/browser).
--
-- ⚠️  HISTORICAL. The permissive policy below was REPLACED: the live table now
--     denies ALL client roles (`no_client_access`, USING(false)) and is written
--     only by the server push routes with the service-role key. See
--     current-schema.sql for the authoritative state. Do not replay this file.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  profile_id text,
  lang text not null default 'es',
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_all" on public.push_subscriptions;
create policy "push_subscriptions_all"
  on public.push_subscriptions for all
  to anon, authenticated
  using (true)
  with check (true);
