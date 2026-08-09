-- Durable, monotonic unlock evidence for Lumi's Closet.
-- Apply to the Clara Supabase project before deploying the matching app build.

alter table public.player_stats
  add column if not exists completed_daily_sessions integer not null default 0,
  add column if not exists unlocked_milestones text[] not null default '{}';

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_stats_completed_daily_sessions_nonnegative'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_completed_daily_sessions_nonnegative
      check (completed_daily_sessions >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_stats_unlocked_milestones_shape'
      and conrelid = 'public.player_stats'::regclass
  ) then
    alter table public.player_stats
      add constraint player_stats_unlocked_milestones_shape
      check (
        cardinality(unlocked_milestones) <= 64
        and octet_length(array_to_string(unlocked_milestones, ',')) <= 8256
        and (
          cardinality(unlocked_milestones) = 0
          or array_to_string(unlocked_milestones, ',') ~ '^[a-zA-Z0-9][a-zA-Z0-9:._/-]*(,[a-zA-Z0-9][a-zA-Z0-9:._/-]*)*$'
        )
      );
  end if;
end $$;

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
