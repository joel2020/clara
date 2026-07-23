-- Clara v2 — apply BOTH migrations in one paste.
-- Run this whole file in the Clara SQL editor:
--   https://supabase.com/dashboard/project/nwjtvlvzbfrlzgxiqzgd/sql/new
-- Safe + idempotent: re-running changes nothing. Order is correct as written.

-- ── 1) Per-user Row Level Security ───────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['attempts','progress','player_stats','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists public_all on public.%I', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format(
      'create policy own_rows on public.%I for all to authenticated
         using (profile_id = auth.uid()::text)
         with check (profile_id = auth.uid()::text)', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists public_all on public.profiles;
drop policy if exists own_rows on public.profiles;
create policy own_rows on public.profiles for all to authenticated
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- ── 2) Analytics events table ────────────────────────────────────────────────
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
alter table public.events enable row level security;
drop policy if exists own_rows on public.events;
create policy own_rows on public.events for all to authenticated
  using (profile_id = auth.uid()::text)
  with check (profile_id = auth.uid()::text);
