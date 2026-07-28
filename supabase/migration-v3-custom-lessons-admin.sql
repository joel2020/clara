-- Clara v3 — custom_lessons: writes are teacher-only.
--
-- Why: signup is open at the Supabase level, so "authenticated" is NOT the same
-- as "allowlisted student" — any self-registered account could previously
-- insert/overwrite/delete curriculum rows with the public anon key (the
-- security advisor flagged the USING(true) policy). Lessons are shared content:
-- everyone signed in may READ them, only the teacher's accounts may WRITE.
--
-- The email list mirrors ADMIN_EMAILS in lib/allowlist.ts — keep them in sync.

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
