-- Virtual Call reports (per user). Apply in the Clara SQL editor.
--
-- Why this table exists: the end-of-call report was device-only, and iOS Safari
-- evicts IndexedDB after about seven days of inactivity. On the platform these
-- learners actually use, that meant a silent loss of their whole call history.
--
-- What it deliberately does NOT hold: the transcript. A learner can opt into
-- keeping the conversation on her device (Settings.callTranscriptRetention),
-- and /privacidad promises that a kept transcript stays on that device. The
-- client strips it before this row is ever built, so there is no column for it
-- here and no way for one to arrive by accident.
create table if not exists public.virtual_calls (
  profile_id text not null,
  -- The call's end timestamp, epoch ms. Together with profile_id this is the
  -- natural key: one report per finished call, so a retry cannot duplicate it.
  at bigint not null,
  scenario_id text not null,
  mode text not null,
  level text not null,
  started_at bigint not null,
  ended_at bigint not null,
  duration_ms bigint not null,
  learner_turns integer not null default 0,
  clean_turns integer not null default 0,
  met_criteria boolean not null default false,
  -- Corrections and priorities are the learning content of the report: what she
  -- said, the fixed sentence, and the one-line explanation. No free-form speech.
  corrections jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  vocabulary_used jsonb not null default '[]'::jsonb,
  -- Null unless something was actually scored against a known target (a retry).
  -- Absent means pronunciation was not measured, never that it was perfect.
  pronunciation jsonb,
  retried_count integer not null default 0,
  retried_accepted_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (profile_id, at)
);

create index if not exists virtual_calls_profile_at_idx on public.virtual_calls(profile_id, at desc);

alter table public.virtual_calls enable row level security;
drop policy if exists own_rows on public.virtual_calls;
create policy own_rows on public.virtual_calls for all to authenticated
  using (profile_id = (select auth.uid())::text)
  with check (profile_id = (select auth.uid())::text);
