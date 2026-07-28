-- Clara — CURRENT live schema (project nwjtvlvzbfrlzgxiqzgd), transcribed from the
-- running database on 2026-07-27. This is the authoritative rebuild path: running
-- this whole file on an empty project reproduces production, RLS and all.
--
-- Why this exists: the older files in this directory (schema.sql,
-- migration-v2-multiuser.sql, events.sql, push_subscriptions.sql,
-- player_stats_economy.sql, migration-v3-custom-lessons-admin.sql) are the
-- HISTORICAL migration steps, applied in order over time. Several tables added
-- later (exam_attempts, call_scores, talk_sessions, conv_items, quests) and the
-- columns attempts.fluency + the extended settings.* were only ever created by
-- app code / the dashboard and had no DDL in the repo — so the repo could not
-- rebuild the DB. This file closes that gap. Keep it in sync when the schema changes.
--
-- Safe + idempotent (create if not exists / drop-then-create policy).

create extension if not exists "pgcrypto";

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id text primary key,
  name text not null,
  coach_language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at bigint
);

-- ── attempts (append-only practice history; note `fluency`) ──────────────────
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  profile_id text not null references public.profiles(id) on delete cascade,
  item_id text not null,
  lesson_id text,
  category_id text,
  phoneme text,
  target text,
  heard text,
  score int,
  passed boolean,
  heard_partner boolean,
  at bigint not null,
  fluency int
);
create index if not exists attempts_profile_at_idx on public.attempts(profile_id, at desc);
create index if not exists attempts_profile_cat_idx on public.attempts(profile_id, category_id);

-- ── progress (per-item SRS state) ────────────────────────────────────────────
create table if not exists public.progress (
  profile_id text not null references public.profiles(id) on delete cascade,
  item_id text not null,
  lesson_id text,
  category_id text,
  phoneme text,
  attempts int not null default 0,
  passes int not null default 0,
  box int not null default 0,
  due_at bigint,
  last_result text,
  last_score int,
  updated_at bigint,
  primary key (profile_id, item_id)
);

-- ── player_stats (progression + game economy) ────────────────────────────────
create table if not exists public.player_stats (
  profile_id text primary key references public.profiles(id) on delete cascade,
  xp int not null default 0,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_day text,
  today_key text,
  today_xp int not null default 0,
  total_attempts int not null default 0,
  total_passes int not null default 0,
  best_combo int not null default 0,
  achievements text[] not null default '{}',
  updated_at bigint,
  stars integer not null default 0,
  owned_cosmetics jsonb not null default '[]',
  equipped_bg text,
  equipped_accessory text,
  equipped_effect text,
  last_chest_day text,
  streak_freezes integer not null default 0,
  freeze_used_day text,
  equipped_pet text,
  equipped_outfit text
);

-- ── settings (synced preferences + identity/placement) ───────────────────────
create table if not exists public.settings (
  profile_id text primary key references public.profiles(id) on delete cascade,
  daily_goal int not null default 40,
  speech_rate real not null default 0.9,
  voice_uri text,
  recognition_lang text not null default 'en-US',
  updated_at bigint,
  student_name text,
  onboarding jsonb,
  coach_language text,
  difficulty text,
  sound_enabled boolean,
  instructor_mode boolean
);

-- ── custom_lessons (instructor-authored, shared content) ─────────────────────
create table if not exists public.custom_lessons (
  id text primary key,
  data jsonb not null,
  "order" int not null default 100,
  updated_at bigint
);

-- ── exam_attempts (stage-exam sittings, one per profile+day) ─────────────────
create table if not exists public.exam_attempts (
  id bigint generated always as identity primary key,
  profile_id text not null,
  day text not null,
  at bigint not null,
  level text not null,
  score int not null,
  passed boolean not null,
  sections jsonb not null default '{}'::jsonb,
  weakest text,
  created_at timestamptz not null default now()
);
create unique index if not exists exam_attempts_profile_day_idx on public.exam_attempts(profile_id, day);
create index if not exists exam_attempts_profile_at_idx on public.exam_attempts(profile_id, at desc);

-- ── call_scores (call-simulator runs, one per profile+at) ────────────────────
create table if not exists public.call_scores (
  id bigint generated always as identity primary key,
  profile_id text not null,
  scenario_id text not null,
  at bigint not null,
  score int not null,
  checks jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists call_scores_profile_at_uniq on public.call_scores(profile_id, at);
create index if not exists call_scores_profile_at_idx on public.call_scores(profile_id, at desc);

-- ── talk_sessions (/talk records for the 10-minute milestone) ────────────────
create table if not exists public.talk_sessions (
  id bigint generated always as identity primary key,
  profile_id text not null,
  scenario_id text not null,
  at bigint not null,
  duration_ms bigint not null,
  student_turns int not null,
  avg_pause_ms int,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists talk_sessions_profile_at_uniq on public.talk_sessions(profile_id, at);
create index if not exists talk_sessions_profile_at_idx on public.talk_sessions(profile_id, at desc);

-- ── conv_items (phrases mined from live chats → review deck) ──────────────────
create table if not exists public.conv_items (
  profile_id text not null,
  item_id text not null,
  text text not null,
  meaning text,
  source text,
  scenario_id text,
  created_at_ms bigint not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, item_id)
);
create index if not exists conv_items_profile_created_idx on public.conv_items(profile_id, created_at_ms desc);

-- ── quests (today's quest state, one per profile+day) ────────────────────────
create table if not exists public.quests (
  profile_id text not null,
  day text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at bigint not null,
  primary key (profile_id, day)
);

-- ── events (analytics, per-user) ─────────────────────────────────────────────
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

-- ── push_subscriptions (server-written; denied to all client roles) ──────────
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  profile_id text,
  lang text not null default 'es',
  created_at timestamptz not null default now()
);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- User-owned tables: profile_id (or id) must equal the caller's auth uid.
do $$
declare t text;
begin
  foreach t in array array[
    'attempts','progress','player_stats','settings','events',
    'exam_attempts','call_scores','talk_sessions','conv_items','quests'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (profile_id = auth.uid()::text)
         with check (profile_id = auth.uid()::text)', t);
  end loop;
end $$;

-- profiles keys on id, not profile_id.
alter table public.profiles enable row level security;
drop policy if exists own_rows on public.profiles;
create policy own_rows on public.profiles for all to authenticated
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- custom_lessons: everyone signed in may READ; only the teacher accounts WRITE.
-- (Email list mirrors ADMIN_EMAILS in lib/allowlist.ts.)
alter table public.custom_lessons enable row level security;
drop policy if exists authenticated_only on public.custom_lessons;
drop policy if exists custom_lessons_read on public.custom_lessons;
drop policy if exists custom_lessons_write_admin on public.custom_lessons;
create policy custom_lessons_read on public.custom_lessons
  for select to authenticated using (true);
create policy custom_lessons_write_admin on public.custom_lessons
  for all to authenticated
  using ((auth.jwt() ->> 'email') in ('alivio.studio.ops@gmail.com', 'joelcarias23@gmail.com'))
  with check ((auth.jwt() ->> 'email') in ('alivio.studio.ops@gmail.com', 'joelcarias23@gmail.com'));

-- push_subscriptions: deny ALL client roles. Written only by the server routes
-- with the service-role key (which bypasses RLS).
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_all" on public.push_subscriptions;
drop policy if exists no_client_access on public.push_subscriptions;
create policy no_client_access on public.push_subscriptions
  for all to anon, authenticated using (false) with check (false);
