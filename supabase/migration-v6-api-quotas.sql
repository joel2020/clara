-- Planned existing-project migration: durable paid API quotas.
-- Do not apply independently of the reviewed production release procedure.

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

  -- Every caller locks global then user. The consistent order prevents
  -- deadlocks, while the transaction locks prevent two concurrent requests
  -- from both consuming the final slot in either window.
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
   where window_scope = 'user-day'
     and route_id = p_route
     and subject_id = p_user_id
     and window_start = v_user_start;
  select request_count into v_global_count
    from private.api_usage_windows
   where window_scope = 'global-minute'
     and route_id = p_route
     and subject_id = v_global_subject
     and window_start = v_global_start;

  v_user_count := pg_catalog.coalesce(v_user_count, 0);
  v_global_count := pg_catalog.coalesce(v_global_count, 0);

  -- Both decisions happen before either write, so exhausting one scope never
  -- consumes capacity from the other scope.
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
  values
    ('user-day', p_route, p_user_id, v_user_start, 1, v_user_start + interval '2 days')
  on conflict (window_scope, route_id, subject_id, window_start)
  do update set
    request_count = private.api_usage_windows.request_count + 1,
    expires_at = excluded.expires_at;

  insert into private.api_usage_windows
    (window_scope, route_id, subject_id, window_start, request_count, expires_at)
  values
    ('global-minute', p_route, v_global_subject, v_global_start, 1, v_global_start + interval '2 hours')
  on conflict (window_scope, route_id, subject_id, window_start)
  do update set
    request_count = private.api_usage_windows.request_count + 1,
    expires_at = excluded.expires_at;

  return query select true, null::text, null::integer;
end;
$$;

revoke execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) from public;
revoke execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) from anon;
revoke execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) from authenticated;
grant execute on function public.consume_paid_api_quota(uuid, text, integer, integer, timestamptz) to service_role;

-- Maintenance path (run from a trusted scheduled database job or owner session):
-- delete from private.api_usage_windows where expires_at < now();
