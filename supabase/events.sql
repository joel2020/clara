-- Analytics events (per-user). Apply in the Clara SQL editor. Matches the v2
-- RLS model: each row is owned by profile_id = auth.uid(). The client mirror in
-- lib/analytics.ts writes here best-effort with the authenticated session, and
-- silently no-ops until this table exists.
create table if not exists public.events (
  id bigserial primary key,
  profile_id text not null,
  type text not null,
  at bigint not null,
  day text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_profile_at_idx on public.events(profile_id, at desc);

alter table public.events enable row level security;
drop policy if exists own_rows on public.events;
create policy own_rows on public.events for all to authenticated
  using (profile_id = auth.uid()::text)
  with check (profile_id = auth.uid()::text);
