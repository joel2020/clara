-- Clara v7 — bounded pronunciation evidence.
--
-- Additive only: existing attempt rows stay readable with every new column NULL.
-- This file is an audit/deploy artifact; Release Task 3 applies and verifies it.
-- The April 2026 Data API default-grant change does not remove privileges from an
-- existing table, but the required client contract is made explicit below.

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

alter table public.attempts
  alter column score type double precision using score::double precision,
  alter column fluency type double precision using fluency::double precision,
  alter column pronunciation_score type double precision using pronunciation_score::double precision,
  alter column accuracy_score type double precision using accuracy_score::double precision,
  alter column completeness_score type double precision using completeness_score::double precision,
  alter column prosody_score type double precision using prosody_score::double precision,
  alter column target_phoneme_score type double precision using target_phoneme_score::double precision;

-- Replace the earlier weaker form when this migration is rerun on a preview
-- database. Existing legacy rows remain valid because NULL values pass checks.
alter table public.attempts
  drop constraint if exists attempts_technical_skip_has_no_weakness;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'attempts_policy_version_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_policy_version_check
      check (policy_version = 'latam-v1');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_provider_status_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_provider_status_check
      check (provider_status in ('valid', 'technical-skip', 'unavailable'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_pronunciation_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_pronunciation_score_bounds
      check (pronunciation_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_accuracy_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_accuracy_score_bounds
      check (accuracy_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_completeness_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_completeness_score_bounds
      check (completeness_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_prosody_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_prosody_score_bounds
      check (prosody_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_target_phoneme_score_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_target_phoneme_score_bounds
      check (target_phoneme_score between 0 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_weakest_phoneme_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_weakest_phoneme_bounds
      check (char_length(weakest_phoneme) between 1 and 64);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_weakest_word_bounds' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_weakest_word_bounds
      check (char_length(weakest_word) between 1 and 128);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_attempt_ordinal_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_attempt_ordinal_check
      check (attempt_ordinal in (1, 2, 3));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_pronunciation_outcome_check' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_pronunciation_outcome_check
      check (pronunciation_outcome in ('mastered', 'practiced-not-mastered', 'technical-skip'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_technical_skip_has_no_weakness' and conrelid = 'public.attempts'::regclass) then
    alter table public.attempts add constraint attempts_technical_skip_has_no_weakness
      check (
        (
          provider_status not in ('technical-skip', 'unavailable')
          and pronunciation_outcome is distinct from 'technical-skip'
        )
        or (
          (provider_status in ('technical-skip', 'unavailable') or pronunciation_outcome = 'technical-skip')
          and score is null and fluency is null and pronunciation_score is null
          and accuracy_score is null
          and completeness_score is null
          and prosody_score is null
          and target_phoneme_score is null
          and weakest_phoneme is null
          and weakest_word is null
          and passed is not true
          and pronunciation_outcome is distinct from 'mastered'
        )
      );
  end if;
end $$;

create unique index if not exists attempts_profile_client_id_uniq
  on public.attempts(profile_id, client_attempt_id)
  where client_attempt_id is not null;
create index if not exists attempts_profile_weak_sound_idx
  on public.attempts(profile_id, weakest_phoneme, at desc)
  where provider_status = 'valid'
    and pronunciation_outcome is distinct from 'technical-skip'
    and weakest_phoneme is not null;
create index if not exists progress_profile_due_at_idx
  on public.progress(profile_id, due_at)
  where due_at is not null;

-- Attempts are append-only through the client: owners may read and insert only.
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

revoke all on table public.attempts from public;
revoke all on table public.attempts from anon;
revoke update, delete, truncate, references, trigger on table public.attempts from authenticated;
grant select, insert on table public.attempts to authenticated;
grant usage on sequence public.attempts_id_seq to authenticated;
