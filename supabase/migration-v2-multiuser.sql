-- Clara v2 — per-user Row Level Security.
--
-- ORDER MATTERS. Apply this ONLY AFTER the ProfileBinder app change is deployed,
-- because it makes profile_id = auth.uid() and this policy rejects any write
-- whose profile_id isn't the caller's own id. Before that deploy, the live app
-- still writes sync-code profile_ids and would be locked out. Until then the
-- permissive public_all policy stays in place.
--
-- Data was already consolidated into each user's auth-id profile via REST
-- (Mariana: 3000 stars, 1084 XP, 66 lessons under a0087329-…).

-- ── User-owned tables: profile_id (or id) must equal the caller's auth uid ────
-- NOTE: push_subscriptions is intentionally EXCLUDED here. It's written
-- server-side by /api/push with the anon key (no user JWT), so strict RLS would
-- break daily reminders. Harden it separately by moving those routes to a
-- server-only service-role key, then add it to this list. Its rows hold only
-- Web Push endpoints (low sensitivity), so leaving its current policy is fine.
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

-- profiles keys on id, not profile_id
alter table public.profiles enable row level security;
drop policy if exists public_all on public.profiles;
drop policy if exists own_rows on public.profiles;
create policy own_rows on public.profiles for all to authenticated
  using (id = auth.uid()::text)
  with check (id = auth.uid()::text);

-- ── Notes / follow-ups before flipping this on ───────────────────────────────
-- 1. push_subscriptions: /api/push writes these server-side. That route must
--    forward the user's JWT (createClient with the caller's access token) OR
--    use a service-role key server-only, or these inserts will fail under RLS.
-- 2. custom_lessons (instructor content) is NOT user-owned; keep it readable to
--    authenticated users (separate policy) or leave as-is — decide at cutover.
-- 3. The anon role loses table access entirely (intended). The read-only probes
--    (/api/assess GET, /api/push GET) don't touch these tables, so they're fine.
-- 4. Verify after applying: sign in as Mariana, confirm 3000 stars + progress
--    load; sign in as a second test account, confirm it CANNOT see her rows.
