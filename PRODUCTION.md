# Clara — production readiness

Last verified: 2026-07-28, commit `5480d49`.

The app is live and serving two students. This file records what has been
verified, how to verify it again, and the few things only the account owner can
do. It is a checklist, not a status badge — re-run the checks after any change
to auth, the database, or the environment.

---

## Verify the deployment (2 minutes)

```bash
npm run verify          # typecheck -> lint ratchet -> 440 tests -> production build
```

Then, against the live site:

```bash
U=https://clara-joel-carias-projects.vercel.app
curl -s -o /dev/null -w "%{http_code}\n" $U/                      # 200
curl -s $U/api/assess                                             # {"enabled":true}
curl -s -o /dev/null -w "%{http_code}\n" -X POST $U/api/chat      # 403 (no Origin)
curl -s -o /dev/null -w "%{http_code}\n" $U/api/health            # 403 unless admin
```

**`/api/health` is the fastest way to answer "is production wired up?"** Sign in
as an admin and open it: it reports whether every integration is configured, as
booleans only (never keys, prefixes, or lengths). `ok:false` means a student
would notice something broken; `remindersReady:false` means the daily nudge is
off.

---

## What is verified

**Access control.** Supabase email+password and (when enabled) Google, then a
server-side allowlist. Sign-up is open, so the allowlist — not secrecy — is the
gate: a stranger who registers reaches a "no access" screen and every paid route
returns 403. Paid routes stack same-origin check, per-IP rate limit, session, and
allowlist. `requireUser` fails **closed** in production if Supabase env is
missing, so a bad deploy cannot silently make the AI routes public.

**Database.** Per-user RLS on all eleven user tables (`profile_id = auth.uid()`),
verified against the live database. `push_subscriptions` denies every client role
and is written only by server routes holding the service-role key.
`custom_lessons` is readable by any signed-in student and writable only by the
teacher accounts. `auth.uid()` is hoisted into an InitPlan so it is evaluated
once per query rather than once per row. Supabase advisors report zero security
or performance warnings other than the dashboard toggle below.

**Failure visibility.** Sync writes surface errors rather than resolving silently
(supabase-js resolves with `{error}`; a swallowed one means lost data with no
signal). Upstream API failures log server-side. Uncaught client errors land in
the events table and surface on `/coach`. The reminder cron refuses loudly and
names the missing variable instead of quietly not sending.

**Tests and CI.** 440 checks across 16 files, all green, including the scoring,
SRS, and streak/freeze arithmetic that the practice loop depends on. GitHub
Actions runs typecheck, the lint ratchet, tests, and a full build on every push.
CI needs no secrets — every integration is env-gated, so an unkeyed build still
succeeds.

---

## Owner-only steps

These need your Google/Supabase/Vercel accounts and cannot be automated from the
codebase.

1. **Enable leaked-password protection.** Supabase → Authentication → Policies →
   turn on the HaveIBeenPwned check. This is the only outstanding security
   advisor. It matters more than usual because sign-up is open.

2. **Allow the auth redirect URLs.** Supabase → Authentication → URL
   Configuration → Redirect URLs must include:
   ```
   https://clara-joel-carias-projects.vercel.app/reset
   https://clara-joel-carias-projects.vercel.app/auth/callback
   http://localhost:3001/reset
   http://localhost:3001/auth/callback
   ```
   Without these the password-reset and Google links bounce.

3. **Google sign-in (optional).** Create an OAuth client in Google Cloud Console
   with redirect URI `https://nwjtvlvzbfrlzgxiqzgd.supabase.co/auth/v1/callback`,
   paste its ID and secret into Supabase → Authentication → Providers → Google,
   then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Vercel and redeploy (it is
   read at build time). Until then the button stays hidden on purpose:
   `signInWithOAuth` navigates away instantly, so an unconfigured provider would
   strand a student on a raw JSON error page with no way back.

4. **Confirm `CRON_SECRET` and `VAPID_SUBJECT` are set in Vercel.** Both are now
   required — reminders refuse to send without them, by design, and say so in the
   logs. `/api/health` shows both.

5. **Real-device QA of `/exam` and `/call`.** Neither has been through a full run
   with a real microphone on a real iPhone. This is the largest untested surface
   in the app and needs a person and a phone.

---

## Known limits

- **Rate limiting is per serverless instance.** The in-memory window stops the
  "someone found the URL and looped it" case, not a distributed one. The hard
  global limit belongs at the Vercel WAF.
- **Exam grading is client-orchestrated.** `/api/grade` trusts the transcript and
  prompt the client sends, and sittings are written from the client. Fine for
  named, trusted students; it would need server-side orchestration before any
  wider rollout.
- **Adding a student is a deploy.** Their email goes in `lib/allowlist.ts`.
- **iOS PWA and OAuth.** An OAuth redirect can bounce out of the installed PWA
  into Safari, which is why email+password remains and is the reliable path on
  a student's phone.
