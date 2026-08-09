-- Atomic, idempotent stage-exam completion. Ownership is derived from the
-- authenticated session; the client cannot choose another learner.
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

  -- Serialize this learner's settings before examining or mutating attempts.
  -- An exact replay may return after promotion; a brand-new sitting must still
  -- match the transaction-fresh source level before any row is inserted.
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
