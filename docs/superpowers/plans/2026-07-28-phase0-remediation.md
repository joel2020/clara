# Phase 0 remediation plan — 2026-07-28

Source: `/Users/joel/clara-audit/CLARA-PRODUCT-AUDIT.md`. Every finding below was
re-verified against HEAD (`1cbdb31`) before planning; the audit ran against a
slightly older tree (Google login and the RLS hoist landed since), and every
Phase 0 finding is still present. Baseline is clean: 440/440 checks, tsc clean,
lint at baseline 11, production build green.

Branch: `worktree-phase0-remediation` (isolated worktree).

## Findings → fixes

### WS1 — Single-user identity residue (audit P0)
- **Evidence**: `lib/content/scenarios.ts:29-86` (roles/settings/starters/openers
  name Mariana; starters render as Talk reply chips — live-confirmed against a
  user named Sofía in the audit), `lib/content/conversation.ts:49`,
  `conversation-2.ts:316,321`, `conversation-support.ts:66` (drill items),
  `components/login-screen.tsx:129`, `components/onboarding-flow.tsx:261`,
  `components/instructor/voice-settings.tsx:46` (placeholders),
  `app/call/page.tsx:97` (name fallback).
- **Root cause**: content authored for one known learner; no personalization
  layer for scenario text.
- **Fix**: new `lib/personalize.ts` (`{name}` token + neutral fallback);
  scenarios rewritten student-neutral; drill items renamed to the curriculum
  character "Ana" with audio regenerated (EN clips × voices + ES meaning clips —
  audio is keyed by item id, so stale clips must be deleted and regenerated);
  placeholders neutralized; call fallback neutralized.
- **Tests**: new `lib/content/content-lint.test.mjs` — no learner-facing string
  in any content field, placeholder, or prompt template may contain a real
  student identity; personalize() unit tests.
- **Risk**: audio regeneration needs `ELEVENLABS_API_KEY` (present in
  `.env.local`); if generation fails, changed items must not ship with stale
  "Mariana" audio — fallback is to keep old text until audio exists (verify).

### WS2 — Broken authoring artifact (audit P0)
- **Evidence**: `conversation-2.ts:355` hint ends `"'foun' con h muda... no, 'f'."`
- **Fix**: correct hint; sweep all content for `... no,`-style self-corrections,
  TODO/placeholder residue, malformed IPA.
- **Tests**: content lint patterns.

### WS3 — Harmful pronunciation guidance (audit P1)
- **Evidence**: z-for-θ hints (`conversation-2.ts:70,218,239`), j-for-h
  respellings (~15 hints incl. `jelp-mi`, `nid-JELP`, `jom`, `jau`, `jus`,
  `jir-mi`, `jaf`, `jaus`, `jai-po-zé`), British /ɒ/ in `lessons.ts` (16) and
  `conversation-support.ts` (22).
- **Root cause**: Spanish-orthography respelling convention that contradicts the
  sound track's own lessons (`th`, `h`); early files transcribed from a British
  dictionary source.
- **Fix**: replace wrong-sound respellings with articulatory cues that match the
  sound lessons; keep linking/stress cues; /ɒ/ → /ɑ(ː)/. Explicitly correct
  negative contrasts ("'zink' no — lengua entre los dientes") are kept: they
  name the error, they don't prescribe it. New
  `docs/pronunciation-standard.md` for future authors.
- **Tests**: content lint bans the known-bad respellings in prescriptive
  position and bans British-only IPA symbols in `ipa` fields.
- **Risk**: hints are learner-visible; wording verified against GenAm references
  (see standard doc) rather than invented.

### WS4 — Cross-account local-data bleed (audit P1)
- **Evidence**: single global Dexie DB `"clara"` (`lib/db/dexie.ts:26`);
  `signOut` never clears it (`lib/hooks/useAuth.tsx:136-139`); `ProfileBinder`
  rebinds `profileId` over existing rows (`components/profile-binder.tsx:38`);
  hydrate keeps "fresher" local rows (`lib/sync/restore.ts:127-141`) so user A's
  data can mirror up under user B.
- **Root cause**: storage is device-scoped, not account-scoped.
- **Fix**: account-scoped databases — `clara-u-<userId>` per authenticated
  account, legacy `"clara"` retained for authless/local mode. A `DataScope`
  binding step inside `AuthGate` opens the right DB before any data-consuming
  render and keys the subtree by account id so live queries re-subscribe.
  One-time migration copies the legacy DB into the account DB **only when the
  legacy `settings.profileId` matches that account** (or legacy data is
  unbound pre-auth data on a device whose first login claims it); otherwise the
  legacy DB is left untouched. Nothing is deleted. Sign-out keeps the old
  account's DB bound until the next login (late writes stay attributed to their
  author; the login gate unmounts all data-consuming UI).
- **Tests**: `lib/db/scope.test.mjs` pure-logic tests for db naming, migration
  decision (A→B, unbound legacy, returning A), plus live browser verification
  of A → sign out → B on the dev server (fake-IndexedDB switching).
- **Risk**: existing devices carry data in the legacy DB — the migration
  decision must claim it for the matching account only. No data deleted.

### WS5 — Sync/restore data-loss paths (audit P1)
- **Evidence**: all push functions fire-and-forget with no retry
  (`lib/sync/supabase-sync.ts:49-62`); `lastFailure` recorded but never
  replayed; `hydrateFromCloud` deliberately excludes attempts
  (`lib/sync/restore.ts:118-123`) and the attempts-inclusive `restoreProfile`
  only runs from the legacy sync-code path — a fresh device login restores
  everything except attempt history.
- **Fix**: Dexie v9 `outbox` table; failed row-inserts (attempts, exam
  attempts, call scores, talk sessions) are enqueued with payload + kind +
  tries and replayed on app start, on `online`, and after any successful push;
  replays are idempotent (`ignoreDuplicates` natural keys already exist for
  exam/call/talk; attempts get a client id). First bind of an **empty** account
  DB runs the full `restoreProfile` (attempts included) instead of the
  attempts-less hydrate. Settings page shows a calm "pendiente de sincronizar"
  count when the outbox is non-empty.
- **Tests**: outbox decision/replay logic unit tests with injected failures
  (push fn that rejects N times), restore-selection logic test.
- **Risk**: replay must not duplicate rows → natural-key upserts; attempts
  insert gains a `client_id` used as conflict key only if the column exists
  (tiered payload, same pattern as `pushPlayer`); SQL migration file provided
  as an operational step, code tolerates its absence.

### WS6 — High-stakes grading integrity (audit P1)
- **Evidence**: retell scored client-side by order-independent substring
  keyword bag (`lib/exam-compose.ts:136-141`, used at `app/exam/page.tsx:197`)
  even though a CEFR-aware LLM grader exists and is already used for
  openResponse; grader network failure records a hard 0
  (`app/exam/page.tsx:206-207`) and burns the daily attempt.
- **Fix**: retell goes through `/api/grade` (kind "retell" already implemented
  server-side). New pure decision module `lib/exam-grading.ts`:
  capture-failure → 0 (anti-cheat, unchanged); grader unavailable/malformed →
  **void the sitting** — nothing recorded, daily attempt not consumed, bilingual
  explanation, retry offered. Grade path (`llm` / `mechanical` / `azure` /
  `transcript`) logged per section into the exam attempt's local record.
  Grader prompt hardened: word-salad/keyword-list answers, negated answers,
  off-topic answers with expected vocabulary score low; learner text is data,
  not instructions.
- **Tests**: decision-module unit tests (all failure shapes); live adversarial
  probe against `/api/grade` on the dev server (keyword salad, repetition,
  negation, off-topic, injection) recorded in the report.
- **Risk**: existing recorded exam results are NOT invalidated or migrated
  (explicitly out of scope without approval). Voiding requires the one-per-day
  check to key off *recorded* sittings — verified in `lib/exams.ts`.

### WS7 — No error boundaries (audit P1)
- **Evidence**: no `error.tsx`/`global-error.tsx`/`not-found.tsx` under `app/`.
- **Fix**: add all three — bilingual, calm, "Reintentar" (router reset) +
  "Volver al inicio", digest-only logging (no transcript/name/audio in logs).
- **Tests**: dev-mode thrown-render-error page verified in browser; 404 route
  verified.

### WS8 — Privacy, consent, PII (audit P0)
- **Evidence**: no privacy/consent surface anywhere; voice audio flows to
  Azure (`/api/assess`), ElevenLabs (`/api/transcribe`), text to OpenAI
  (`/api/chat`, `/api/grade`, `/api/news`); five real student emails hardcoded
  in `lib/allowlist.ts:13-19,28` (also shipped in the client bundle, since
  `isAdmin` is imported client-side) and duplicated in
  `supabase/current-schema.sql:249-255`.
- **Fix**: `/privacidad` static bilingual page describing, from verified code
  behavior only: what is captured, when recording starts, which processors see
  what, what Clara stores (scores/transcripts locally + synced; raw audio only
  transiently except on-device voice journal), deletion path (contact +
  in-app reset), mic-denied behavior, non-voice usage. Linked from login
  footer, settings, and the consent sheet. One-time bilingual consent sheet
  before the first microphone capture (per device+account), stored in Settings
  as `voiceConsent {version, at}`; synced when the cloud column exists
  (tiered payload; SQL migration provided as an operational step). Decline →
  voice features stay blocked with a gentle notice; the rest of the app works.
  Allowlist/admin emails move to server env (`ALLOWED_EMAILS`, `ADMIN_EMAILS`)
  with the current lists as the documented value to set — **enforcement
  unchanged, fails closed in production if unset**; client-side admin UI
  visibility switches from a bundled email list to a tiny authenticated
  `/api/me` (`{admin}`) check. Emails scrubbed from `supabase/current-schema.sql`
  (placeholder + operational note) and anywhere else greppable.
- **Not done here (flagged)**: no legal review — the report lists every
  statement requiring counsel; no retention claims invented (where behavior is
  unknown, the page says so).
- **Risk**: env-based allowlist requires setting Vercel env before next deploy
  — called out as a hard operational step; production fails closed (503-style
  no-access) rather than open if missing.

## Order
1. WS1+WS2 (identity + artifacts — one content pass, one lint test)
2. WS3 (pronunciation — same files, builds on the lint test)
3. WS4 (storage isolation)
4. WS5 (sync durability — depends on WS4's scoped DBs)
5. WS6 (grading integrity)
6. WS7 (error boundaries)
7. WS8 (privacy/consent/PII — touches auth + settings last, after storage
   isolation has settled the Settings shape)
8. WS9 (end-to-end verification + report)

Rationale for deviating from the suggested order only in placing WS7 after
WS6: error boundaries are independent, and grading integrity touches the same
exam page — doing WS6 first avoids re-testing the exam journey twice.

## Quality gates (every WS)
Reproduce → failing/absent test → smallest fix → focused tests → full
`npm test` + `tsc` + lint ratchet → build → affected journey in browser at
390×844 and 1440×900 → commit.
