# Clara — American English, for real conversations

A warm, gamified, mobile-first app that helps native **Colombian Spanish speakers**
become **conversational in American English** — listening, speaking with real
pronunciation scoring, live AI conversation, video and music practice, and an
adaptive path that meets each learner at their level.

The core loop: **hear the native model → say it → get scored on what was actually
heard → converse and use it for real.** Lumi (the study buddy) and a full game
layer (XP, stars, streaks, a shop, pets) keep it a habit, not a chore.

---

## Quick start (local dev)

Use Node.js **24.19.0** locally (the version in `.nvmrc`) and in CI. Vercel only
supports selecting the `24.x` major line, so `package.json` intentionally keeps
`engines.node` at `24.x`; verify the exact patch reported in each release's
Vercel build log before promotion.

```bash
nvm use
npm install
npm run dev            # http://localhost:3000
npm run build          # production build (also full typecheck)
```

**Auth is bypassed locally when no Supabase env vars are set** — the login gate
only activates when `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` exist. With those set
(as in `.env.local`), local dev shows the real login gate too.

Type/logic tests (Node strips TS types; no test runner needed):

```bash
npm test                         # the whole unit suite
node lib/placement.test.mjs      # or run one alias-free file directly
npx tsx lib/scoring.test.mjs     # files importing through "@/" or "./x.ts" need tsx
```

---

## Environment variables

All secrets live in `.env.local` (git-ignored) locally and in the **Vercel
project env** for production. `NEXT_PUBLIC_*` are exposed to the browser by
design (Supabase URL + anon key, VAPID public key); everything else is
**server-only — never prefix a secret with `NEXT_PUBLIC_`.**

| Variable | Used for | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (auth + RLS-scoped data) | public |
| `SUPABASE_SERVICE_ROLE_KEY` | Durable API quotas and trusted admin/push operations | server-only secret |
| `ALLOWED_EMAILS` | Comma-separated invited learner emails | server |
| `OPENAI_API_KEY` | AI conversation (`/api/chat`) + news rewrites (`/api/news`) | server |
| `ELEVENLABS_API_KEY` | Joel's TTS voice (`/api/tts`) + iOS transcription (`/api/transcribe`) | server |
| `AZURE_SPEECH_KEY` | Phoneme-level pronunciation scoring (`/api/assess`) | server |
| `AZURE_SPEECH_REGION` | Azure Speech region (e.g. `eastus`) | server |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push subscription (needed at **build** time) | public |
| `VAPID_PRIVATE_KEY` | Web Push signing (`/api/push/send` cron) | server |
| `VAPID_SUBJECT` | Web Push contact (`mailto:...`) | server |
| `CRON_SECRET` | Guards the daily-reminder cron | server |

Every route degrades gracefully: if a key is absent, the feature reports "not
configured" and the rest of the app keeps working.

---

## Authentication & access

- **Supabase Auth, email + password** (magic links break out of an installed iOS
  PWA, so password is the default). Session persisted client-side; the whole app
  is wrapped in `AuthProvider` → `AuthGate` (`app/layout.tsx`).
- **Server-side allowlist** (`lib/allowlist.ts`): sign-up is open, but only
  allow-listed emails can enter the app or hit the paid AI routes — a stranger
  who self-registers gets a "no access" screen and every paid route returns 403.
  The learner list lives in the **`ALLOWED_EMAILS` env var** (comma-separated,
  server-only — student emails are personal data and no longer live in code or
  the client bundle; the UI asks `/api/me` for its own flags). Admin capability
  comes from the server-verified Supabase `app_metadata.clara_role = "admin"`
  claim and also grants access without a learner-list entry.
  Grant or revoke that role only through Supabase's server-controlled raw app
  metadata (`raw_app_meta_data`), never user-editable user metadata. The user's
  current JWT can retain the old claim until it is refreshed, so require them to
  sign out and back in after every admin-role change.
  **Add a student = add their email to `ALLOWED_EMAILS` in the Vercel env and
  redeploy. With the variable unset in production, every non-admin account is
  denied (fails closed).**
- **Paid routes are protected** (`lib/api-guard.ts` + `lib/auth-server.ts` +
  `lib/api-quota.ts`): exact same-origin check, then one valid Supabase
  session/allowlist identity check, then atomic per-user and global durable
  quotas. Unauthenticated → 401, non-allowlisted → 403, cross-origin → 403,
  exhausted quota → 429. There is no cross-user IP bucket because a classroom
  commonly shares one NAT address.
- **Account = identity.** After login, `components/profile-binder.tsx` sets
  `profile_id = auth.user.id`, retiring the old passwordless "sync code" model.

> Production also has Vercel Deployment Protection to consider: it must be
> **off** for the app to be publicly reachable (Settings → Deployment Protection).

---

## Database & migrations (Supabase)

Postgres tables are keyed by `profile_id` (= the authenticated user's id). To
create or recover an empty project, execute **only**
`supabase/current-schema.sql` in the Supabase SQL editor. It is the authoritative,
idempotent snapshot and includes the tables, indexes, functions, RLS enablement,
and policies required by the application.

Every other SQL file under `supabase/` is non-authoritative audit history for an
upgrade that happened over time. Never replay that historical chain to rebuild or
recover a database. Existing-project upgrades use only the migration explicitly
approved by the release procedure, and its final definitions must also be mirrored
into the authoritative snapshot.

Data flow is **cloud-authoritative**: the phone is a cache re-seeded from
Supabase on every launch (`lib/sync/restore.ts` `hydrateFromCloud`), with an
`updatedAt` tiebreak so offline work is preserved. Local reads stay instant via
Dexie/IndexedDB behind the `DataRepository` interface (`lib/db/`).

---

## Adaptive onboarding & placement

New learners get a 5–8 min Spanish flow (`components/onboarding-flow.tsx`):
name → country/city (default Colombia/Medellín) → goal → daily minutes →
self-level → an **adaptive placement check** (`lib/placement.ts`, unit-tested)
that gets harder/easier per answer and assigns a **CEFR level (A0–C1)** with
per-skill subscores and a personalized first week (`lib/onboarding.ts`).

The level then drives the experience: the daily lesson picker walks a
level-appropriate pool (`lib/today.ts` `pickNextLesson`), and the AI conversation
(`/api/chat`) pitches vocabulary/pace/difficulty to the level and leans into the
learner's goal. Existing users skip onboarding and can run it from **/profile →
retake placement**.

---

## Learning surfaces

- **Lessons** — conversation units (chunks-first) + phonics contrast sets, staged
  Learn → Ear → Words → Sentences, SRS-ordered (`lib/srs.ts`). Scoring adapts to
  recent performance (`lib/adaptive.ts`, "auto" difficulty).
- **/talk** — live AI conversation as Joel (level- and goal-adaptive, weaves in
  weak words). **The moat.**
- **Pronunciation scoring** — Web Speech (desktop) or record-and-transcribe
  (iOS); phoneme-level accuracy via **Azure** when configured (`/api/assess`).
- **/radio, /shadow, /duet, /listen, /build, /play** — passive listening,
  shadowing, roleplay, ear-training, sentence-building, speed rounds.
- **/media** — official educational video + music practice ("watch → catch →
  say → use"); no copyrighted content is downloaded or rehosted.
- **Game layer** — XP/levels/streaks, stars, a shop with cosmetics + pets, daily
  chest, quests. Voice throughout is mostly **Joel's cloned voice** with an
  American cast mixed in.

---

## Analytics & insights

Privacy-respecting event logging (`lib/analytics.ts`, ids/numbers only) —
local-first with a best-effort per-user cloud mirror (needs `events.sql`).
Funnel: `app_open`, `lesson_start/complete/abandon`, `mode_open`. Rollups
(`lib/insights.ts`, tested): active days, pass rate, score trend, completion
rate, top modes — surfaced on the instructor **/dashboard**.

---

## Audio generation

The "Listen" model is **Joel's cloned ElevenLabs voice**, pre-generated to static
MP3s in `public/audio/` (offline-safe, every browser). After editing the
curriculum:

```bash
# needs ELEVENLABS_API_KEY in .env.local
node scripts/generate-audio.mjs          # English/cast clips (skips existing)
node scripts/generate-es-audio.mjs       # Spanish meaning clips (Lisa voice)
```

These rewrite `lib/content/*-audio-manifest.ts`, which the player checks to pick
Joel's voice vs the browser fallback. Note: relative imports in Node scripts use
explicit `.ts` extensions (`allowImportingTsExtensions` in tsconfig).

---

## Deploying to Vercel

Git-connected: **push to `main` auto-builds and deploys to production.** For a
first-time or config change:

1. Set all env vars above in the Vercel project (Production + Preview).
2. Set the Vercel project Node.js version to `24.x`, then confirm the actual
   Node patch in the deployment build log. Vercel advances minor/patch versions
   within the selected major and does not support an exact patch selection.
3. Ensure Deployment Protection is off for public access.
4. For a new Supabase project, create the database from the single authoritative
   schema named above. For an existing project, apply only the migration approved
   for that release; never replay the historical SQL chain.
5. `git push origin main` → Vercel builds (Turbopack) and deploys.
6. Verify: root 200, `/api/assess` `{enabled:true}`, `/api/chat` (no auth) → 401.

Commits are authored `46899218+joel2020@users.noreply.github.com` so Vercel can
associate the committer (otherwise deploys block with `COMMIT_AUTHOR_REQUIRED`).

---

## Architecture

```
app/                 App Router pages + API routes (chat, tts, assess, transcribe, news, push)
components/
  auth-gate, login-screen, profile-binder, onboarding-flow, insights-panel
  practice/          the core loop (listen, distinguish, produce, session)
lib/
  db/                DataRepository interface + Dexie impl + Supabase client + types
  sync/              cloud-authoritative sync (restore/hydrate), durability
  hooks/             useAuth, useSettings, usePlayer, useData
  content/           curriculum (conversation, phonics, placement questions, es glosses)
  placement.ts, onboarding.ts   CEFR engine + level/goal plan
  adaptive.ts, srs.ts, practice.ts, gamification.ts   learning + game logic
  analytics.ts, insights.ts     instrumentation
  allowlist.ts, api-guard.ts, auth-server.ts, auth-client.ts   access control
supabase/            SQL: schema + migrations (see Database section)
```

**Principle:** components never touch the database directly — they go through the
`DataRepository` interface (writes) and reactive hooks (reads). Auth and the paid
API routes are protected in depth (origin + rate limit + session + allowlist).

---

## Tech stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind v4 · Dexie
(IndexedDB, local cache) · **Supabase** (Auth + Postgres + RLS, source of truth)
· OpenAI (gpt-4o-mini + gpt-image-1) · ElevenLabs (voice) · Azure AI Speech
(phoneme scoring) · Web Push · deployed on **Vercel**.
