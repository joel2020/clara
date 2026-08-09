create table if not exists public.daily_sessions (
  profile_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  version integer not null,
  payload jsonb not null,
  updated_at bigint not null,
  primary key (profile_id, day)
);
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
-- Supabase's default grants hand `anon` execute on new public functions, so the
-- revoke from `public` above is not enough on its own. The function already
-- fails closed (it raises when auth.uid() is null), but deny anon explicitly.
revoke all on function public.merge_daily_session(text, integer, jsonb, bigint) from anon;
