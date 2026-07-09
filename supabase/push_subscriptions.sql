-- Push notification subscriptions (one row per device/browser).
-- Run once in the Supabase SQL editor (clara project). Same permissive-RLS
-- posture as the rest of the no-auth v1 schema.

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
