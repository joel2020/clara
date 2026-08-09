# Clara — production readiness

Last verified: 2026-07-30, commit `2db5052` (the daily-classroom rebuild).

The daily-classroom rebuild shipped on 2026-07-30. What changed operationally:

- **New table `daily_sessions`** with own-rows-only RLS and a `merge_daily_session`
  RPC (security invoker, ownership from `auth.uid()`, granted to `authenticated`,
  revoked from `public` and `anon`). Applied and verified in production.
- **`events` gained three rollup indexes**; its RLS policy is unchanged.
- **`player_stats` gained `avatar_base`, `equipped_avatar_outfit`, `equipped_cap`**
  (nullable, no backfill needed).
- Migration verification on the live database, before and after: attempts 601,
  progress 245, profiles 16, player_stats 8, settings 10 — all unchanged. RLS
  enabled with exactly one policy on every table.
- Analytics now go through a closed event schema (`lib/analytics-schema.ts`).
  Invalid events are dropped before any local or cloud write, and no event type
  can carry a transcript, audio, voice, email, or free text.

Rollback: promote the previous production deployment (`2997e20`) in the Vercel
dashboard. The schema changes are additive, so the older build ignores the new
columns rather than failing on them. No learner data needs migrating backwards.

The app is live and serving two students. This file records what has been
verified, how to verify it again, and the few things only the account owner can
do. It is a checklist, not a status badge — re-run the checks after any change
to auth, the database, or the environment.

---

## Verify the deployment (2 minutes)

```bash
nvm use                 # local/CI runtime is pinned to Node 24.19.0
npm run verify          # typecheck -> lint ratchet -> full unit suite -> production build
```

Vercel supports selecting only the Node `24.x` major line and automatically
updates its minor/patch runtime. Keep `package.json` at `24.x`; for every release,
confirm the actual Node patch in the Vercel build log and record it with the
deployment evidence before promotion.

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
returns 403. Paid routes stack an exact same-origin check, one session/allowlist
identity check, and durable user/day plus global/minute quotas.
`requireAllowedUserIdentity` fails **closed** if Supabase env or
`ALLOWED_EMAILS` is missing, so a bad deploy cannot silently make the AI routes
public. To add a student, add their email to `ALLOWED_EMAILS` in Vercel and
redeploy. Admin capability comes from the server-verified Supabase
`app_metadata.clara_role = "admin"` claim and bypasses the learner allowlist.
Grant and revoke it only in Supabase's server-controlled raw app metadata, never
user-editable user metadata. JWT claims can remain stale until refresh, so every
admin-role change requires the affected user to sign out and back in.

**Database.** Per-user RLS on all eleven user tables (`profile_id = auth.uid()`)
was verified against the live database at the date above. `push_subscriptions`
denies every client role and is written only by server routes holding the
service-role key. The repository target makes `custom_lessons` readable by any
signed-in student and writable only when the server-controlled
`app_metadata.clara_role` claim is `admin`. `auth.uid()` and the stable JWT lookup
are hoisted into InitPlans so they are evaluated once per query rather than once
per row. This admin-claim policy is not live until Release Task 3 applies and
verifies the planned migration; this foundation task did not change production.

**Database recovery.** Create an empty project only from
`supabase/current-schema.sql`. All other SQL files in that directory are
non-authoritative audit history and must not be replayed as a rebuild chain. The
planned existing-project changes are `supabase/migration-v5-admin-role.sql` and
then `supabase/migration-v6-api-quotas.sql`; do not apply either independently of
the reviewed release procedure.

**Paid API quotas.** The reviewed budgets below support one normal lesson, many
pronunciation retries, and one 30-turn virtual call without leaving grading or
report endpoints unnecessarily open. They are enforced per route in one atomic
database transaction; if either scope is exhausted, neither counter increments.

| Route | Per learner / UTC day | Global / minute |
| --- | ---: | ---: |
| assess | 180 | 120 |
| call-score | 12 | 15 |
| chat | 100 | 80 |
| grade | 24 | 20 |
| news | 8 | 15 |
| transcribe | 220 | 150 |
| tts | 220 | 150 |
| virtual-call-report | 8 | 15 |
| virtual-call-turn | 100 | 90 |

Quota storage holds only a UUID, bounded route/scope IDs, window timestamps,
counts, and expiry. The table is private; only the service-role RPC can consume
quota. Missing configuration, unavailable storage, RPC failures, and malformed
decisions return `quota_unavailable` with 503. Exhaustion returns
`rate_limited` with 429 and an integer `Retry-After`.

Run expired-window maintenance from a trusted database owner/scheduled job:
`delete from private.api_usage_windows where expires_at < now();`. No scheduler
is installed by this repository task. In an incident, disable the affected
provider key/deployment in its provider dashboard first; the application will
then fail closed while the cause is investigated.

**Failure visibility.** Sync writes surface errors rather than resolving silently
(supabase-js resolves with `{error}`; a swallowed one means lost data with no
signal). Upstream API failures log server-side. Uncaught client errors land in
the events table and surface on `/coach`. The reminder cron refuses loudly and
names the missing variable instead of quietly not sending.

**Tests and CI.** The complete discovered unit suite covers scoring, SRS, and
the streak/freeze arithmetic that the practice loop depends on. GitHub Actions
uses Node 24.19.0 and runs typecheck, the lint ratchet, tests, a production
dependency audit, and a full build on every push. CI needs no secrets — every
integration is env-gated, so an unkeyed build still succeeds.

## Observability and alerting

Sentry error and route-performance reporting is disabled unless its DSN is
present. Configure these names separately in Vercel Preview and Production;
never copy their values into this repository, support tickets, or screenshots:

- `SENTRY_DSN` for the server and edge runtimes.
- `NEXT_PUBLIC_SENTRY_DSN` for the browser. This is intentionally public, but
  the CSP accepts only the exact validated Sentry ingestion origin encoded in
  it.
- `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` for build-time source
  map upload. Source maps are deleted after upload and are not served publicly.
- `NEXT_PUBLIC_CLARA_BUILD_ID` is the common release identifier; Vercel's Git
  commit SHA supplies it automatically in deployments.

Default PII collection and local-variable capture are off. A shared processor
removes authorization headers, cookies, user fields, email addresses, request
bodies and query strings, transcripts, and voice/audio content from errors,
transactions, breadcrumbs, contexts, and extra data. AI provider integrations
are removed from Sentry entirely so prompts, learner speech, and model output
cannot be recorded. Production performance sampling is 10%; it is zero in
unconfigured and non-production environments.

Before inviting students, create and test these alerts:

1. Sentry error-rate regression, grouped by release and environment.
2. Sentry p95 latency regression for `/api/assess`.
3. Sync-failure alert from the existing sync error signal.
4. Provider billing alerts for daily and monthly spend anomalies in each AI and
   speech provider dashboard. Provider cost limits do not belong in Sentry.

Alert payloads and destinations must not include transcripts, recordings,
emails, tokens, or cookies. Trigger a synthetic scrubbed error in Preview and
inspect the resulting event before enabling Sentry in Production.

---

## Owner-only steps

These need your Google/Supabase/Vercel accounts and cannot be automated from the
codebase.

1. **Manage the admin role in server-controlled metadata.** Supabase →
   Authentication → Users → select the user → edit raw app metadata, setting
   `clara_role` to `admin` to grant access or removing it to revoke access. Never
   put authorization data in user metadata. Then have the user sign out and back
   in so their JWT receives the new claim; until refresh, an existing token can
   carry the previous role.

2. **Enable leaked-password protection.** Supabase → Authentication → Policies →
   turn on the HaveIBeenPwned check. This is the only outstanding security
   advisor. It matters more than usual because sign-up is open.

3. **Allow the auth redirect URLs.** Supabase → Authentication → URL
   Configuration → Redirect URLs must include:
   ```
   https://clara-joel-carias-projects.vercel.app/reset
   https://clara-joel-carias-projects.vercel.app/auth/callback
   http://localhost:3001/reset
   http://localhost:3001/auth/callback
   ```
   Without these the password-reset and Google links bounce.

4. **Google sign-in (optional).** Create an OAuth client in Google Cloud Console
   with redirect URI `https://nwjtvlvzbfrlzgxiqzgd.supabase.co/auth/v1/callback`,
   paste its ID and secret into Supabase → Authentication → Providers → Google,
   then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in Vercel and redeploy (it is
   read at build time). Until then the button stays hidden on purpose:
   `signInWithOAuth` navigates away instantly, so an unconfigured provider would
   strand a student on a raw JSON error page with no way back.

5. **Confirm `CRON_SECRET` and `VAPID_SUBJECT` are set in Vercel.** Both are now
   required — reminders refuse to send without them, by design, and say so in the
   logs. `/api/health` shows both.

6. **Real-device QA of `/exam` and `/call`.** Neither has been through a full run
   with a real microphone on a real iPhone. This is the largest untested surface
   in the app and needs a person and a phone.

7. **Apply and verify durable quota DDL.** During the reviewed release, apply
   `migration-v6-api-quotas.sql` after the admin-role migration. Verify that
   `anon` and `authenticated` cannot read the private table or execute the RPC,
   while a server service-role call can consume one test window. Configure the
   maintenance deletion path, then verify a 429 boundary and a forced 503 in
   Preview before Production.

   `SUPABASE_SERVICE_ROLE_KEY` is required in the server environment for durable
   quota consumption and trusted admin/push operations. It bypasses RLS: never
   expose it to the browser, prefix it with `NEXT_PUBLIC_`, paste it into logs or
   screenshots, or use it from client code.

8. **Set provider caps and alert ownership.** In Azure Speech, OpenAI/Azure
   OpenAI, and ElevenLabs, set hard spend/usage caps where supported plus daily
   and monthly anomaly alerts. The app owner is the initial alert owner and must
   name a backup before student launch. Exercise each alert in Preview; never put
   account values, credentials, transcripts, or recordings in alert payloads.

---

## Known limits

- **There is intentionally no application-wide IP quota.** Schools, offices,
  and families often share one NAT address; a cross-user IP bucket can block a
  legitimate classroom or let one student deny service to everyone behind it.
  Supabase user/day and global/minute windows are the application source of
  truth. Provider hard caps and carefully reviewed Vercel WAF controls remain
  external emergency defenses.
- **Exam grading is client-orchestrated.** `/api/grade` trusts the transcript and
  prompt the client sends, and sittings are written from the client. Fine for
  named, trusted students; it would need server-side orchestration before any
  wider rollout.
- **Adding a student is a deploy.** Add their email to `ALLOWED_EMAILS` in the
  deployment environment and redeploy.
- **iOS PWA and OAuth.** An OAuth redirect can bounce out of the installed PWA
  into Safari, which is why email+password remains and is the reliable path on
  a student's phone.
