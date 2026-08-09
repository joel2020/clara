-- Clara v3 — custom_lessons: writes are teacher-only.
-- HISTORICAL / NON-AUTHORITATIVE: retained as audit history only. Do not replay
-- this file for rebuild or recovery; use current-schema.sql. Migration v5
-- replaces this email-based policy with the server-controlled admin claim.
--
-- Why: signup is open at the Supabase level, so "authenticated" is NOT the same
-- as "allowlisted student" — any self-registered account could previously
-- insert/overwrite/delete curriculum rows with the public anon key (the
-- security advisor flagged the USING(true) policy). Lessons are shared content:
-- everyone signed in may READ them, only the teacher's accounts may WRITE.
--
-- Historical context: v3 embedded the teacher email list directly in this JWT
-- predicate. V5 replaced that design with a server-controlled role claim.

alter table public.custom_lessons enable row level security;
drop policy if exists authenticated_only on public.custom_lessons;
drop policy if exists custom_lessons_read on public.custom_lessons;
drop policy if exists custom_lessons_write_admin on public.custom_lessons;

create policy custom_lessons_read on public.custom_lessons
  for select to authenticated
  using (true);

create policy custom_lessons_write_admin on public.custom_lessons
  for all to authenticated
  using (
    (auth.jwt() ->> 'email') in ('alivio.studio.ops@gmail.com', 'joelcarias23@gmail.com')
  )
  with check (
    (auth.jwt() ->> 'email') in ('alivio.studio.ops@gmail.com', 'joelcarias23@gmail.com')
  );
