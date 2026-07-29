# Insights, Verification, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect privacy-conscious daily-learning analytics and instructor insights, prove the complete rebuild across required states and responsive sizes, and deploy it safely with a seven-day pilot plan.

**Architecture:** Structured analytics extend the existing local-first event pipeline with a closed event union and bounded property schemas. The admin-only coach API aggregates learning/session data server-side under existing access controls. A requirement-to-evidence release report records automated, browser, screenshot, production, and owner-assisted device results.

**Tech Stack:** Next.js route handlers, Supabase RLS, Dexie events, React/TypeScript, Node tests, in-app browser responsive capabilities, Vercel production.

## Global Constraints

- Analytics contain no raw voice, unrestricted transcripts, direct contact data, or secrets.
- Instructor data remains admin-only at API and UI layers; RLS remains per account.
- Do not deploy until full automated and safe browser checks pass.
- Production deployment must preserve learner data, privacy, curriculum integrity, and access controls.
- Physical iPhone microphone, Safari PWA/OAuth, and notification checks are owner-assisted when unavailable.

---

### Task 1: Closed daily-learning analytics schema

**Files:**
- Modify: `lib/db/types.ts`
- Modify: `lib/analytics.ts`
- Create: `lib/analytics-schema.ts`
- Create: `lib/analytics-schema.test.mjs`
- Modify: `supabase/events.sql`
- Modify: `scripts/test.mjs`

**Interfaces:**
- Produces: typed events for session start/resume/complete/abandon, activity complete, speaking attempted, review complete, return markers, and technical failure.

- [ ] **Step 1: Write failing privacy-schema tests**

```js
test("event props reject transcript and audio fields", () => {
  for (const key of ["transcript","heard","audio","voice","email","name"]) {
    assert.throws(() => validateEvent({ type: "speaking_attempted", props: { [key]: "secret" } }));
  }
});
test("technical failure accepts only a bounded category", () => {
  assert.doesNotThrow(() => validateEvent({ type: "technical_failure", props: { category: "speech-recognition" } }));
  assert.throws(() => validateEvent({ type: "technical_failure", props: { category: "arbitrary-free-text" } }));
});
```

- [ ] **Step 2: Implement event validators and definitions**

Use a closed allowlist for event types, property names, and failure categories.
Drop invalid optional properties; reject an invalid required property before
local or cloud writes.

- [ ] **Step 3: Extend local and SQL schemas**

Keep the existing per-user RLS. Add indexes required for profile/day/type
rollups without weakening policy.

- [ ] **Step 4: Run tests and commit**

Run: `node lib/analytics-schema.test.mjs && npm test`  
Expected: PASS.

```bash
git add lib/db/types.ts lib/analytics.ts lib/analytics-schema.ts lib/analytics-schema.test.mjs supabase/events.sql scripts/test.mjs
git commit -m "Instrument meaningful daily learning"
```

### Task 2: Metric definitions and instructor aggregation

**Files:**
- Create: `docs/learning-metrics.md`
- Modify: `app/api/coach/route.ts`
- Modify: `app/coach/page.tsx`
- Modify: `lib/report.test.mjs`
- Modify: `lib/privacy-access.test.mjs`

**Interfaces:**
- Produces: coach response fields for last practice, session counts, CEFR/path, speaking participation, weak areas, review need, and sync/technical warnings.

- [ ] **Step 1: Write metric definitions**

Define exact numerator, denominator, unit, local-day boundary, eligible
population, and exclusions for daily active learner, completion rate, next-day
return, seven-day return, meaningful practice time, speaking participation,
review completion, and technical failure rate.

- [ ] **Step 2: Write failing access and response tests**

Assert non-admin requests return 403 and the response never includes another
learner’s transcript, voice content, email, or raw event properties.

- [ ] **Step 3: Extend server aggregation**

Return only bounded learner summaries. Rank weak areas using valid attempts and
due progress. Flag technical trouble from categorized failures and outbox age.

- [ ] **Step 4: Redesign coach rows**

Show active status, last practice, sessions, level/path, speaking participation,
weak areas, review need, and sync/technical warnings with mobile-readable
priority.

- [ ] **Step 5: Run tests and commit**

Run: `node lib/privacy-access.test.mjs && node lib/report.test.mjs && npm run typecheck && npm run lint:ratchet`  
Expected: PASS.

```bash
git add docs/learning-metrics.md app/api/coach/route.ts app/coach/page.tsx lib/report.test.mjs lib/privacy-access.test.mjs
git commit -m "Improve instructor learning insights"
```

### Task 3: Comeback and notification behavior

**Files:**
- Create: `lib/comeback.ts`
- Create: `lib/comeback.test.mjs`
- Modify: `lib/push.ts`
- Modify: `app/api/push/send/route.ts`
- Modify: dashboard session composition input

**Interfaces:**
- Produces: `composeComebackSession` and specific notification messages based on due review or unfinished work.

- [ ] **Step 1: Write failing behavior tests**

Assert missed-day sessions are shorter, preserve streak state rules, prioritize
one important review, and contain none of “lose,” “dying,” “misses you,” or
equivalent guilt copy.

- [ ] **Step 2: Implement comeback selection**

Use the same composer with a 5–8 minute budget and a recovery objective when
the learner has missed at least one local day.

- [ ] **Step 3: Implement notification selection**

Send only when enabled. Prefer unfinished speaking, due review counts, or a
specific ready activity. Preserve existing cron authentication and opt-out.

- [ ] **Step 4: Run tests and commit**

Run: `node lib/comeback.test.mjs && npm test`  
Expected: PASS.

```bash
git add lib/comeback.ts lib/comeback.test.mjs lib/push.ts app/api/push/send/route.ts lib
git commit -m "Welcome learners back without pressure"
```

### Task 4: Verification harness and before screenshots

**Files:**
- Create: `docs/verification/2026-07-29-before.md`
- Create: `docs/verification/2026-07-29-requirement-matrix.md`
- Create: `docs/verification/screenshots/before/*`

**Interfaces:**
- Produces: authoritative baseline screenshots and one row of evidence status for every explicit requirement.

- [ ] **Step 1: Capture production baseline**

Capture dashboard, Today, speaking feedback, and store at 390px mobile and
desktop. Record URL, commit, account state, viewport, and console errors.

- [ ] **Step 2: Build requirement matrix**

For every spec section, record required evidence source and status:
`unverified`, `contradicted`, `partial`, or `proven`. Do not mark a broad
requirement proven by a narrow unit test.

- [ ] **Step 3: Commit baseline evidence**

```bash
git add docs/verification
git commit -m "Record Clara rebuild verification baseline"
```

### Task 5: Complete automated and responsive browser verification

**Files:**
- Create: `docs/verification/2026-07-29-results.md`
- Create: `docs/verification/screenshots/after/*`

**Interfaces:**
- Consumes: completed implementation from all plans.
- Produces: reproducible command results, responsive screenshots, console review, and remaining real-device risks.

- [ ] **Step 1: Run focused tests**

Run every newly added `.test.mjs` file directly.  
Expected: all pass.

- [ ] **Step 2: Run the complete gate**

Run: `npm run verify`  
Expected: type-check, lint ratchet, full suite, and production build all exit 0.

- [ ] **Step 3: Test learner states**

Verify new/existing, A1/B1/B2+, interrupted/resumed, offline/sync failure,
speech failure, denied microphone, muted audio, reduced motion, Spanish accents,
account isolation, privacy consent, admin restrictions, and virtual-only store.

- [ ] **Step 4: Test responsive sizes**

Capture and inspect 320, 375, 390, and 430px mobile widths plus tablet and
desktop. Cover dashboard, session intro, speaking feedback, and store preview.
Instructional content must remain primary; no important face, hair, hands, feet,
baseball cap, or pet may clip unintentionally.

- [ ] **Step 5: Review console and document browser coverage**

Record Chrome/in-app results and available Safari/Firefox results. Record
unavailable physical-device checks as unverified, not passed.

- [ ] **Step 6: Update requirement matrix**

Attach exact file, test command, screenshot, migration, or runtime evidence to
every proven row.

- [ ] **Step 7: Commit verification**

```bash
git add docs/verification
git commit -m "Verify Clara daily classroom rebuild"
```

### Task 6: Deployment, production smoke, and seven-day pilot

**Files:**
- Create: `docs/PILOT_PLAN_7_DAYS.md`
- Modify: `PRODUCTION.md`
- Modify: `HANDOFF.md`
- Modify: `docs/verification/2026-07-29-results.md`

**Interfaces:**
- Produces: deployed production commit, smoke-test evidence, pilot schedule, educational risks, and owner-assisted test list.

- [ ] **Step 1: Write the pilot plan**

Define a small cohort, consent and support channel, daily task, success measures,
day-1/day-3/day-7 interview questions, issue severity rules, and rollback
criteria. Measure completion, speaking participation, return, useful feedback,
and technical failures—not maximum time in app.

- [ ] **Step 2: Apply production-safe migrations**

Apply ordered SQL through the approved database workflow. Verify table shape,
indexes, RLS, and existing row counts before and after. Do not expose or reset
learner data.

- [ ] **Step 3: Re-run `npm run verify` on the deployment commit**

Expected: exit 0 immediately before deployment.

- [ ] **Step 4: Push and observe deployment**

Use the repository’s production deployment workflow. Do not claim deployment
until the target commit is serving.

- [ ] **Step 5: Run authenticated production smoke tests**

Verify dashboard, resume, completion, store, instructor authorization, analytics
write, sync, and API health. Review browser console and network failures.

- [ ] **Step 6: Document remaining risk**

List educational coverage limits, unapproved Joel humor candidates, real iPhone
microphone, Safari PWA/OAuth, notification delivery, and other unexecuted
physical-device checks explicitly.

- [ ] **Step 7: Commit final handoff**

```bash
git add docs/PILOT_PLAN_7_DAYS.md PRODUCTION.md HANDOFF.md docs/verification
git commit -m "Document Clara production launch and pilot"
```

