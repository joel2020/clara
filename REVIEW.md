# Clara — Full Codebase Review

Date: 2026-07-27 · Reviewed at commit `620710b` · ~25k LOC (166 TS/TSX files)
Scope: architecture, correctness, security, data layer, performance, quality, tests.
Live Supabase state (project `nwjtvlvzbfrlzgxiqzgd`) was verified read-only via MCP
where findings depended on it; anything not verifiable is flagged as such.

---

## Executive summary

**Overall health: good — unusually good for a solo project.** The layering is real
(components → `DataRepository` → Dexie, pure tested libs, guarded API routes),
361 unit checks pass, CI runs typecheck/lint-ratchet/tests/build, and the live
database has correct per-user RLS with sensible indexes. Comments are honest and
the code mostly does what they say.

**Biggest risks, in order:**

1. **The stage exam silently asks only 1 of its 2 open-response questions** —
   the highest-weighted section is graded on half the intended evidence, and
   sittings are one-per-day and permanent (P0-1).
2. **Two unauthenticated API routes**: `/api/push` (writes to the DB with the
   service-role key on behalf of any caller, with a caller-chosen `profile_id`)
   and `/api/news` (spends OpenAI money with no auth). The README's claim that
   paid/serviced routes are guarded is not true for these two (P1-2, P1-7).
3. **Any self-registered stranger can rewrite the curriculum**: signup is open,
   `custom_lessons` live policy is `authenticated → USING(true)`, and
   "Instructor mode" is a self-serve client toggle. The accepted-risk note on
   commit `be02688` assumed only trusted students are authenticated — that
   premise is wrong (P1-3).
4. **Next.js 16.2.9 carries nine known advisories** (middleware bypass, cache
   confusion, SSRF, DoS), fixed in 16.2.12 (P1-4).
5. **Every app launch downloads the full attempts history** and throws it away —
   unbounded growth in launch time and egress (P1-5).

Nothing found qualifies as "actively exploited / data already lost." The deliberate
design decisions in HANDOFF.md (exams write no SRS, silent mic scores zero, forced
null correction on calls, token ceiling 2000) were treated as intentional and are
not findings.

**Couldn't verify** (flagged, not guessed):
- Whether `CRON_SECRET` is actually set in Vercel (if not, `/api/push/send` is open — P1-6).
- Whether Vercel Deployment Protection is off and a WAF rate limit exists (the in-memory limiter is per-instance by design).
- `SUPABASE_SERVICE_ROLE_KEY` presence in prod (commit `be02688` says confirmed; not re-checkable from here).

---

## P0 — broken or exploitable

### P0-1 · Exam: only 1 of 2 open-response questions is ever asked
- **Where:** [app/exam/page.tsx:141](app/exam/page.tsx#L141) and [app/exam/page.tsx:372](app/exam/page.tsx#L372), vs [lib/exams.ts:36](lib/exams.ts#L36) and [lib/exam-compose.ts:115](lib/exam-compose.ts#L115)
- **What:** `SECTIONS` declares `openResponse: { items: 2 }`; `composeExam` picks two
  prompts and joins them with `" | "`; the page even splits the prompt by `" | "`
  indexed by `itemIdx` (line 374). But both `advance()` (line 141) and `totalItems`
  (line 372) hard-code open response to **1 item**, so `itemIdx` never reaches the
  second question. Additionally, `speakAndScore` sends the *whole* joined prompt
  (both questions) to `/api/grade` (line 197) while the student only saw/answered
  the first — the grader judges her answer against a two-question prompt.
- **Why it matters:** openResponse carries weight 1.5 (highest, tied with retell)
  in `scoreExam`, sittings are one per day, results are permanent and drive
  promotion and the recruiter report. A section meant to sample two answers is
  graded on one, against a mismatched prompt.
- **Fix:** derive the item count from the section itself:
  `const promptCount = section.prompt?.split(" | ").length ?? 1;`
  `const total = section.items.length || promptCount;` in both places, and pass
  `openPrompt` (the current split question) to `/api/grade` instead of `section.prompt`.

---

## P1 — fix this sprint

### P1-2 · `/api/push` is unauthenticated and writes with the service-role key
- **Where:** [app/api/push/route.ts:36](app/api/push/route.ts#L36) (POST), [app/api/push/route.ts:67](app/api/push/route.ts#L67) (DELETE)
- **What:** No `guardApi`, no `requireUser`. The route upserts caller-supplied
  `subscription` + `profileId` into `push_subscriptions` using the service-role
  key (which exists precisely because the table denies client roles). DELETE
  removes any row by endpoint.
- **Why it matters:** (a) anyone can fill the table with junk rows; (b) anyone who
  knows/guesses a student's UUID can register *their own* device against her
  `profile_id` — the daily cron ([app/api/push/send/route.ts:88-92](app/api/push/send/route.ts#L88))
  then pushes her **name and streak** to the attacker's device: a small but real
  PII leak; (c) anyone who learns an endpoint can silence a student's reminders.
  Locking the table server-side and then exposing an unauthenticated server writer
  re-opens the same door the RLS fix closed.
- **Fix:** apply `guardApi` + `requireUser` to POST and DELETE; take `profile_id`
  from the authenticated session (not the body); on DELETE, only delete rows whose
  `profile_id` matches the caller (or endpoint match + session).

### P1-3 · Any authenticated account can rewrite the shared curriculum
- **Where:** live policy `custom_lessons.authenticated_only USING(true) WITH CHECK(true)`
  (verified via MCP; Supabase security advisor flags it too), plus
  [app/instructor/page.tsx:16-27](app/instructor/page.tsx#L16) ("Turn on Instructor mode" is a
  one-tap client toggle available to any signed-in user).
- **What:** Signup is open by design ([lib/allowlist.ts:3-5](lib/allowlist.ts#L3)). The allowlist
  gates the *app UI* and *paid routes*, but not direct PostgREST access: a stranger
  who self-registers is `authenticated` and can insert/overwrite/delete
  `custom_lessons` rows with the public anon key. The accepted-risk note in commit
  `be02688` ("they are named, trusted individuals") assumed authenticated ⇒
  allowlisted, which open signup makes false.
- **Why it matters:** curriculum vandalism/defacement visible to all students, by
  an unauthenticated-in-spirit actor. Cheap to do, annoying to detect.
- **Fix:** authorize custom-lesson writes and server admin routes from the
  server-controlled `app_metadata.clara_role` JWT claim. Never derive the role
  from an email address or user-editable metadata. Gate the instructor UI from
  the same server-derived access flag — students shouldn't see teaching tools.

### P1-4 · Next.js 16.2.9 has nine known advisories — upgrade to 16.2.12
- **Where:** [package.json:26](package.json#L26); `npm audit` output.
- **What:** GHSA-6gpp-xcg3-4w24 (middleware/proxy bypass on Turbopack), two cache
  confusion advisories, two SSRF, DoS via Server Actions and image SVGs,
  unauthenticated disclosure of server-function endpoints; plus vulnerable
  transitive `postcss`/`sharp`. All fixed in 16.2.12 (same minor).
- **Why it matters:** Clara has no middleware and no Server Actions, so several
  don't apply directly — but the image optimizer and cache-confusion ones plausibly
  do, and staying on a known-vulnerable release of the framework serving an
  auth-gated app is not worth the diff.
- **Fix:** `npm install next@16.2.12 eslint-config-next@16.2.12` then `npm run verify`.
  Also `npm audit fix` for `brace-expansion`/`fast-uri`/`@hono/node-server`
  transitives. *(Left out of the quick-win phase per your no-dependency-changes rule.)*

### P1-5 · Every launch downloads the full attempts history, then discards it
- **Where:** [lib/sync/restore.ts:106](lib/sync/restore.ts#L106) → [lib/sync/supabase-sync.ts:272-276](lib/sync/supabase-sync.ts#L272)
- **What:** `hydrateFromCloud` (run on **every** app open via `useSettings`,
  [lib/hooks/useSettings.tsx:55](lib/hooks/useSettings.tsx#L55)) calls `pullProfileData`, which does
  `attempts.select("*").order(...)` with no limit — but hydrate only uses
  `player` and `progress`; `data.attempts` is never read.
- **Why it matters:** attempts are append-only and grow with every rep. A student
  a year in has tens of thousands of rows fetched over mobile data on every
  launch, for nothing. It's also the single query most likely to make launch feel
  slow as usage compounds.
- **Fix:** split the pull: `pullPlayerAndProgress()` for hydrate;
  `pullProfileData()` (with attempts) only for the cold-cache `restoreProfile`
  path. One function split, no schema change.

### P1-6 · Daily-reminder cron endpoint fails open without `CRON_SECRET`
- **Where:** [app/api/push/send/route.ts:58-61](app/api/push/send/route.ts#L58)
- **What:** `if (secret && auth !== ...)` — when the env var is absent, the check
  is skipped entirely and anyone can GET the route: fire notifications to every
  student, at any hour, repeatedly (also burning function time reading the table).
- **Why it matters:** misconfiguration silently becomes exposure. I could not
  verify whether `CRON_SECRET` is set in Vercel — if it is, this is latent, not live.
- **Fix:** fail closed: `if (!secret || request.headers.get("authorization") !== \`Bearer ${secret}\`) return 401;`
  Vercel Cron sends the header automatically when the env var exists.

### P1-7 · `/api/news` is a paid route with no guard at all
- **Where:** [app/api/news/route.ts:56](app/api/news/route.ts#L56)
- **What:** No `guardApi`, no `requireUser`. It calls OpenAI on cache miss; the
  cache is in-memory **per serverless instance**, so "6-hour cache" is per warm
  instance, not global — a scripted caller rotating over cold instances triggers
  repeated model calls.
- **Why it matters:** small spend (gpt-4o-mini, 3 headlines) but it contradicts
  the stated invariant that money-spending routes are guarded, and it's the same
  three-line fix as the others.
- **Fix:** add `guardApi(request)` + `await requireUser(request)` like every other
  paid route. (GET semantics: the client already sends auth headers elsewhere;
  or convert to POST for consistency.)

---

## P2 — worth doing

### P2-1 · Origin check bypassable via `localhost.evil.com`
- **Where:** [lib/api-guard.ts:54](lib/api-guard.ts#L54)
- **What:** `oHost.startsWith("localhost")` accepts any host whose name *begins*
  with the string — `localhost.evil.com` passes. The layer is defense-in-depth
  (auth still required behind it), but the check as written doesn't do what the
  comment says.
- **Fix:** `const h = oHost.split(":")[0]; if (oHost !== host && h !== "localhost" && h !== "127.0.0.1") return deny(...)`.

### P2-2 · Auth fails open if Supabase env vars are missing in production
- **Where:** [lib/auth-server.ts:14-16](lib/auth-server.ts#L14), used at [lib/auth-server.ts:39](lib/auth-server.ts#L39)
- **What:** `authRequired()` is false when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`
  are unset, and `requireUser` then returns null (allow). Deliberate for local dev
  — but a bad deploy (env var typo, new environment) silently turns every paid
  route public, with no signal.
- **Fix:** in production only, treat missing Supabase env as deny:
  `if (!authRequired()) return process.env.NODE_ENV === "production" ? deny401 : null;`
  (or log loudly at startup). Keeps the dev ergonomics, removes the silent fail-open.

### P2-3 · Instructor lessons sync up but never down; deletes never sync
- **Where:** [lib/sync/supabase-sync.ts:218-222](lib/sync/supabase-sync.ts#L218) (push only — no pull function exists),
  [lib/hooks/useLessons.ts:12-16](lib/hooks/useLessons.ts#L12) (reads local Dexie only),
  [lib/db/dexie-repository.ts:69-71](lib/db/dexie-repository.ts#L69) (delete is local-only)
- **What:** `pushCustomLesson` mirrors to the cloud, but nothing ever reads
  `custom_lessons` back — a lesson authored on Joel's laptop never reaches
  Mariana's phone, which defeats the stated purpose of commit `be02688`
  ("sync instructor lessons"). And when a pull *is* added, local deletes will
  resurrect because deletion isn't mirrored.
- **Fix:** add `pullCustomLessons()` to the hydrate path (merge by `updated_at`),
  and mirror `deleteCustomLesson` with a cloud delete.

### P2-4 · Side effect inside a React state updater double-fires the chat call in dev
- **Where:** [app/talk/page.tsx:290-294](app/talk/page.tsx#L290)
- **What:** `addHerLine` calls `void send(clean, next)` *inside* the `setTurns`
  updater. Updaters must be pure; React StrictMode (on by default in dev)
  double-invokes them, so every spoken line sends **two** `/api/chat` requests in
  dev, and the pattern is a latent footgun for concurrent rendering generally.
- **Fix:** compute `next` outside: `const next = [...turnsRef.current, ...]` or
  `setTurns(prev => { ... return next; })` followed by `send` in the event handler
  using the locally-built array (you already have `clean`; build `next` from a ref
  or from the previous state captured before the set).

### P2-5 · `/api/call-score` throws 500 on malformed turns
- **Where:** [app/api/call-score/route.ts:80-88](app/api/call-score/route.ts#L80)
- **What:** `t.text.toLowerCase()` runs before any validation and outside the
  try/catch — a body like `{turns:[{role:"agent"}]}` crashes the route with an
  unhandled TypeError instead of a 400.
- **Fix:** filter/validate on entry: `turns = (body.turns ?? []).filter(t => t && typeof t.text === "string" && (t.role === "agent" || t.role === "customer"))`.

### P2-6 · Repo SQL cannot rebuild the live database (migration drift)
- **Where:** `supabase/` vs live schema (verified via MCP)
- **What:** Five synced tables — `exam_attempts`, `call_scores`, `talk_sessions`,
  `conv_items`, `quests` — have **no DDL in the repo at all**; `attempts.fluency`
  and the extended `settings` columns exist only live; `schema.sql` and
  `push_subscriptions.sql` still contain the old permissive policies that the live
  DB no longer has. `lib/sync/schema.test.mjs` hard-codes the live schema as a
  transcription, which guards writes but is not a rebuild path.
- **Why it matters:** a fresh environment (staging, disaster recovery, a second
  instructor) cannot be recreated from the repo, and the checked-in SQL actively
  misleads (it would *reintroduce* the permissive policies if replayed).
- **Fix:** snapshot the live DDL into ordered migration files (the Supabase CLI's
  `db diff`/`db dump` or MCP `list_tables` output), and update the two stale
  policy files to match what `be02688` actually applied.

### P2-7 · `getAttempts` loads the whole table into memory on every call
- **Where:** [lib/db/dexie-repository.ts:30-44](lib/db/dexie-repository.ts#L30) (also `getCategoryStats`, line 169)
- **What:** `orderBy("at").reverse().toArray()` then JS-filters — despite indexes
  on `itemId`/`categoryId`/`at` declared in [lib/db/dexie.ts:29](lib/db/dexie.ts#L29) precisely
  for these queries. Called with `{limit: 15}` on **every practice attempt**
  ([lib/practice.ts:44](lib/practice.ts#L44)).
- **Fix:** use the indexes: `db.attempts.orderBy("at").reverse().limit(n)` when
  only a limit is given; `db.attempts.where("categoryId").equals(...)` for
  category queries. Matters increasingly as history grows (compounds with P1-5's
  restored full history).

### P2-8 · `player_stats` is upserted twice per attempt
- **Where:** [lib/practice.ts:101](lib/practice.ts#L101) and [lib/db/dexie-repository.ts:92-102](lib/db/dexie-repository.ts#L92)
- **What:** `savePlayerStats` mirrors to the cloud internally, and
  `recordPracticeAttempt` then calls `pushPlayer` again with the same stats —
  two identical network upserts per rep.
- **Fix:** delete the explicit `pushPlayer` in `practice.ts` (the repository
  mirror is the one every write path shares).

### P2-9 · Core scoring/game logic has zero tests
- **Where:** `lib/speech/scoring.ts`, `lib/srs.ts`, `lib/gamification.ts`, `lib/adaptive.ts`
- **What:** The suite (361 checks) covers placement, exams, readiness, report,
  paths, insights, sync-schema — but not the code that decides **pass/fail**
  (thresholds, minimal-pair detection, phrase fuzzy matching), **SRS box moves**,
  or **streak/freeze arithmetic** (`applyAttempt` has date-boundary logic —
  freezes, `dayGap`, midnight rollover — that is exactly the kind of thing that
  regresses silently). These are pure functions; they are cheap to test in the
  existing `.test.mjs` style.
- **Fix:** add `scoring.test.mjs`, `srs.test.mjs`, `gamification.test.mjs`
  covering: word vs phrase thresholds ± ease, partner-detection edges, box
  promotion/demotion bounds, streak continue/freeze/reset across day gaps.

---

## P3 — nits and notes

1. **Stale `note` in the open-response delay** — [app/exam/page.tsx:214](app/exam/page.tsx#L214): the
   ternary reads `note` from the closure *before* `setNote(graded.fix)` renders, so
   the grader's feedback shows for 500ms, not 1800ms. Use `graded.fix` directly.
2. **Dead component** — [components/onboarding.tsx](components/onboarding.tsx) (236 lines, the old
   sync-code restore flow) is imported nowhere. Delete it; `restoreProfile` remains
   used by `useSettings`.
3. **`.env.example` documents 5 of ~13 vars** — missing `AZURE_SPEECH_KEY/REGION`,
   `AZURE_OPENAI_*`, VAPID trio, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, all of
   which the README documents. Cheap to fix, prevents a broken first deploy.
4. **API errors swallowed without server-side logging** — e.g.
   [app/api/chat/route.ts:280-282](app/api/chat/route.ts#L280): `catch { return 502 }` leaves nothing in
   Vercel logs. Client-side errors go to the events table, but *server* failures
   (Azure quota, bad deployment name) are invisible. Add `console.error(...)`
   before each 502 return.
5. **`restoreProfile` can duplicate attempts** — [lib/sync/restore.ts:73](lib/sync/restore.ts#L73):
   `bulkAdd` on an auto-increment key appends; if the local cache is partially
   populated (name lost but attempts present), history doubles. Guard with a
   count check or dedupe on `at`.
6. **Stale metadata title** — [app/layout.tsx:35](app/layout.tsx#L35): "English pronunciation
   course" predates the conversation-app positioning.
7. **`VAPID_SUBJECT` falls back to `mailto:hello@example.com`** —
   [app/api/push/send/route.ts:71](app/api/push/send/route.ts#L71): push services use this to contact you;
   a placeholder can get pushes throttled. Fail closed like the other env vars.
8. **Supabase Auth: leaked-password protection is disabled** (live advisor).
   One dashboard toggle; open signup makes it worth flipping.
9. **Doc drift on test counts** — HANDOFF says 217 checks; the suite now runs 361.
   README's "38/13 assertions" is also stale. Not a code issue; worth a sweep when
   HANDOFF is next updated.
10. **`maximumScale: 1`** — [app/layout.tsx:57](app/layout.tsx#L57): blocks pinch-zoom (WCAG 1.4.4).
    The comment says it's deliberate (iOS mic-tap zoom); noting the tradeoff, not
    contesting it.
11. **Trust-model note, not a bug:** exam grading is client-orchestrated —
    `/api/grade` trusts client-supplied prompt/transcript, and sittings are saved
    from the client. Fine for two trusted students; would need server-side
    orchestration before any wider rollout.
12. **`x-forwarded-for` first-hop trust** — [lib/api-guard.ts:59](lib/api-guard.ts#L59): fine behind
    Vercel's proxy; would be spoofable elsewhere. Documented limitation.

---

## Dimension summaries

**1. Architecture** — Clean and consistent: pages/components never touch Dexie or
Supabase directly (`DataRepository` + hooks), learning logic is pure and
dependency-light by policy (`lib/paths.ts` bare-node constraint is honored), API
routes share one guard stack. The one real boundary break is the exam page
re-deriving section item counts instead of reading the `SECTIONS` spec (the P0).
The duplicated onboarding component (P3-2) and up-only custom-lesson sync (P2-3)
are the remaining wrong-place/incomplete-pattern items.

**2. Correctness** — One P0 (exam), a handful of P2s. Streak/SRS/scoring logic
reads correctly on inspection but is untested (P2-9). Loading/empty states are
consistently handled (`Splash`, `not_configured` degradation).

**3. Security** — Layered and mostly right: origin check → rate limit → session →
allowlist on paid routes; RLS verified correct live; secrets server-side only; no
`dangerouslySetInnerHTML`; no PII in analytics props by construction. The gaps are
the two unguarded routes (P1-2, P1-7), the curriculum-write hole (P1-3), fail-open
patterns (P1-6, P2-2), and the framework CVEs (P1-4).

**4. Data layer** — Live schema is well-designed: correct composite PKs, natural
keys for idempotent sync upserts (`ignoreDuplicates` on append-only history),
indexes matching every query pattern I checked. Main issues: repo/live drift
(P2-6) and the unbounded attempts pull (P1-5). The `bg()` sync-failure surfacing
is a genuinely good pattern.

**5. Performance** — Fine for the current scale. The items that compound with
usage: P1-5 (network), P2-7 (IndexedDB scans), P2-8 (duplicate upserts). The 98MB
of pre-generated audio in `public/` is a deliberate offline-safety tradeoff and
served from CDN; ~250KB of curriculum TS ships in the client bundle, acceptable.
No memoization problems worth flagging in the components read.

**6. Quality** — High. Comments explain *why* and match the code (rare). The lint
ratchet (11 reviewed advisories, baseline enforced) is an honest compromise.
Naming is consistent. Dead code: one component (P3-2).

**7. Tests** — 361 checks, all passing, plus two clever meta-tests (schema
transcription guard, sync-coverage guard) that catch the silent-failure class
supabase-js invites. CI runs the full verify pipeline on every push. The gap is
inverted coverage: the newest features (exams, readiness, report) are well tested
while the oldest core (scoring, SRS, gamification) has none (P2-9). API routes
have no tests at all — acceptable at this scale given the env-gating, worth a
smoke test if the route count grows.
