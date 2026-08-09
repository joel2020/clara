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
  -- Text-free correction evidence only: bounded kind + fixed-on-retry flags.
  corrections jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  vocabulary_used jsonb not null default '[]'::jsonb,
  -- Safe cue identities plus numeric scripted outcomes. No word or sentence text.
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
