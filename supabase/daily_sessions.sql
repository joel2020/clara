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
  if p_day is null or p_day = ''
    or p_version <> 1
    or p_payload ->> 'profileId' <> v_profile_id::text
    or p_payload ->> 'day' <> p_day
    or coalesce((p_payload ->> 'version')::integer, 0) <> p_version
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
  )
  select coalesce(
    jsonb_agg(
      (base_activity - 'status' - 'completedAt')
      || jsonb_build_object('status', terminal_activity ->> 'status')
      || case when terminal_activity ? 'completedAt'
        then jsonb_build_object('completedAt', terminal_activity -> 'completedAt')
        else '{}'::jsonb end
      order by ordinal
    ),
    '[]'::jsonb
  )
  into v_activities
  from evidence;

  select activity ->> 'id'
    into v_current_activity_id
  from jsonb_array_elements(v_activities) as activity
  where activity ->> 'status' in ('pending', 'active')
  limit 1;

  v_merged := v_newer || jsonb_build_object(
    'profileId', v_profile_id::text,
    'id', 'daily:' || v_profile_id::text || ':' || p_day,
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
