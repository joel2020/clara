# Clara Release Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the integrated Clara application is safe, reliable, accessible, observable, recoverable, and genuinely ready for daily student use at a final score of at least 9.0/10.

**Architecture:** Automated browser journeys exercise the same release commit deployed to Vercel. Supabase, Vercel, Sentry, devices, calibration, and pilot evidence are recorded in dated verification artifacts. A deterministic audit rubric blocks release on any P0 regardless of the numeric score, and rollback is rehearsed before enrollment expands.

**Tech Stack:** Next.js 16, Playwright, axe-core, GitHub Actions, Supabase, Vercel, Sentry, real iOS/Android/desktop browsers.

## Global Constraints

- Verify the exact commit intended for production; do not mix evidence from different builds.
- Use dedicated non-personal learner/admin test accounts and redact credentials, emails, tokens, transcripts, and audio from evidence.
- Never weaken authentication, RLS, CSP, grading, or accessibility to make an end-to-end test pass.
- Human/device/calibration requirements cannot be replaced by synthetic tests.
- A missing external prerequisite remains an explicit release blocker; do not invent screenshots, domain ownership, advisor results, calibration participants, or pilot outcomes.
- Production release requires score ≥9.0/10, no unresolved P0, no unaccepted high/critical production dependency finding, and a tested rollback path.

---

### Task 1: Build production-shaped cross-browser journeys

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/support/auth.ts`
- Create: `tests/e2e/support/fixtures.ts`
- Create: `tests/e2e/auth-access.spec.ts`
- Create: `tests/e2e/daily-pronunciation.spec.ts`
- Create: `tests/e2e/virtual-call.spec.ts`
- Create: `tests/e2e/closet.spec.ts`
- Create: `tests/e2e/offline-sync.spec.ts`
- Create: `tests/e2e/accessibility.spec.ts`
- Modify: `.gitignore`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- `npm run test:e2e` runs Chromium, Firefox, and WebKit desktop projects.
- `npm run test:e2e:mobile` runs current iPhone Safari and Android Chrome emulations.
- `npm run test:a11y` runs axe plus keyboard assertions on core route states.

- [ ] **Step 1: Install pinned test tooling and create a failing smoke test**

```bash
npm install --save-dev @playwright/test @axe-core/playwright
npx playwright install --with-deps chromium firefox webkit
```

Add scripts and a config with `trace: "retain-on-failure"`, screenshots/video only on
failure, a local `webServer`, and output folders in `.gitignore`. Do not save authenticated
storage state to the repository.

- [ ] **Step 2: Authenticate with dedicated test users—no bypass flag**

Read `E2E_LEARNER_EMAIL`, `E2E_LEARNER_PASSWORD`, `E2E_ADMIN_EMAIL`, and
`E2E_ADMIN_PASSWORD` from CI/Vercel-protected environments. Build session state at runtime
and redact account identifiers from attachments. A missing secret skips production-account
tests locally with a clear reason but fails the release workflow.

- [ ] **Step 3: Implement the core journeys**

Cover invite-only stranger denial, allowed login/onboarding, Hoy start/resume, one full
daily session, a valid pass, three valid pronunciation misses and continuation, technical
skip, virtual-call automatic microphone disclosure/denial/recovery, scripted call repair,
reward idempotency, Closet preview/purchase/equip/repeated confirm, offline local progress,
reconnect/sync, and cross-route resume. Use deterministic provider mocks only in local/CI;
run a separate production smoke with real providers and bounded cost.

- [ ] **Step 4: Add accessibility journeys**

Run axe on login, onboarding, Hoy, Camino, Hablar, Yo, practice feedback, call consent,
and Closet dialog. Add keyboard-only assertions for skip link, focus order, Escape, focus
restoration, live announcements, and 200% zoom. Axe alone does not satisfy the manual
VoiceOver gate.

- [ ] **Step 5: Add CI execution**

Run unit/type/lint/audit/build first, then Playwright on the built app. Upload only failed
traces/screenshots for a short retention window. Keep provider secrets unavailable to
forked/untrusted workflows.

- [ ] **Step 6: Verify and commit**

```bash
npm run test:e2e
npm run test:e2e:mobile
npm run test:a11y
git add package.json package-lock.json playwright.config.ts tests/e2e .gitignore .github/workflows/ci.yml
git commit -m "test: add Clara release browser journeys"
```

### Task 2: Publish the adult trust and account-control surface

**Files:**
- Modify: `app/privacidad/page.tsx`
- Create: `app/terms/page.tsx`
- Create: `app/contact/page.tsx`
- Create: `app/delete-account/page.tsx`
- Modify: `components/privacy-notice.tsx`
- Modify: `components/onboarding-flow.tsx`
- Modify: `components/site-header.tsx`
- Modify: `components/mobile-nav.tsx`
- Create: `lib/trust-surface.test.mjs`
- Modify: `README.md`
- Modify: `PRODUCTION.md`

- [ ] **Step 1: Write a failing trust-surface contract**

Assert privacy, terms, contact, retention, and deletion pages are linked from login,
onboarding, and Yo; identify Clara's operator/contact method; list speech/AI processors;
describe automatic call capture, transcript choices, retention, deletion time target, and
adult-only eligibility; and contain effective/updated dates. Reject placeholders.

- [ ] **Step 2: Confirm failure**

```bash
node lib/trust-surface.test.mjs
```

- [ ] **Step 3: Write bilingual, product-accurate policies**

Use actual current behavior from the foundation and pronunciation plans. Require an
affirmative “I am 18 or older” onboarding confirmation until a separate child-safety and
legal review exists. The deletion page must distinguish device reset from cloud account
deletion and state the monitored contact/process and fulfillment target.

- [ ] **Step 4: Verify and commit**

```bash
node lib/trust-surface.test.mjs
npm run typecheck
npm run build
git add app/privacidad/page.tsx app/terms app/contact app/delete-account components/privacy-notice.tsx components/onboarding-flow.tsx components/site-header.tsx components/mobile-nav.tsx lib/trust-surface.test.mjs README.md PRODUCTION.md
git commit -m "feat: publish Clara trust and account controls"
```

### Task 3: Verify and harden the connected Supabase project

**Files:**
- Create: `scripts/verify-supabase-security.mjs`
- Create: `docs/verification/supabase-release-check.md`
- Create: `docs/verification/supabase-advisors.json`
- Create: `docs/verification/two-account-isolation.json`
- Modify: `package.json`
- Modify: `PRODUCTION.md`

**External actions:** Use the linked Clara Supabase project. Destructive restore rehearsal
must use a disposable project/database, never production.

- [ ] **Step 1: Resolve and record the exact project**

Compare the local project ref/environment URL with the connected Supabase project. Record
the project ref suffix, region, schema version, and release commit—never keys. Stop if the
repository and connected project disagree.

- [ ] **Step 2: Apply reviewed migrations and run advisors**

Apply the approved v5/v6/v7/v8 migrations through the supported migration path. Export
current security/performance advisor results. Resolve security findings and performance
findings that affect core queries; record any accepted low-risk exception with owner and
expiry. Enable leaked-password protection in Auth and verify invite-only provider/settings.

- [ ] **Step 3: Prove two-account and admin isolation**

With two dedicated learner accounts and one admin, attempt SELECT/INSERT/UPDATE/DELETE
against every user-owned table. Learner A must not observe or mutate learner B; neither
learner may perform admin custom-lesson writes; the admin claim may. `scripts/verify-supabase-security.mjs`
must validate redacted result counts against an allowlist of tables.

- [ ] **Step 4: Rehearse authoritative restore**

Create a disposable database from `supabase/current-schema.sql`, load synthetic seed data,
verify RLS and core queries, then destroy only that explicitly identified disposable
target. Record start/end times, commands, schema checksum, row-count checks, and result.
Do not use historical permissive SQL as rebuild instructions.

- [ ] **Step 5: Verify and commit evidence**

```bash
npm run verify:supabase
node lib/sync/schema.test.mjs
npm test
git add scripts/verify-supabase-security.mjs docs/verification/supabase-release-check.md docs/verification/supabase-advisors.json docs/verification/two-account-isolation.json package.json package-lock.json PRODUCTION.md
git commit -m "test: verify Supabase security and recovery"
```

### Task 4: Configure and verify the production Vercel environment

**Files:**
- Create: `scripts/verify-production-env.mjs`
- Create: `scripts/smoke-production.mjs`
- Create: `docs/verification/vercel-release-check.md`
- Modify: `package.json`
- Modify: `PRODUCTION.md`

**Interfaces:**
- `npm run verify:production-env` checks names/presence/scopes, never secret values.
- `npm run smoke:production` checks the final branded HTTPS URL and release ID.

- [ ] **Step 1: Inventory environment contracts**

Derive required variable names from source and classify client/server, preview/production,
and rotation owner. Include Supabase, Azure, OpenAI, ElevenLabs, Sentry, invite allowlist,
global/user rate-limit storage, build ID, and test-user variables where applicable. Fail
if a server secret is exposed with `NEXT_PUBLIC_` or a required production name is absent.

- [ ] **Step 2: Align Vercel project and runtime**

Verify the linked Vercel project, Git repository, production branch, Node 24 runtime,
install/build commands, function region/timeouts, and protected production variables.
Set variables through Vercel controls without printing values. Deploy a preview first.

- [ ] **Step 3: Verify preview before promotion**

Run headers, sign-in, allowed-user, real bounded assessment, sync, Sentry test-event, and
core Playwright smoke checks against preview. Inspect build/function logs for unexpected
PII, raw audio/transcripts, provider errors, and noisy retries. Confirm the rendered build
ID equals the commit under test.

- [ ] **Step 4: Promote and verify the branded HTTPS domain**

Use an already assigned Clara branded domain if present. If none is assigned, record domain
selection/DNS ownership as a release blocker rather than inventing one. Verify certificate,
canonical URL, redirects, HSTS, CSP, manifest/start URL, service worker, and social metadata
on the final domain.

- [ ] **Step 5: Verify observability and SLO alerts**

Send one scrubbed test exception and one tagged synthetic provider failure; verify private
source maps and alert delivery. Record SLOs and alert thresholds for sign-in availability,
daily-session completion, `/api/assess` p95 latency/error rate, sync success/latency, and
unusual provider cost. Evidence must not contain account identifiers or transcripts.

- [ ] **Step 6: Verify and commit operations artifacts**

```bash
npm run verify:production-env
npm run smoke:production
git add scripts/verify-production-env.mjs scripts/smoke-production.mjs docs/verification/vercel-release-check.md package.json package-lock.json PRODUCTION.md
git commit -m "ops: add production environment verification"
```

### Task 5: Measure and enforce performance budgets

**Files:**
- Create: `scripts/verify-performance-budget.mjs`
- Create: `docs/verification/performance-budget.json`
- Create: `docs/verification/performance-release-check.md`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify only when evidence fails: affected route/component/image files

**Budgets on representative mid-tier mobile throttling:**

```text
Hoy LCP <= 2.5s, CLS <= 0.10, INP <= 200ms
Camino LCP <= 2.5s, CLS <= 0.10
Hablar LCP <= 2.5s before media permission
Yo/Closet LCP <= 2.5s, CLS <= 0.10
Initial route JavaScript <= the recorded approved route budget with <=5% regression
Lumi above-the-fold image <= 250KB and no unbounded eager outfit batch
```

- [ ] **Step 1: Capture a reproducible baseline and make budgets executable**

Use Lighthouse/Chrome trace output against a production build with cache-cold and warm
runs. Store summarized metrics and tool/browser versions, not full noisy traces in Git.
`verify-performance-budget.mjs` must fail when thresholds are exceeded.

- [ ] **Step 2: Fix measured bottlenecks only**

Prioritize route code splitting, correct image dimensions/formats, lazy outfit loading,
font loading, stable reserved space, and removal of blocking work. Do not trade away focus,
labels, reduced motion, offline behavior, or security headers for a synthetic score.

- [ ] **Step 3: Add the budget to CI and commit**

```bash
npm run build
npm run verify:performance
git add scripts/verify-performance-budget.mjs docs/verification/performance-budget.json docs/verification/performance-release-check.md package.json package-lock.json .github/workflows/ci.yml
git commit -m "perf: enforce Clara release budgets"
```

### Task 6: Run the real-device and assistive-technology matrix

**Files:**
- Create: `docs/verification/device-matrix.md`
- Create: `docs/verification/device-results.json`
- Create: `scripts/validate-device-results.mjs`
- Modify: `package.json`

**Required physical/browser coverage:**
- Current iPhone Safari plus installed PWA and VoiceOver.
- Older Android device Chrome.
- Desktop Chrome, Safari, and Firefox.
- Keyboard-only journey and 200% browser zoom.

- [ ] **Step 1: Create the strict evidence validator**

Require date, release commit/build ID, physical device model, OS/browser version, account
role, journey, expected result, actual result, pass/fail, owner, and screenshot/log path.
Reject empty/template results and evidence from another release commit.

- [ ] **Step 2: Execute every critical journey**

On the required matrix, run sign-in, onboarding, Hoy, full daily session, valid pass,
three-attempt miss continuation, virtual call, microphone denial/recovery, offline/reconnect,
reward, Closet preview/purchase/equip, push opt-in/delivery, app background/return, and
cross-device continuation. VoiceOver and keyboard checks must include modal focus,
announcements, target/control order, and non-color status.

- [ ] **Step 3: Fix failures and rerun affected plus neighboring journeys**

Do not mark a partial/blocked physical test as passed. Record defect commit and retest date.
Any core-journey crash, inaccessible blocker, data loss, cross-account leak, incorrect
charge, or pronunciation bypass is P0.

- [ ] **Step 4: Validate and commit redacted evidence**

```bash
npm run verify:devices
git add docs/verification/device-matrix.md docs/verification/device-results.json scripts/validate-device-results.mjs package.json package-lock.json
git commit -m "test: record Clara real-device acceptance"
```

### Task 7: Complete pronunciation calibration and a bounded student pilot

**Files:**
- Create after real evaluation: `docs/verification/pronunciation-calibration.json`
- Create: `docs/verification/student-pilot.md`
- Create after pilot: `docs/verification/student-pilot-results.json`
- Create: `scripts/validate-student-pilot.mjs`
- Modify: `package.json`

- [ ] **Step 1: Complete the human pronunciation calibration**

Collect at least 30 consented recordings from at least six adult LATAM speakers, have the
instructor independently rate intelligibility and target-sound accuracy, anonymize sample
IDs, discard raw audio after rating, and run:

```bash
npm run verify:pronunciation-calibration
```

If thresholds change, create a new policy version, rationale, boundary tests, and rerun
all pronunciation tests; never silently edit `latam-v1` evidence.

- [ ] **Step 2: Run an invite-only daily-use pilot**

Use a bounded adult cohort before broad enrollment. Measure seven-day activation,
daily-session starts/completions, pronunciation retry completion, practiced-not-mastered
rate, provider technical-skip/error rate, call completion, sync failures, and qualitative
confusion/frustration. Analytics are bounded events without email, audio, or unrestricted
transcripts.

- [ ] **Step 3: Set and validate pilot exit criteria**

The pilot may exit only with no P0, no unexplained data loss/double rewards, at least 95%
successful sync among connected completed sessions, at least 95% assessment technical
success where network/provider are available, and no repeated critical usability blocker.
Record cohort size and confidence limits; do not present small-sample directional metrics
as universal claims.

- [ ] **Step 4: Commit anonymized evidence**

```bash
npm run verify:pronunciation-calibration
npm run verify:pilot
git add docs/verification/pronunciation-calibration.json docs/verification/student-pilot.md docs/verification/student-pilot-results.json scripts/validate-student-pilot.mjs package.json package-lock.json
git commit -m "test: record pronunciation calibration and pilot"
```

### Task 8: Score the release with a deterministic 10-point audit

**Files:**
- Create: `scripts/score-production-readiness.mjs`
- Create: `docs/verification/production-audit-rubric.json`
- Create after evidence exists: `docs/verification/production-audit-final.md`
- Modify: `package.json`

**Weighted score:**

| Area | Points | Required evidence |
|---|---:|---|
| Security, privacy, access, cost controls | 2.0 | Audit, headers, auth/quota tests, trust pages, Supabase isolation |
| Reliability, data, recovery | 2.0 | Sync/offline/idempotency tests, restore rehearsal, healthy production logs |
| Learning and pronunciation quality | 2.0 | Strict policy/games/exams, daily guarantee, calibration and pilot evidence |
| UX and accessibility | 2.0 | Four spaces, Lumi/Closet acceptance, axe, VoiceOver, keyboard, zoom, devices |
| Operations and trust | 1.0 | Branded domain, Sentry/SLO alerts, runbooks, contact/deletion process |
| Performance | 1.0 | Enforced web-vital/image/bundle budgets on release build |

- [ ] **Step 1: Implement fail-closed evidence scoring**

Each check is binary or a documented partial with evidence path and owner. Missing/stale
evidence scores zero. Unresolved P0 forces `release: false` regardless of score. Dependency
high/critical, account isolation failure, raw-audio retention, pronunciation-gate bypass,
data loss, negative/double cosmetic charge, inaccessible core blocker, missing rollback,
or mismatched deployed commit is P0.

- [ ] **Step 2: Run the complete local and external gate**

```bash
npm ci
npm run verify
npm run audit:prod
npm run test:e2e
npm run test:e2e:mobile
npm run test:a11y
npm run verify:performance
npm run verify:supabase
npm run verify:production-env
npm run verify:devices
npm run verify:pronunciation-calibration
npm run verify:pilot
npm run score:production
```

Expected: score ≥9.0, `release: true`, and no P0.

- [ ] **Step 3: Write the final audit**

List score by area, every evidence path/date/release ID, unresolved lower-priority item
with owner/deadline, accepted exception with expiry, and the exact release commit/domain.
Do not round a score below 9.0 upward.

- [ ] **Step 4: Commit the rubric and final evidence**

```bash
git add scripts/score-production-readiness.mjs docs/verification/production-audit-rubric.json docs/verification/production-audit-final.md package.json package-lock.json
git commit -m "docs: certify Clara production readiness"
```

### Task 9: Rehearse rollback and release the verified commit

**Files:**
- Create: `docs/verification/release-runbook.md`
- Create after rehearsal: `docs/verification/rollback-rehearsal.md`
- Modify: `PRODUCTION.md`

- [ ] **Step 1: Define go/no-go owners and freeze inputs**

Record release commit, production domain, Vercel deployment ID, Supabase migration level,
feature/config flags, owner, communication path, monitoring window, and explicit no-go
conditions. Freeze content/schema/config changes during final evidence collection.

- [ ] **Step 2: Rehearse application rollback without destructive database rollback**

Promote the prior known-good Vercel deployment in preview/staging, verify sign-in and core
read paths against the forward-compatible additive schema, then restore the release
candidate. Do not reverse additive migrations in production; use compatible application
rollback and forward fixes. Record times and results.

- [ ] **Step 3: Release and watch the first production window**

Promote the exact scored deployment. Repeat synthetic sign-in/Hoy/assessment/sync smoke,
confirm build ID, and watch Sentry/Vercel/Supabase/provider dashboards for the documented
window. Trigger rollback on any P0 or runbook threshold.

- [ ] **Step 4: Commit the final runbook evidence**

```bash
git add docs/verification/release-runbook.md docs/verification/rollback-rehearsal.md PRODUCTION.md
git commit -m "ops: record Clara release and rollback rehearsal"
```

## Release completion gate

- [ ] Exact production commit passes unit, type, lint, audit, build, E2E, accessibility, and performance gates.
- [ ] Supabase advisors, leaked-password protection, two-account isolation, admin isolation, and disposable restore rehearsal pass.
- [ ] Vercel production is READY on the branded HTTPS domain with matching release ID, correct headers, clean logs, Sentry, and active SLO alerts.
- [ ] Real iPhone/PWA/VoiceOver, older Android Chrome, desktop Chrome/Safari/Firefox, keyboard, zoom, push, offline/reconnect, and cross-device evidence pass.
- [ ] Human pronunciation calibration and bounded adult-student pilot satisfy their recorded exit criteria.
- [ ] Final score is at least 9.0/10 with no unresolved P0 and no unaccepted high/critical production dependency finding.
- [ ] Rollback rehearsal succeeds, release runbook is complete, and the post-release watch window remains healthy.
