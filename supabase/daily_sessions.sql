create table if not exists public.daily_sessions (
  profile_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  version integer not null,
  payload jsonb not null,
  updated_at bigint not null,
  primary key (profile_id, day)
);
alter table public.daily_sessions enable row level security;
create policy daily_sessions_own_rows on public.daily_sessions
for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
