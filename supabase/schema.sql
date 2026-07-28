-- Clara — Supabase schema (HISTORICAL v1 bring-up).
--
-- ⚠️  DO NOT run this file against the live database. It creates the ORIGINAL
--     permissive `public_all` policies (USING(true) / WITH CHECK(true)) from the
--     no-auth v1, which later migrations REPLACED with strict per-user RLS. It is
--     kept only as the historical first step of the migration chain.
--
--     To rebuild the database from scratch, use `current-schema.sql` — it is the
--     single authoritative snapshot of the live schema and RLS.
--
-- Mirrors the local-first Dexie domain (lib/db/types.ts), keyed by a text profile
-- id. The app stays local-first; this is the cloud sync + the instructor's
-- cross-device window into each student.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id text primary key,
  name text not null,
  coach_language text not null default 'es',
  created_at timestamptz not null default now(),
  updated_at bigint
);

create table if not exists attempts (
  id bigint generated always as identity primary key,
  profile_id text not null references profiles(id) on delete cascade,
  item_id text not null,
  lesson_id text,
  category_id text,
  phoneme text,
  target text,
  heard text,
  score int,
  passed boolean,
  heard_partner boolean,
  at bigint not null
);
create index if not exists attempts_profile_at_idx on attempts(profile_id, at desc);
create index if not exists attempts_profile_cat_idx on attempts(profile_id, category_id);

create table if not exists progress (
  profile_id text not null references profiles(id) on delete cascade,
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

create table if not exists player_stats (
  profile_id text primary key references profiles(id) on delete cascade,
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
  updated_at bigint
);

create table if not exists settings (
  profile_id text primary key references profiles(id) on delete cascade,
  daily_goal int not null default 40,
  speech_rate real not null default 0.9,
  voice_uri text,
  recognition_lang text not null default 'en-US',
  updated_at bigint
);

create table if not exists custom_lessons (
  id text primary key,
  data jsonb not null,
  "order" int not null default 100,
  updated_at bigint
);

-- Permissive RLS (no-auth v1). Drop-then-create keeps this idempotent.
do $$
declare t text;
begin
  foreach t in array array['profiles','attempts','progress','player_stats','settings','custom_lessons']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists public_all on %I', t);
    execute format('create policy public_all on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;
