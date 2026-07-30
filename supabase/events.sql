-- Analytics events (per-user). Apply in the Clara SQL editor. Matches the v2
-- RLS model: each row is owned by profile_id = auth.uid(). The client mirror in
-- lib/analytics.ts writes here best-effort with the authenticated session, and
-- silently no-ops until this table exists. `type` and the keys inside `props`
-- are bounded by the closed schema in lib/analytics-schema.ts, which validates
-- every event before either the local or the cloud write — this table never
-- receives transcripts, voice content, or free text.
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

-- Rollup indexes for the daily-learning metrics (daily active learner, session
-- completion rate, return rates, speaking participation, review completion,
-- technical failure rate). Those are all counts of one event type within one
-- learner's local days, plus the admin scan across learners for a single type.
-- Everything here is additive and rerun-safe; the ownership policy below is
-- unchanged, so a learner still only ever reads and writes her own rows.
create index if not exists events_profile_day_idx on public.events(profile_id, day);
create index if not exists events_profile_type_day_idx on public.events(profile_id, type, day);
create index if not exists events_type_at_idx on public.events(type, at desc);

alter table public.events enable row level security;
drop policy if exists own_rows on public.events;
create policy own_rows on public.events for all to authenticated
  using (profile_id = auth.uid()::text)
  with check (profile_id = auth.uid()::text);
