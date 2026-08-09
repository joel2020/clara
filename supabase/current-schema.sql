-- Clara — AUTHORITATIVE desired schema snapshot. This is the only rebuild path:
-- running the whole file on an empty project creates the tables, RLS, and policies
-- expected by the application. Changes are mirrored here when their audit
-- migration is planned; Release Task 3 applies and verifies them in production.
--
-- Why this exists: every other SQL file in this directory is a historical or
-- additive audit artifact, not a rebuild chain. This snapshot consolidates the
-- final active tables, columns, indexes, functions, grants, and policies so a new
-- project needs no follow-up SQL. Keep it in sync when the schema changes.
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
  client_attempt_id uuid,
  item_id text not null,
  lesson_id text,
  category_id text,
  phoneme text,
  target text,
  heard text,
  score double precision,
  passed boolean,
  heard_partner boolean,
  at bigint not null,
  fluency double precision,
  policy_version text,
  provider_status text,
  pronunciation_score double precision,
  accuracy_score double precision,
  completeness_score double precision,
  prosody_score double precision,
  target_phoneme_score double precision,
  weakest_phoneme text,
  weakest_word text,
  attempt_ordinal integer,
  pronunciation_outcome text
);
-- CREATE TABLE IF NOT EXISTS does not add columns to an existing rebuild
-- target, so keep the authoritative snapshot additive there too.
alter table public.attempts
  add column if not exists client_attempt_id uuid,
  add column if not exists policy_version text,
  add column if not exists provider_status text,
  add column if not exists pronunciation_score double precision,
  add column if not exists accuracy_score double precision,
  add column if not exists completeness_score double precision,
  add column if not exists prosody_score double precision,
  add column if not exists target_phoneme_score double precision,
  add column if not exists weakest_phoneme text,
  add column if not exists weakest_word text,
  add column if not exists attempt_ordinal integer,
  add column if not exists pronunciation_outcome text;

-- The browser grades with fractional thresholds. Explicit conversions preserve
-- existing integer evidence while making rebuilds and upgrades equivalent.
alter table public.attempts
  alter column score type double precision using score::double precision,
  alter column fluency type double precision using fluency::double precision,
  alter column pronunciation_score type double precision using pronunciation_score::double precision,
  alter column accuracy_score type double precision using accuracy_score::double precision,
  alter column completeness_score type double precision using completeness_score::double precision,
  alter column prosody_score type double precision using prosody_score::double precision,
  alter column target_phoneme_score type double precision using target_phoneme_score::double precision;

alter table public.attempts
  drop constraint if exists attempts_technical_skip_has_no_weakness;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attempts_policy_version_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_policy_version_check check (policy_version = 'latam-v1');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_provider_status_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_provider_status_check check (provider_status in ('valid', 'technical-skip', 'unavailable'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_pronunciation_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_pronunciation_score_bounds check (pronunciation_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_accuracy_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_accuracy_score_bounds check (accuracy_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_completeness_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_completeness_score_bounds check (completeness_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_prosody_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_prosody_score_bounds check (prosody_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_target_phoneme_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_target_phoneme_score_bounds check (target_phoneme_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_weakest_phoneme_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_weakest_phoneme_bounds check (char_length(weakest_phoneme) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_weakest_word_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_weakest_word_bounds check (char_length(weakest_word) between 1 and 128);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_attempt_ordinal_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_attempt_ordinal_check check (attempt_ordinal in (1, 2, 3));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_pronunciation_outcome_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_pronunciation_outcome_check check (pronunciation_outcome in ('mastered', 'practiced-not-mastered', 'technical-skip'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_technical_skip_has_no_weakness' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_technical_skip_has_no_weakness
      check (
        (provider_status not in ('technical-skip', 'unavailable') and pronunciation_outcome is distinct from 'technical-skip')
        or (
          (provider_status in ('technical-skip', 'unavailable') or pronunciation_outcome = 'technical-skip')
          and score is null and fluency is null and pronunciation_score is null
          and accuracy_score is null and completeness_score is null and prosody_score is null
          and target_phoneme_score is null and weakest_phoneme is null and weakest_word is null
          and passed is not true and pronunciation_outcome is distinct from 'mastered'
        )
      );
  end if;
end $$;
create index if not exists attempts_profile_at_idx on public.attempts(profile_id, at desc);
create index if not exists attempts_profile_cat_idx on public.attempts(profile_id, category_id);
create unique index if not exists attempts_profile_client_id_uniq
  on public.attempts(profile_id, client_attempt_id)
  where client_attempt_id is not null;
create index if not exists attempts_profile_weak_sound_idx
  on public.attempts(profile_id, weakest_phoneme, at desc)
  where provider_status = 'valid' and pronunciation_outcome is distinct from 'technical-skip' and weakest_phoneme is not null;

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
create index if not exists progress_profile_due_at_idx on public.progress(profile_id, due_at) where due_at is not null;

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
  completed_daily_sessions integer not null default 0 check (completed_daily_sessions >= 0),
  unlocked_milestones text[] not null default '{}'
    check (
      cardinality(unlocked_milestones) <= 64
      and octet_length(array_to_string(unlocked_milestones, ',')) <= 8256
      and (
        cardinality(unlocked_milestones) = 0
        or array_to_string(unlocked_milestones, ',') ~ '^[a-zA-Z0-9][a-zA-Z0-9:._/-]*(,[a-zA-Z0-9][a-zA-Z0-9:._/-]*)*$'
      )
    ),
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
  equipped_outfit text,
  avatar_base text,
  equipped_avatar_outfit text,
  equipped_cap text
);

create or replace function public.merge_player_closet_progress(
  p_profile_id text,
  p_completed_daily_sessions integer,
  p_unlocked_milestones text[],
  p_updated_at bigint
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid())::text is distinct from p_profile_id then
    raise exception 'profile ownership mismatch' using errcode = '42501';
  end if;
  if p_completed_daily_sessions is null
    or p_completed_daily_sessions < 0
    or cardinality(coalesce(p_unlocked_milestones, '{}'::text[])) > 64
    or exists (
      select 1
      from unnest(coalesce(p_unlocked_milestones, '{}'::text[])) as milestone(id)
      where length(id) < 1 or length(id) > 128 or id !~ '^[a-zA-Z0-9][a-zA-Z0-9:._/-]*$'
    )
  then
    raise exception 'invalid Closet progress' using errcode = '22023';
  end if;

  update public.player_stats
  set completed_daily_sessions = greatest(completed_daily_sessions, p_completed_daily_sessions),
      unlocked_milestones = array(
        select distinct milestone
        from unnest(unlocked_milestones || coalesce(p_unlocked_milestones, '{}'::text[])) as merged(milestone)
        order by milestone
      ),
      updated_at = greatest(coalesce(updated_at, 0), coalesce(p_updated_at, 0))
  where profile_id = p_profile_id;
end;
$$;

revoke all on function public.merge_player_closet_progress(text, integer, text[], bigint) from public;
revoke all on function public.merge_player_closet_progress(text, integer, text[], bigint) from anon;
grant execute on function public.merge_player_closet_progress(text, integer, text[], bigint) to authenticated;

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
  instructor_mode boolean,
  voice_consent jsonb
);

alter table public.settings add column if not exists voice_consent jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_voice_consent_shape' and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_voice_consent_shape check (
      voice_consent is null or (
        jsonb_typeof(voice_consent) = 'object'
        and voice_consent ?& array['version','at']
        and voice_consent - array['version','at']::text[] = '{}'::jsonb
        and (voice_consent ->> 'version') ~ '^[0-9]+$'
        and (voice_consent ->> 'version')::integer between 1 and 100
        and (voice_consent ->> 'at') ~ '^[0-9]+$'
        and (voice_consent ->> 'at')::bigint between 0 and 4102444800000
      )
    );
  end if;
end $$;

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

-- ── virtual_calls (finished call reports; transcripts remain device-only) ─────
create table if not exists public.virtual_calls (
  profile_id text not null,
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
  corrections jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  vocabulary_used jsonb not null default '[]'::jsonb,
  pronunciation jsonb,
  constraint virtual_calls_pronunciation_shape check (
    pronunciation is null or (
      jsonb_typeof(pronunciation) = 'object'
      and octet_length(pronunciation::text) <= 2048
      and pronunciation - array['version', 'diagnosticCueKeys', 'scripted']::text[] = '{}'::jsonb
      and pronunciation ?& array['version', 'diagnosticCueKeys', 'scripted']
      and jsonb_typeof(pronunciation -> 'version') = 'number'
      and pronunciation ->> 'version' = '2'
      and jsonb_typeof(pronunciation -> 'diagnosticCueKeys') = 'array'
      and jsonb_array_length(pronunciation -> 'diagnosticCueKeys') <= 3
      and (pronunciation -> 'diagnosticCueKeys') <@ '["pronunciation.cue.es.short-i-long-ee","pronunciation.cue.es.foot-goose","pronunciation.cue.es.trap-dress","pronunciation.cue.es.strut-lot","pronunciation.cue.es.b-v","pronunciation.cue.es.dzh-y","pronunciation.cue.es.sh-ch","pronunciation.cue.es.th","pronunciation.cue.es.initial-s-cluster","pronunciation.cue.es.final-endings","pronunciation.cue.es.final-clusters","pronunciation.cue.es.h","pronunciation.cue.es.rhotic-r","pronunciation.cue.es.schwa","pronunciation.cue.es.word-stress","pronunciation.cue.es.sentence-rhythm","pronunciation.cue.es.connected-speech","pronunciation.cue.es.flap"]'::jsonb
      and jsonb_typeof(pronunciation -> 'scripted') = 'object'
      and (pronunciation -> 'scripted') - array['graded', 'mastered', 'practiced', 'unavailable', 'averageScore']::text[] = '{}'::jsonb
      and (pronunciation -> 'scripted') ?& array['graded', 'mastered', 'practiced', 'unavailable']
      and case
        when jsonb_typeof(pronunciation #> '{scripted,graded}') = 'number'
         and jsonb_typeof(pronunciation #> '{scripted,mastered}') = 'number'
         and jsonb_typeof(pronunciation #> '{scripted,practiced}') = 'number'
         and jsonb_typeof(pronunciation #> '{scripted,unavailable}') = 'number'
         and coalesce(pronunciation #>> '{scripted,graded}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and coalesce(pronunciation #>> '{scripted,mastered}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and coalesce(pronunciation #>> '{scripted,practiced}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and coalesce(pronunciation #>> '{scripted,unavailable}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and (
           not ((pronunciation -> 'scripted') ? 'averageScore')
           or (
             jsonb_typeof(pronunciation #> '{scripted,averageScore}') = 'number'
             and coalesce(pronunciation #>> '{scripted,averageScore}', '') ~ '^(100|[0-9]{1,2})$'
           )
         )
        then (pronunciation #>> '{scripted,mastered}')::integer
           + (pronunciation #>> '{scripted,practiced}')::integer
           <= (pronunciation #>> '{scripted,graded}')::integer
        else false
      end
    )
  ),
  retried_count integer not null default 0,
  retried_accepted_count integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (profile_id, at)
);
create index if not exists virtual_calls_profile_at_idx on public.virtual_calls(profile_id, at desc);

create or replace function public.normalize_virtual_call_pronunciation_insert()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $virtual_call$
begin
  -- Current writers already emit the constraint-safe version-2 shape. The
  -- trigger exists only for one released legacy client shape.
  if new.pronunciation is null then
    return new;
  end if;
  if pg_column_size(new.pronunciation) <= 2048
     and jsonb_typeof(new.pronunciation) = 'object'
     and jsonb_typeof(new.pronunciation -> 'version') = 'number'
     and new.pronunciation -> 'version' = '2'::jsonb then
    return new;
  end if;

  if pg_column_size(new.pronunciation) > 2048
     or jsonb_typeof(new.pronunciation) is distinct from 'object' then
    raise exception 'Invalid or unbounded legacy virtual-call pronunciation' using errcode = '22023';
  end if;
  if new.pronunciation - array['scored', 'averageScore', 'worstWords']::text[] <> '{}'::jsonb
     or not (new.pronunciation ?& array['scored', 'averageScore', 'worstWords']) then
    raise exception 'Invalid or unbounded legacy virtual-call pronunciation' using errcode = '22023';
  end if;
  if jsonb_typeof(new.pronunciation -> 'scored') is distinct from 'number'
     or jsonb_typeof(new.pronunciation -> 'averageScore') is distinct from 'number'
     or jsonb_typeof(new.pronunciation -> 'worstWords') is distinct from 'array' then
    raise exception 'Invalid or unbounded legacy virtual-call pronunciation' using errcode = '22023';
  end if;
  if coalesce(new.pronunciation ->> 'scored', '') !~ '^([1-9]|1[0-9]|2[0-4])$'
     or coalesce(new.pronunciation ->> 'averageScore', '') !~ '^(100|[0-9]{1,2})$'
     or jsonb_array_length(new.pronunciation -> 'worstWords') > 3 then
    raise exception 'Invalid or unbounded legacy virtual-call pronunciation' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(new.pronunciation -> 'worstWords') as legacy_word(word_json)
    where jsonb_typeof(word_json) is distinct from 'string'
  ) then
    raise exception 'Invalid or unbounded legacy virtual-call pronunciation' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(new.pronunciation -> 'worstWords') as legacy_word(word)
    where octet_length(word) > 80
  ) then
    raise exception 'Invalid or unbounded legacy virtual-call pronunciation' using errcode = '22023';
  end if;

  -- Old worstWords are deliberately discarded. Old scores remain useful only
  -- as conservative practiced-not-mastered evidence.
  new.pronunciation := jsonb_build_object(
    'version', 2,
    'diagnosticCueKeys', '[]'::jsonb,
    'scripted', jsonb_build_object(
      'graded', (new.pronunciation ->> 'scored')::integer,
      'mastered', 0,
      'practiced', (new.pronunciation ->> 'scored')::integer,
      'unavailable', 0,
      'averageScore', (new.pronunciation ->> 'averageScore')::integer
    )
  );
  return new;
end
$virtual_call$;

revoke all on function public.normalize_virtual_call_pronunciation_insert() from public;
revoke all on function public.normalize_virtual_call_pronunciation_insert() from anon;
revoke all on function public.normalize_virtual_call_pronunciation_insert() from authenticated;

drop trigger if exists virtual_calls_normalize_pronunciation_before_insert on public.virtual_calls;
create trigger virtual_calls_normalize_pronunciation_before_insert
before insert on public.virtual_calls
for each row execute function public.normalize_virtual_call_pronunciation_insert();


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

-- ── daily_sessions (atomic, mergeable daily-learning state) ──────────────────
create table if not exists public.daily_sessions (
  profile_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  version integer not null,
  payload jsonb not null,
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
create index if not exists events_profile_day_idx on public.events(profile_id, day);
create index if not exists events_profile_type_day_idx on public.events(profile_id, type, day);
create index if not exists events_type_at_idx on public.events(type, at desc);

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
--
-- auth.uid() is wrapped in a scalar subquery on purpose. A bare auth.uid() is
-- treated as row-dependent and re-evaluated for EVERY row; wrapping it lets the
-- planner hoist it into an InitPlan and run it once per query. Identical
-- semantics, materially cheaper on the tables that grow without bound (attempts
-- and events gain a row per practice rep).
-- Attempts are append-only through the client. Separate operation policies make
-- the owner boundary explicit and prevent UPDATE/DELETE of historical evidence.
alter table public.attempts enable row level security;
drop policy if exists public_all on public.attempts;
drop policy if exists own_rows on public.attempts;
drop policy if exists attempts_select_own on public.attempts;
drop policy if exists attempts_insert_own on public.attempts;
create policy attempts_select_own on public.attempts
  for select to authenticated
  using ((select auth.uid())::text = profile_id);
create policy attempts_insert_own on public.attempts
  for insert to authenticated
  with check ((select auth.uid())::text = profile_id);

-- Explicit grants keep the table reachable after the April 2026 Data API
-- default change; RLS still decides which rows the authenticated role can see.
revoke all on table public.attempts from public;
revoke all on table public.attempts from anon;
revoke update, delete, truncate, references, trigger on table public.attempts from authenticated;
grant select, insert on table public.attempts to authenticated;
grant usage on sequence public.attempts_id_seq to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'progress','player_stats','events',
    'exam_attempts','call_scores','talk_sessions','conv_items','quests'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (profile_id = (select auth.uid())::text)
         with check (profile_id = (select auth.uid())::text)', t);
  end loop;
end $$;

-- virtual_calls uses the same text profile id as the other sync tables but has
-- its own policy declaration so the authoritative table definition stays easy
-- to audit against its historical additive migration.
alter table public.virtual_calls
  drop constraint if exists virtual_calls_pronunciation_shape;
alter table public.virtual_calls
  add constraint virtual_calls_pronunciation_shape
  check (
    pronunciation is null or (
      jsonb_typeof(pronunciation) = 'object'
      and octet_length(pronunciation::text) <= 2048
      and pronunciation - array['version', 'diagnosticCueKeys', 'scripted']::text[] = '{}'::jsonb
      and pronunciation ?& array['version', 'diagnosticCueKeys', 'scripted']
      and jsonb_typeof(pronunciation -> 'version') = 'number'
      and pronunciation ->> 'version' = '2'
      and jsonb_typeof(pronunciation -> 'diagnosticCueKeys') = 'array'
      and jsonb_array_length(pronunciation -> 'diagnosticCueKeys') <= 3
      and (pronunciation -> 'diagnosticCueKeys') <@ '["pronunciation.cue.es.short-i-long-ee","pronunciation.cue.es.foot-goose","pronunciation.cue.es.trap-dress","pronunciation.cue.es.strut-lot","pronunciation.cue.es.b-v","pronunciation.cue.es.dzh-y","pronunciation.cue.es.sh-ch","pronunciation.cue.es.th","pronunciation.cue.es.initial-s-cluster","pronunciation.cue.es.final-endings","pronunciation.cue.es.final-clusters","pronunciation.cue.es.h","pronunciation.cue.es.rhotic-r","pronunciation.cue.es.schwa","pronunciation.cue.es.word-stress","pronunciation.cue.es.sentence-rhythm","pronunciation.cue.es.connected-speech","pronunciation.cue.es.flap"]'::jsonb
      and jsonb_typeof(pronunciation -> 'scripted') = 'object'
      and (pronunciation -> 'scripted') - array['graded', 'mastered', 'practiced', 'unavailable', 'averageScore']::text[] = '{}'::jsonb
      and (pronunciation -> 'scripted') ?& array['graded', 'mastered', 'practiced', 'unavailable']
      and case
        when jsonb_typeof(pronunciation #> '{scripted,graded}') = 'number'
         and jsonb_typeof(pronunciation #> '{scripted,mastered}') = 'number'
         and jsonb_typeof(pronunciation #> '{scripted,practiced}') = 'number'
         and jsonb_typeof(pronunciation #> '{scripted,unavailable}') = 'number'
         and coalesce(pronunciation #>> '{scripted,graded}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and coalesce(pronunciation #>> '{scripted,mastered}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and coalesce(pronunciation #>> '{scripted,practiced}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and coalesce(pronunciation #>> '{scripted,unavailable}', '') ~ '^(0|[1-9]|1[0-9]|2[0-4])$'
         and (
           not ((pronunciation -> 'scripted') ? 'averageScore')
           or (
             jsonb_typeof(pronunciation #> '{scripted,averageScore}') = 'number'
             and coalesce(pronunciation #>> '{scripted,averageScore}', '') ~ '^(100|[0-9]{1,2})$'
           )
         )
        then (pronunciation #>> '{scripted,mastered}')::integer
           + (pronunciation #>> '{scripted,practiced}')::integer
           <= (pronunciation #>> '{scripted,graded}')::integer
        else false
      end
    )
  ) not valid;

alter table public.virtual_calls enable row level security;
drop policy if exists own_rows on public.virtual_calls;
drop policy if exists virtual_calls_select_own on public.virtual_calls;
drop policy if exists virtual_calls_insert_own on public.virtual_calls;
create policy virtual_calls_select_own on public.virtual_calls
  for select to authenticated
  using (profile_id = (select auth.uid())::text);
create policy virtual_calls_insert_own on public.virtual_calls
  for insert to authenticated
  with check (profile_id = (select auth.uid())::text);

revoke all on table public.virtual_calls from public;
revoke all on table public.virtual_calls from anon;
revoke update, delete, truncate, references, trigger on table public.virtual_calls from authenticated;
grant select, insert on table public.virtual_calls to authenticated;

-- daily_sessions keys directly to auth.users with UUID ownership.
alter table public.daily_sessions enable row level security;
drop policy if exists daily_sessions_own_rows on public.daily_sessions;
create policy daily_sessions_own_rows on public.daily_sessions
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

revoke all on table public.daily_sessions from public;
revoke all on table public.daily_sessions from anon;
revoke all on table public.daily_sessions from authenticated;
grant select, insert, update on table public.daily_sessions to authenticated;

-- UUID attempt events are the pronunciation source of truth. Branches from
-- two devices union by UUID, cap at three events per target, and then derive
-- terminal/session counters instead of trusting last-writer counters.
create or replace function public.merge_daily_pronunciation_state(p_left jsonb, p_right jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  -- v3 contentHash binds game, target grading metadata, staged source identity,
  -- and the authored pool (including Beat contrasts); v2 is legacy-compatible.
  if jsonb_typeof(p_left) is distinct from 'object'
    or jsonb_typeof(p_right) is distinct from 'object'
    or coalesce(p_left ->> 'version', '') <> '2'
    or coalesce(p_right ->> 'version', '') <> '2'
    or coalesce(p_left ->> 'game', '') not in ('sound-sprint', 'beat-the-twin', 'echo-chain', 'call-rescue')
    or coalesce(p_right ->> 'game', '') not in ('sound-sprint', 'beat-the-twin', 'echo-chain', 'call-rescue')
    or coalesce(p_left ->> 'contentHash', '') !~ '^daily-pronunciation-v[23]:[0-9a-f]{8}$'
    or coalesce(p_right ->> 'contentHash', '') !~ '^daily-pronunciation-v[23]:[0-9a-f]{8}$'
    or (p_left ->> 'game') is distinct from (p_right ->> 'game')
    or (p_left ->> 'contentHash') is distinct from (p_right ->> 'contentHash')
  then
    raise exception 'Incompatible pronunciation state' using errcode = '22023';
  end if;

  if jsonb_typeof(p_left -> 'attemptEvents') is distinct from 'array'
    or jsonb_typeof(p_right -> 'attemptEvents') is distinct from 'array'
    or jsonb_array_length(p_left -> 'attemptEvents') > 9
    or jsonb_array_length(p_right -> 'attemptEvents') > 9
    or jsonb_typeof(coalesce(p_left -> 'overflowEvents', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_right -> 'overflowEvents', '[]'::jsonb)) is distinct from 'array'
    or jsonb_array_length(coalesce(p_left -> 'overflowEvents', '[]'::jsonb)) > 9
    or jsonb_array_length(coalesce(p_right -> 'overflowEvents', '[]'::jsonb)) > 9
    or jsonb_typeof(coalesce(p_left -> 'conflictIds', '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_right -> 'conflictIds', '[]'::jsonb)) is distinct from 'array'
    or jsonb_array_length(coalesce(p_left -> 'conflictIds', '[]'::jsonb)) > 9
    or jsonb_array_length(coalesce(p_right -> 'conflictIds', '[]'::jsonb)) > 9
    or jsonb_typeof(p_left -> 'resolutions') is distinct from 'array'
    or jsonb_typeof(p_right -> 'resolutions') is distinct from 'array'
    or jsonb_array_length(p_left -> 'resolutions') <> 3
    or jsonb_array_length(p_right -> 'resolutions') <> 3
    or jsonb_typeof(p_left -> 'sessions') is distinct from 'array'
    or jsonb_typeof(p_right -> 'sessions') is distinct from 'array'
    or jsonb_array_length(p_left -> 'sessions') <> 3
    or jsonb_array_length(p_right -> 'sessions') <> 3
    or coalesce(p_left ->> 'sequence', '') !~ '^[0-9]{1,7}$'
    or coalesce(p_right ->> 'sequence', '') !~ '^[0-9]{1,7}$'
    or (p_left ->> 'sequence')::integer not between 0 and 1000000
    or (p_right ->> 'sequence')::integer not between 0 and 1000000
    or coalesce(p_left ->> 'targetIndex', '') not in ('0', '1', '2')
    or coalesce(p_right ->> 'targetIndex', '') not in ('0', '1', '2')
    or coalesce(p_left ->> 'stage', '') not in ('ready', 'listened', 'choice-made')
    or coalesce(p_right ->> 'stage', '') not in ('ready', 'listened', 'choice-made')
    or jsonb_typeof(p_left -> 'terminal') is distinct from 'boolean'
    or jsonb_typeof(p_right -> 'terminal') is distinct from 'boolean'
    or (p_left ? 'choiceId' and jsonb_typeof(p_left -> 'choiceId') is distinct from 'string')
    or (p_right ? 'choiceId' and jsonb_typeof(p_right -> 'choiceId') is distinct from 'string')
    or (coalesce((p_left ->> 'terminal')::boolean, false) and ((p_left ->> 'stage') <> 'ready' or p_left ? 'choiceId'))
    or (coalesce((p_right ->> 'terminal')::boolean, false) and ((p_right ->> 'stage') <> 'ready' or p_right ? 'choiceId'))
    or ((p_left ->> 'game') <> 'beat-the-twin' and ((p_left ->> 'stage') <> 'ready' or p_left ? 'choiceId'))
    or ((p_right ->> 'game') <> 'beat-the-twin' and ((p_right ->> 'stage') <> 'ready' or p_right ? 'choiceId'))
    or ((p_left ->> 'game') = 'beat-the-twin' and (((p_left ->> 'stage') = 'choice-made' and coalesce(p_left ->> 'choiceId', '') = '') or ((p_left ->> 'stage') <> 'choice-made' and p_left ? 'choiceId')))
    or ((p_right ->> 'game') = 'beat-the-twin' and (((p_right ->> 'stage') = 'choice-made' and coalesce(p_right ->> 'choiceId', '') = '') or ((p_right ->> 'stage') <> 'choice-made' and p_right ? 'choiceId')))
  then
    raise exception 'Invalid or unbounded pronunciation state' using errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select raw_event from jsonb_array_elements(p_left -> 'attemptEvents') raw_event
      union all
      select raw_event from jsonb_array_elements(p_right -> 'attemptEvents') raw_event
      union all
      select raw_event from jsonb_array_elements(coalesce(p_left -> 'overflowEvents', '[]'::jsonb)) raw_event
      union all
      select raw_event from jsonb_array_elements(coalesce(p_right -> 'overflowEvents', '[]'::jsonb)) raw_event
    ) raw
    where jsonb_typeof(raw_event) is distinct from 'object'
      or coalesce(raw_event ->> 'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(raw_event ->> 'targetIndex', '') not in ('0', '1', '2')
      or coalesce(raw_event ->> 'outcome', '') not in ('mastered', 'retry')
      or case when jsonb_typeof(raw_event -> 'score') = 'number'
        then (raw_event ->> 'score')::numeric not between 0 and 100 else true end
      or coalesce(raw_event ->> 'ordinal', '') not in ('1', '2', '3')
      or case when jsonb_typeof(raw_event -> 'at') = 'number' and (raw_event ->> 'at') ~ '^[0-9]+$'
        then (raw_event ->> 'at')::numeric not between 0 and 9000000000000000 else true end
  ) then
    raise exception 'Invalid pronunciation attempt event' using errcode = '22023';
  end if;

  if exists (
    select 1 from (
      select conflict_id from jsonb_array_elements_text(coalesce(p_left -> 'conflictIds', '[]'::jsonb)) conflict_id
      union all
      select conflict_id from jsonb_array_elements_text(coalesce(p_right -> 'conflictIds', '[]'::jsonb)) conflict_id
    ) conflicts
    where conflict_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ) then
    raise exception 'Invalid pronunciation conflict tombstone' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements_text(coalesce(p_left -> 'conflictIds', '[]'::jsonb)))
      <> (select count(distinct value) from jsonb_array_elements_text(coalesce(p_left -> 'conflictIds', '[]'::jsonb)))
    or (select count(*) from jsonb_array_elements_text(coalesce(p_right -> 'conflictIds', '[]'::jsonb)))
      <> (select count(distinct value) from jsonb_array_elements_text(coalesce(p_right -> 'conflictIds', '[]'::jsonb)))
    or (select count(*) from (
      select event ->> 'id' as id from jsonb_array_elements(p_left -> 'attemptEvents') event
      union all select event ->> 'id' from jsonb_array_elements(coalesce(p_left -> 'overflowEvents', '[]'::jsonb)) event
    ) left_ids) <> (select count(distinct id) from (
      select event ->> 'id' as id from jsonb_array_elements(p_left -> 'attemptEvents') event
      union all select event ->> 'id' from jsonb_array_elements(coalesce(p_left -> 'overflowEvents', '[]'::jsonb)) event
    ) left_ids)
    or (select count(*) from (
      select event ->> 'id' as id from jsonb_array_elements(p_right -> 'attemptEvents') event
      union all select event ->> 'id' from jsonb_array_elements(coalesce(p_right -> 'overflowEvents', '[]'::jsonb)) event
    ) right_ids) <> (select count(distinct id) from (
      select event ->> 'id' as id from jsonb_array_elements(p_right -> 'attemptEvents') event
      union all select event ->> 'id' from jsonb_array_elements(coalesce(p_right -> 'overflowEvents', '[]'::jsonb)) event
    ) right_ids)
  then
    raise exception 'Duplicate pronunciation evidence identity' using errcode = '22023';
  end if;

  if exists (
    select 1 from (values (p_left), (p_right)) candidate(state)
    where state ->> 'game' = 'beat-the-twin'
      and state -> 'resolutions' -> ((state ->> 'targetIndex')::integer) = 'null'::jsonb
      and state ->> 'stage' <> 'choice-made'
      and exists (
        select 1 from (
          select event from jsonb_array_elements(state -> 'attemptEvents') event
          union all select event from jsonb_array_elements(coalesce(state -> 'overflowEvents', '[]'::jsonb)) event
        ) evidence
        where (event ->> 'targetIndex')::integer = (state ->> 'targetIndex')::integer
      )
  ) then
    raise exception 'Incoherent pronunciation interaction stage' using errcode = '22023';
  end if;

  if exists (
    select 1 from (
      select resolution from jsonb_array_elements(p_left -> 'resolutions') resolution
      union all
      select resolution from jsonb_array_elements(p_right -> 'resolutions') resolution
    ) values_to_check
    where resolution <> 'null'::jsonb
      and (resolution #>> '{}') not in ('graded-mastered', 'graded-practiced', 'technical', 'ungraded')
  ) then
    raise exception 'Invalid pronunciation resolution' using errcode = '22023';
  end if;

  if exists (
    select 1 from (values (p_left), (p_right)) candidate(state)
    where (state ->> 'terminal')::boolean <> (
      select bool_and(resolution <> 'null'::jsonb) from jsonb_array_elements(state -> 'resolutions') resolution
    )
    or (state ->> 'targetIndex')::integer <> coalesce((
      select ordinality::integer - 1
      from jsonb_array_elements(state -> 'resolutions') with ordinality as entry(resolution, ordinality)
      where resolution = 'null'::jsonb order by ordinality limit 1
    ), 2)
  ) then
    raise exception 'Incoherent pronunciation terminal state' using errcode = '22023';
  end if;

  with raw_events as (
    select raw_event from jsonb_array_elements(p_left -> 'attemptEvents') raw_event
    union all
    select raw_event from jsonb_array_elements(p_right -> 'attemptEvents') raw_event
    union all
    select raw_event from jsonb_array_elements(coalesce(p_left -> 'overflowEvents', '[]'::jsonb)) raw_event
    union all
    select raw_event from jsonb_array_elements(coalesce(p_right -> 'overflowEvents', '[]'::jsonb)) raw_event
  ), normalized_events as (
    select jsonb_build_object(
      'id', raw_event ->> 'id',
      'targetIndex', (raw_event ->> 'targetIndex')::integer,
      'outcome', raw_event ->> 'outcome',
      'score', (raw_event ->> 'score')::numeric,
      'ordinal', (raw_event ->> 'ordinal')::integer,
      'at', (raw_event ->> 'at')::bigint
    ) as event
    from raw_events
  ), payload_conflicts as (
    select event ->> 'id' as id
    from normalized_events
    group by event ->> 'id'
    having count(distinct event::text) > 1
  ), inherited_conflicts as (
    select conflict_id as id from jsonb_array_elements_text(coalesce(p_left -> 'conflictIds', '[]'::jsonb)) conflict_id
    union
    select conflict_id as id from jsonb_array_elements_text(coalesce(p_right -> 'conflictIds', '[]'::jsonb)) conflict_id
  ), conflict_ids as (
    select id from inherited_conflicts
    union
    select id from payload_conflicts
  ), unique_events as (
    select min(event::text)::jsonb as event
    from normalized_events
    where not exists (select 1 from conflict_ids where conflict_ids.id = normalized_events.event ->> 'id')
    group by event ->> 'id'
    having count(distinct event::text) = 1
  ), ranked_events as (
    select event, row_number() over (
      partition by (event ->> 'targetIndex')::integer
      order by case when event ->> 'outcome' = 'mastered' then 0 else 1 end,
        (event ->> 'ordinal')::integer,
        (event ->> 'at')::bigint,
        (event ->> 'id') collate "C"
    ) as event_rank
    from unique_events
  ), bounded_events as (
    select event from ranked_events where event_rank <= 3
  ), overflow_events as (
    select event from ranked_events where event_rank > 3
  ), target_facts as (
    select target_index,
      count(event) as attempts,
      coalesce(bool_or(event ->> 'outcome' = 'mastered'), false) as mastered,
      coalesce(bool_and(event ->> 'outcome' = 'retry'), false) as all_retry,
      (array_agg((event ->> 'score')::numeric order by
        (event ->> 'ordinal')::integer,
        case when event ->> 'outcome' = 'mastered' then 0 else 1 end,
        (event ->> 'at')::bigint,
        (event ->> 'id') collate "C"
      ) filter (where event is not null))[1] as first_score,
      (p_left -> 'resolutions' -> target_index) #>> '{}' as left_resolution,
      (p_right -> 'resolutions' -> target_index) #>> '{}' as right_resolution
    from generate_series(0, 2) target_index
    left join bounded_events on (event ->> 'targetIndex')::integer = target_index
    group by target_index
  ), candidates as (
    select *, (
      select value from (values
        (left_resolution, case left_resolution when 'graded-mastered' then 4 when 'graded-practiced' then 3 when 'technical' then 2 when 'ungraded' then 1 else 0 end),
        (right_resolution, case right_resolution when 'graded-mastered' then 4 when 'graded-practiced' then 3 when 'technical' then 2 when 'ungraded' then 1 else 0 end)
      ) ranked(value, resolution_rank)
      where value is not null
      order by resolution_rank desc, value
      limit 1
    ) as candidate
    from target_facts
  ), derived as (
    select *, case
      when candidate is null then null
      when mastered then 'graded-mastered'
      when attempts = 3 and all_retry then 'graded-practiced'
      when candidate = 'ungraded' and attempts = 0 then 'ungraded'
      when candidate = 'technical' and attempts < 3 and not mastered then 'technical'
      else null
    end as resolution
    from candidates
  ), arrays as (
    select
      jsonb_agg(coalesce(to_jsonb(resolution), 'null'::jsonb) order by target_index) as resolutions,
      jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'validAttempts', attempts,
        'firstValidScore', first_score,
        'status', case
          when attempts = 0 and resolution = 'technical' then 'technical-skip'
          when attempts = 0 then 'active'
          when mastered then 'mastered'
          when attempts >= 3 then 'practiced-not-mastered'
          when resolution = 'technical' then 'technical-skip'
          else 'active'
        end
      )) order by target_index) as sessions,
      count(*) filter (where resolution is not null) as resolved,
      count(*) filter (where resolution in ('graded-mastered', 'graded-practiced')) as graded,
      count(*) filter (where resolution = 'graded-mastered') as mastered_count,
      count(*) filter (where resolution = 'technical') as technical,
      count(*) filter (where resolution = 'ungraded') as ungraded,
      min(target_index) filter (where resolution is null) as next_index
    from derived
  ), base as (
    select case when (p_left ->> 'sequence')::integer >= (p_right ->> 'sequence')::integer then p_left else p_right end as value
  ), facts as (
    select arrays.*, coalesce(next_index, 2) as target_index, resolved = 3 as terminal
    from arrays
  ), interaction as (
    select coalesce(chosen.state ->> 'stage', 'ready') as stage,
      chosen.state ->> 'choiceId' as choice_id
    from facts
    left join lateral (
      select state from (values (p_left), (p_right)) candidates(state)
      where (state ->> 'targetIndex')::integer = facts.target_index
      order by case state ->> 'stage' when 'choice-made' then 2 when 'listened' then 1 else 0 end desc,
        coalesce(state ->> 'choiceId', '') collate "C"
      limit 1
    ) chosen on true
  )
  select ((base.value - 'choiceId') || jsonb_build_object(
    'version', 2,
    'game', p_left ->> 'game',
    'contentHash', p_left ->> 'contentHash',
    'sequence', greatest((p_left ->> 'sequence')::integer, (p_right ->> 'sequence')::integer),
    'attemptEvents', coalesce((select jsonb_agg(event order by
      (event ->> 'targetIndex')::integer,
      (event ->> 'ordinal')::integer,
      case when event ->> 'outcome' = 'mastered' then 0 else 1 end,
      (event ->> 'at')::bigint,
      (event ->> 'id') collate "C") from bounded_events), '[]'::jsonb),
    'overflowEvents', coalesce((select jsonb_agg(event order by
      (event ->> 'targetIndex')::integer,
      (event ->> 'ordinal')::integer,
      case when event ->> 'outcome' = 'mastered' then 0 else 1 end,
      (event ->> 'at')::bigint,
      (event ->> 'id') collate "C") from overflow_events), '[]'::jsonb),
    'conflictIds', coalesce((select jsonb_agg(id order by id collate "C") from conflict_ids), '[]'::jsonb),
    'resolutions', facts.resolutions,
    'sessions', facts.sessions,
    'gradedTargets', facts.graded,
    'masteredTargets', facts.mastered_count,
    'technicalTargets', facts.technical,
    'ungradedTargets', facts.ungraded,
    'targetIndex', facts.target_index,
    'stage', case when (p_left ->> 'game') <> 'beat-the-twin' or facts.terminal then 'ready' else interaction.stage end,
    'terminal', facts.terminal
  ) || case
    when (p_left ->> 'game') = 'beat-the-twin' and not facts.terminal
      and interaction.stage = 'choice-made' and interaction.choice_id is not null
      then jsonb_build_object('choiceId', interaction.choice_id)
    else '{}'::jsonb
  end)
  into v_result
  from base cross join interaction cross join facts;

  if jsonb_array_length(v_result -> 'overflowEvents') > 9
    or jsonb_array_length(v_result -> 'conflictIds') > 9
  then
    raise exception 'Pronunciation evidence bound exceeded' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

revoke all on function public.merge_daily_pronunciation_state(jsonb, jsonb) from public;
revoke all on function public.merge_daily_pronunciation_state(jsonb, jsonb) from anon;
grant execute on function public.merge_daily_pronunciation_state(jsonb, jsonb) to authenticated;

-- Serialize every write for one profile/day and merge inside the database.
-- The client cannot choose profile_id: ownership always comes from auth.uid().
create or replace function public.merge_daily_session(
  p_day text,
  p_version integer,
  p_payload jsonb,
  p_updated_at bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_profile_id uuid := auth.uid();
  v_existing jsonb;
  v_existing_updated_at bigint;
  v_newer jsonb;
  v_older jsonb;
  v_activities jsonb;
  v_merged jsonb;
  v_current_activity_id text;
begin
  if v_profile_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_day is null or p_day !~ '^\d{4}-\d{2}-\d{2}$'
    or p_version not in (1, 2)
    or jsonb_typeof(p_payload) is distinct from 'object'
    or octet_length(p_payload::text) > 65536
    or jsonb_typeof(p_payload -> 'activities') is distinct from 'array'
    or jsonb_array_length(p_payload -> 'activities') < 1
    or jsonb_array_length(p_payload -> 'activities') > 12
    or p_updated_at not between 0 and 9000000000000000
    or (p_payload ->> 'profileId') is distinct from v_profile_id::text
    or (p_payload ->> 'day') is distinct from p_day
    or (p_payload ->> 'version') is distinct from p_version::text
    or (p_payload ->> 'id') is distinct from 'daily:' || v_profile_id::text || ':' || p_day
  then
    raise exception 'Invalid daily session attribution or version' using errcode = '22023';
  end if;

  -- The insert handles the first writer. On conflict, PostgreSQL waits for an
  -- in-flight insert of the same key before continuing. FOR UPDATE then
  -- serializes all existing-row merges.
  insert into public.daily_sessions (profile_id, day, version, payload, updated_at)
  values (v_profile_id, p_day, p_version, p_payload, p_updated_at)
  on conflict (profile_id, day) do nothing;

  select payload, updated_at
    into v_existing, v_existing_updated_at
  from public.daily_sessions
  where profile_id = v_profile_id and day = p_day
  for update;

  if p_updated_at >= v_existing_updated_at then
    v_newer := p_payload;
    v_older := v_existing;
  else
    v_newer := v_existing;
    v_older := p_payload;
  end if;

  -- Keep the newer activity content/order, append activities only the older
  -- copy knows, and choose terminal evidence independently for every id.
  with newer_activities as (
    select activity, activity ->> 'id' as id, ordinal
    from jsonb_array_elements(coalesce(v_newer -> 'activities', '[]'::jsonb))
      with ordinality as entry(activity, ordinal)
  ),
  older_activities as (
    select activity, activity ->> 'id' as id, ordinal
    from jsonb_array_elements(coalesce(v_older -> 'activities', '[]'::jsonb))
      with ordinality as entry(activity, ordinal)
  ),
  paired as (
    select
      coalesce(n.id, o.id) as id,
      coalesce(n.activity, o.activity) as base_activity,
      n.activity as newer_activity,
      o.activity as older_activity,
      coalesce(n.ordinal, 1000000 + o.ordinal) as ordinal
    from newer_activities n
    full join older_activities o using (id)
  ),
  ranked as (
    select *,
      case coalesce(newer_activity ->> 'status', '')
        when 'completed' then 3 when 'technical-skip' then 2
        when 'active' then 1 else 0 end as newer_rank,
      case coalesce(older_activity ->> 'status', '')
        when 'completed' then 3 when 'technical-skip' then 2
        when 'active' then 1 else 0 end as older_rank
    from paired
  ),
  evidence as (
    select *,
      case
        when newer_activity is null then older_activity
        when older_activity is null then newer_activity
        when newer_rank >= older_rank then newer_activity
        else older_activity
      end as terminal_activity
    from ranked
  ), merged_pronunciation as (
    select *, case
      when newer_activity #> '{pronunciation,state}' is not null
       and older_activity #> '{pronunciation,state}' is not null
      then public.merge_daily_pronunciation_state(newer_activity #> '{pronunciation,state}', older_activity #> '{pronunciation,state}')
      else coalesce(newer_activity #> '{pronunciation,state}', older_activity #> '{pronunciation,state}')
    end as merged_state,
    case
      when newer_activity #> '{pronunciation,state}' is not null then newer_activity -> 'pronunciation'
      when older_activity #> '{pronunciation,state}' is not null then older_activity -> 'pronunciation'
      else coalesce(newer_activity -> 'pronunciation', older_activity -> 'pronunciation')
    end as pronunciation_base
    from evidence
  )
  select coalesce(
    jsonb_agg(
      (base_activity - 'status' - 'completedAt')
      || case
        when pronunciation_base is null then '{}'::jsonb
        when merged_state is not null then jsonb_build_object(
          'pronunciation', (pronunciation_base - 'state') || jsonb_build_object('state', merged_state)
        )
        else jsonb_build_object('pronunciation', pronunciation_base)
      end
      || jsonb_build_object('status', case
        when coalesce((merged_state ->> 'terminal')::boolean, false) and coalesce((merged_state ->> 'gradedTargets')::int, 0) > 0 then 'completed'
        when coalesce((merged_state ->> 'terminal')::boolean, false) then 'technical-skip'
        else terminal_activity ->> 'status' end)
      || case when terminal_activity ? 'completedAt'
        then jsonb_build_object('completedAt', terminal_activity -> 'completedAt')
        else '{}'::jsonb end
      order by ordinal
    ),
    '[]'::jsonb
  )
  into v_activities
  from merged_pronunciation;

  select activity ->> 'id'
    into v_current_activity_id
  from jsonb_array_elements(v_activities) with ordinality as entry(activity, activity_ordinal)
  where activity ->> 'status' in ('pending', 'active')
  order by activity_ordinal
  limit 1;

  v_merged := v_newer || jsonb_build_object(
    'profileId', v_profile_id::text,
    'id', 'daily:' || v_profile_id::text || ':' || p_day,
    'version', greatest((v_existing ->> 'version')::integer, p_version),
    'activities', v_activities,
    'currentActivityId', v_current_activity_id,
    'rewardClaimed',
      coalesce((v_existing ->> 'rewardClaimed')::boolean, false)
      or coalesce((p_payload ->> 'rewardClaimed')::boolean, false),
    'startedAt', least(
      (v_existing ->> 'startedAt')::bigint,
      (p_payload ->> 'startedAt')::bigint
    ),
    'completedAt', coalesce(
      (v_newer ->> 'completedAt')::bigint,
      (v_older ->> 'completedAt')::bigint
    ),
    'createdAt', least(
      (v_existing ->> 'createdAt')::bigint,
      (p_payload ->> 'createdAt')::bigint
    ),
    'updatedAt', greatest(v_existing_updated_at, p_updated_at)
  );

  update public.daily_sessions
  set version = greatest(version, p_version),
      payload = v_merged,
      updated_at = greatest(updated_at, p_updated_at)
  where profile_id = v_profile_id and day = p_day;

  return v_merged;
end;
$$;

revoke all on function public.merge_daily_session(text, integer, jsonb, bigint) from public;
grant execute on function public.merge_daily_session(text, integer, jsonb, bigint) to authenticated;
revoke all on function public.merge_daily_session(text, integer, jsonb, bigint) from anon;

-- profiles keys on id, not profile_id.
alter table public.profiles enable row level security;
drop policy if exists own_rows on public.profiles;
create policy own_rows on public.profiles for all to authenticated
  using (id = (select auth.uid())::text)
  with check (id = (select auth.uid())::text);

-- custom_lessons: everyone signed in may READ; only identities whose
-- server-controlled app_metadata.clara_role claim is "admin" may WRITE.
--
-- The write policies are scoped to INSERT/UPDATE/DELETE rather than FOR ALL: a
-- FOR ALL policy also matches SELECT, so every read evaluated both it and the
-- read policy for nothing.
alter table public.custom_lessons enable row level security;
drop policy if exists authenticated_only on public.custom_lessons;
drop policy if exists custom_lessons_read on public.custom_lessons;
drop policy if exists custom_lessons_write_admin on public.custom_lessons;
drop policy if exists custom_lessons_insert_admin on public.custom_lessons;
drop policy if exists custom_lessons_update_admin on public.custom_lessons;
drop policy if exists custom_lessons_delete_admin on public.custom_lessons;
create policy custom_lessons_read on public.custom_lessons
  for select to authenticated using (true);
create policy custom_lessons_insert_admin on public.custom_lessons
  for insert to authenticated
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'clara_role') = 'admin');
create policy custom_lessons_update_admin on public.custom_lessons
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'clara_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'clara_role') = 'admin');
create policy custom_lessons_delete_admin on public.custom_lessons
  for delete to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'clara_role') = 'admin');

-- push_subscriptions: deny ALL client roles. Written only by the server routes
-- with the service-role key (which bypasses RLS).
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_subscriptions_all" on public.push_subscriptions;
drop policy if exists no_client_access on public.push_subscriptions;
create policy no_client_access on public.push_subscriptions
  for all to anon, authenticated using (false) with check (false);

-- ── paid API usage windows (private; server RPC only) ───────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.api_usage_windows (
  window_scope text not null check (window_scope in ('user-day', 'global-minute')),
  route_id text not null check (route_id in (
    'assess', 'call-score', 'chat', 'grade', 'news', 'transcribe', 'tts',
    'virtual-call-report', 'virtual-call-turn'
  )),
  subject_id uuid not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (window_scope, route_id, subject_id, window_start)
);
alter table private.api_usage_windows enable row level security;
revoke all on table private.api_usage_windows from public, anon, authenticated, service_role;
create index if not exists api_usage_windows_expiry_idx
  on private.api_usage_windows (expires_at);

create or replace function public.consume_paid_api_quota(
  p_user_id uuid,
  p_route text,
  p_user_day_limit integer,
  p_global_minute_limit integer,
  p_now timestamptz default now()
)
returns table (allowed boolean, scope text, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_global_subject constant uuid := '00000000-0000-0000-0000-000000000000'::uuid;
  v_user_start timestamptz := pg_catalog.date_trunc('day', p_now at time zone 'UTC') at time zone 'UTC';
  v_global_start timestamptz := pg_catalog.date_trunc('minute', p_now);
  v_user_count integer := 0;
  v_global_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'invalid quota user' using errcode = '22023';
  end if;
  if p_route is null or p_route <> all (array[
    'assess', 'call-score', 'chat', 'grade', 'news', 'transcribe', 'tts',
    'virtual-call-report', 'virtual-call-turn'
  ]::text[]) then
    raise exception 'invalid quota route' using errcode = '22023';
  end if;
  if p_user_day_limit is null or p_user_day_limit < 1 or p_user_day_limit > 10000
     or p_global_minute_limit is null or p_global_minute_limit < 1 or p_global_minute_limit > 10000 then
    raise exception 'invalid quota limit' using errcode = '22023';
  end if;
  if p_now is null then
    raise exception 'invalid quota time' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'clara:quota:global:' || p_route || ':' ||
      pg_catalog.extract(epoch from v_global_start)::bigint::text, 0
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'clara:quota:user:' || p_route || ':' || p_user_id::text || ':' ||
      pg_catalog.extract(epoch from v_user_start)::bigint::text, 0
  ));

  select request_count into v_user_count
    from private.api_usage_windows
   where window_scope = 'user-day' and route_id = p_route
     and subject_id = p_user_id and window_start = v_user_start;
  select request_count into v_global_count
    from private.api_usage_windows
   where window_scope = 'global-minute' and route_id = p_route
     and subject_id = v_global_subject and window_start = v_global_start;
  v_user_count := pg_catalog.coalesce(v_user_count, 0);
  v_global_count := pg_catalog.coalesce(v_global_count, 0);

  if v_user_count >= p_user_day_limit then
    return query select false, 'user-day'::text,
      pg_catalog.greatest(1, pg_catalog.ceil(pg_catalog.extract(epoch from (v_user_start + interval '1 day' - p_now)))::integer);
    return;
  end if;
  if v_global_count >= p_global_minute_limit then
    return query select false, 'global-minute'::text,
      pg_catalog.greatest(1, pg_catalog.ceil(pg_catalog.extract(epoch from (v_global_start + interval '1 minute' - p_now)))::integer);
    return;
  end if;

  insert into private.api_usage_windows
    (window_scope, route_id, subject_id, window_start, request_count, expires_at)
  values ('user-day', p_route, p_user_id, v_user_start, 1, v_user_start + interval '2 days')
  on conflict (window_scope, route_id, subject_id, window_start)
  do update set request_count = private.api_usage_windows.request_count + 1, expires_at = excluded.expires_at;
  insert into private.api_usage_windows
    (window_scope, route_id, subject_id, window_start, request_count, expires_at)
  values ('global-minute', p_route, v_global_subject, v_global_start, 1, v_global_start + interval '2 hours')
  on conflict (window_scope, route_id, subject_id, window_start)
  do update set request_count = private.api_usage_windows.request_count + 1, expires_at = excluded.expires_at;

  return query select true, null::text, null::integer;
end;
$$;

revoke execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) from public;
revoke execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) from anon;
revoke execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) to service_role;

-- Trusted maintenance path: delete from private.api_usage_windows where expires_at < now();

-- Atomic, idempotent stage-exam completion. Ownership is derived from the
-- authenticated session; the client cannot choose another learner.
create or replace function public.guard_plain_passed_exam()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.passed and current_setting('clara.stage_exam_completion', true) is distinct from 'canonical' then
    raise exception 'Passed stage exams require canonical completion' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists exam_attempts_guard_plain_passed on public.exam_attempts;
create trigger exam_attempts_guard_plain_passed
before insert on public.exam_attempts
for each row execute function public.guard_plain_passed_exam();

drop function if exists public.complete_stage_exam(text, bigint, text, integer, boolean, jsonb, text, jsonb);
create or replace function public.complete_stage_exam(
  p_day text,
  p_at bigint,
  p_level text,
  p_score integer,
  p_passed boolean,
  p_sections jsonb,
  p_weakest text,
  p_target_level text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile_id text := (select auth.uid())::text;
  v_existing public.exam_attempts%rowtype;
  v_current_level text;
  v_expected_target text;
  v_settings_found boolean;
  v_existing_found boolean;
begin
  v_expected_target := case p_level when 'A0' then 'A1' when 'A1' then 'A2' when 'A2' then 'B1' when 'B1' then 'B2' when 'B2' then 'C1' when 'C1' then 'C2' else 'C2' end;
  if v_profile_id is null
    or p_day !~ '^\d{4}-\d{2}-\d{2}$'
    or p_at not between 946684800000 and 4102444800000
    or p_level not in ('A0','A1','A2','B1','B2','C1','C2')
    or p_score not between 70 and 100
    or p_passed is not true
    or p_target_level is distinct from v_expected_target
    or jsonb_typeof(p_sections) is distinct from 'object'
    or octet_length(p_sections::text) > 512
    or not p_sections ?& array['readAloud','repeat','build','shortAnswer','retell','openResponse']
    or p_sections - array['readAloud','repeat','build','shortAnswer','retell','openResponse']::text[] <> '{}'::jsonb
    or exists (
      select 1 from jsonb_each(p_sections) s
      where jsonb_typeof(s.value) <> 'number'
         or s.value::text !~ '^(100|[0-9]{1,2})$'
    )
    or (p_weakest is not null and p_weakest not in ('readAloud','repeat','build','shortAnswer','retell','openResponse'))
  then
    raise exception 'Invalid stage exam completion' using errcode = '22023';
  end if;

  select onboarding ->> 'level' into v_current_level
    from public.settings where profile_id = v_profile_id for update;
  v_settings_found := found;
  select * into v_existing from public.exam_attempts
    where profile_id = v_profile_id and day = p_day for update;
  v_existing_found := found;
  if v_existing_found then
    if v_existing.at <> p_at or v_existing.level <> p_level
      or v_existing.score <> p_score or v_existing.passed <> p_passed
      or v_existing.sections <> p_sections
      or v_existing.weakest is distinct from p_weakest
    then
      raise exception 'Conflicting stage exam replay' using errcode = '23505';
    end if;
    return;
  end if;
  if not v_settings_found or v_current_level not in ('A0','A1','A2','B1','B2','C1','C2') then
    raise exception 'Settings level unavailable' using errcode = '23503';
  end if;
  if v_current_level is distinct from p_level then
    raise exception 'Stage exam source level changed' using errcode = '40001';
  end if;
  perform set_config('clara.stage_exam_completion', 'canonical', true);
  insert into public.exam_attempts
    (profile_id, day, at, level, score, passed, sections, weakest)
  values
    (v_profile_id, p_day, p_at, p_level, p_score, p_passed, p_sections, p_weakest);
  update public.settings set onboarding = jsonb_set(onboarding, '{level}', to_jsonb(p_target_level), false), updated_at = p_at where profile_id = v_profile_id;
end;
$$;

revoke all on table public.exam_attempts from public, anon, authenticated;
revoke all on table public.settings from public, anon, authenticated;
grant select, insert on table public.exam_attempts to authenticated;
grant select, insert, update on table public.settings to authenticated;
grant usage, select on sequence public.exam_attempts_id_seq to authenticated;
alter table public.settings enable row level security;
drop policy if exists own_rows on public.settings;
drop policy if exists settings_select_own on public.settings;
drop policy if exists settings_insert_own on public.settings;
drop policy if exists settings_update_own on public.settings;
create policy settings_select_own on public.settings for select to authenticated using (profile_id = (select auth.uid())::text);
create policy settings_insert_own on public.settings for insert to authenticated with check (profile_id = (select auth.uid())::text);
create policy settings_update_own on public.settings for update to authenticated using (profile_id = (select auth.uid())::text) with check (profile_id = (select auth.uid())::text);
revoke all on function public.guard_plain_passed_exam() from public;
revoke all on function public.guard_plain_passed_exam() from anon;
revoke all on function public.guard_plain_passed_exam() from authenticated;
revoke all on function public.complete_stage_exam(text, bigint, text, integer, boolean, jsonb, text, text) from public;
revoke all on function public.complete_stage_exam(text, bigint, text, integer, boolean, jsonb, text, text) from anon;
grant execute on function public.complete_stage_exam(text, bigint, text, integer, boolean, jsonb, text, text) to authenticated;
