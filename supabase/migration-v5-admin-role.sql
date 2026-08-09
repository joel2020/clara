-- Clara v5 — unify custom-lesson writes on the server-controlled admin claim.
--
-- This is the planned, auditable upgrade for the existing project. Do not apply
-- it ad hoc: the production release procedure reviews and applies it before the
-- matching application build is promoted. New or recovered projects run only
-- current-schema.sql; historical migrations are not a rebuild path.

alter table public.custom_lessons enable row level security;

-- Remove every prior admin write-policy shape so no email-based policy remains.
drop policy if exists custom_lessons_write_admin on public.custom_lessons;
drop policy if exists custom_lessons_insert_admin on public.custom_lessons;
drop policy if exists custom_lessons_update_admin on public.custom_lessons;
drop policy if exists custom_lessons_delete_admin on public.custom_lessons;

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
