# Daily Loop and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Clara’s stable, personalized, resumable 10–15 minute daily session and make it the unmistakable primary dashboard action.

**Architecture:** A pure session composer ranks existing learning content from learner evidence and emits a versioned `DailySession`. A focused repository module persists checkpoints locally before transitions and mirrors them through the existing account-scoped Supabase/outbox boundary. Dashboard and `/today` render the same session plan rather than recomputing separate recommendations.

**Tech Stack:** Next.js 16.2.12 App Router, React 19, TypeScript 5, Dexie 4, Supabase, existing Node `.test.mjs` harness, Tailwind CSS 4.

## Global Constraints

- Clara is Joel’s free English classroom; do not add payments, subscriptions, trials, premium tiers, advertisements, or real-money purchases.
- Preserve all existing attempts, placement, SRS progress, XP, stars, streaks, cosmetics, paths, and completed lessons.
- Store no raw audio in daily-session records or analytics.
- Technical speech failures cannot reduce mastery, streaks, or learning rewards.
- Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` before modifying App Router pages.
- Existing learners default to the general path.
- Never fabricate Joel quotes or personal stories.

---

### Task 1: Daily-session domain types and pure composer

**Files:**
- Create: `lib/daily-session.ts`
- Create: `lib/daily-session.test.mjs`
- Modify: `lib/db/types.ts`
- Modify: `scripts/test.mjs`

**Interfaces:**
- Consumes: `Level`, `LearningPath`, `Lesson`, `Scenario`, `ItemProgress`, `Attempt`, and review-due timestamps.
- Produces: `DailySession`, `DailyActivity`, `composeDailySession(input)`, `sessionProgress(session)`, and `nextActivity(session)`.

- [ ] **Step 1: Write failing composition tests**

```js
test("stable plan responds to evidence", () => {
  const a = composeDailySession(fixture({ day: "2026-07-29", level: "A1", weakPhoneme: "ɪ" }));
  const b = composeDailySession(fixture({ day: "2026-07-29", level: "A1", weakPhoneme: "v" }));
  assert.deepEqual(composeDailySession(fixture({ day: "2026-07-29", level: "A1", weakPhoneme: "ɪ" })), a);
  assert.notDeepEqual(a.activities.map(x => x.targetIds), b.activities.map(x => x.targetIds));
  assert.equal(a.assistance, "spanish-full");
});

test("technical failures are not weaknesses", () => {
  const plan = composeDailySession(fixture({
    attempts: [{ itemId: "worked", passed: false, evidence: "technical-failure" }]
  }));
  assert.equal(plan.activities.some(x => x.reason === "recent-mistake" && x.targetIds.includes("worked")), false);
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `node lib/daily-session.test.mjs`  
Expected: FAIL because `lib/daily-session.ts` and exported functions do not exist.

- [ ] **Step 3: Add exact domain types**

```ts
export type AssistanceLevel = "spanish-full" | "spanish-selective" | "english-default";
export type DailyActivityKind = "retrieve" | "learn" | "listen" | "speak" | "situation" | "reflect";
export type ActivityStatus = "pending" | "active" | "completed" | "technical-skip";

export interface DailyActivity {
  id: string;
  kind: DailyActivityKind;
  title: { es: string; en: string };
  targetIds: string[];
  sourceId: string;
  reason: "review-due" | "weak-sound" | "weak-vocabulary" | "recent-mistake" | "level-next" | "path-goal" | "transfer";
  estimatedMinutes: number;
  status: ActivityStatus;
  completedAt?: number;
}

export interface DailySession {
  id: string;
  version: 1;
  profileId: string;
  day: string;
  objective: { es: string; en: string };
  outcome: { es: string; en: string };
  assistance: AssistanceLevel;
  activities: DailyActivity[];
  currentActivityId: string | null;
  rewardClaimed: boolean;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 4: Implement deterministic ranking and time budgeting**

Implement `composeDailySession` as pure code: filter invalid technical evidence, rank by due urgency → path relevance → weakness confidence → recency → fatigue, select one activity per educational purpose, cap the sum at 15 minutes, and label sparse-history plans as level-based in their selection reasons.

- [ ] **Step 5: Run focused and full domain tests**

Run: `node lib/daily-session.test.mjs && npm test`  
Expected: all daily-session cases pass and the existing suite remains green.

- [ ] **Step 6: Commit the domain**

```bash
git add lib/daily-session.ts lib/daily-session.test.mjs lib/db/types.ts scripts/test.mjs
git commit -m "Build personalized daily session composer"
```

### Task 2: Local persistence, conflict merge, and cloud migration

**Files:**
- Modify: `lib/db/dexie.ts`
- Modify: `lib/db/repository.ts`
- Modify: `lib/db/dexie-repository.ts`
- Create: `lib/daily-session-store.ts`
- Create: `lib/daily-session-store.test.mjs`
- Modify: `lib/sync/supabase-sync.ts`
- Modify: `lib/sync/outbox.ts`
- Modify: `lib/db/types.ts`
- Create: `supabase/daily_sessions.sql`
- Modify: `lib/sync/schema.test.mjs`
- Modify: `lib/sync/coverage.test.mjs`

**Interfaces:**
- Consumes: `DailySession` from Task 1 and the currently bound account-scoped database.
- Produces: `getDailySession(day)`, `saveDailySession(session)`, `checkpointActivity(input)`, `mergeDailySessions(local, remote)`, and durable cloud upserts.

- [ ] **Step 1: Write failing durability tests**

```js
test("completed evidence wins and rewards stay claimed", () => {
  const merged = mergeDailySessions(
    session({ activities: [activity("speak", "completed")], rewardClaimed: true, updatedAt: 10 }),
    session({ activities: [activity("speak", "pending")], rewardClaimed: false, updatedAt: 20 })
  );
  assert.equal(merged.activities[0].status, "completed");
  assert.equal(merged.rewardClaimed, true);
});
```

- [ ] **Step 2: Run the test and confirm failure**

Run: `node lib/daily-session-store.test.mjs`  
Expected: FAIL because the store and merge function do not exist.

- [ ] **Step 3: Add Dexie v10 session storage**

Add `dailySessions!: Table<DailySession, string>` and schema
`dailySessions: "id, day, updatedAt, completedAt"` without modifying existing
tables or migration decisions.

- [ ] **Step 4: Add repository and checkpoint implementation**

`checkpointActivity` must save the local row before returning. It sets one
activity to `completed` or `technical-skip`, advances `currentActivityId`, and
never mutates a completed activity back to pending.

- [ ] **Step 5: Add cloud DDL and RLS**

```sql
create table if not exists public.daily_sessions (
  profile_id uuid not null references auth.users(id) on delete cascade,
  day text not null,
  version integer not null,
  payload jsonb not null,
  updated_at bigint not null,
  primary key (profile_id, day)
);
alter table public.daily_sessions enable row level security;
create policy daily_sessions_own_rows on public.daily_sessions
for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
```

- [ ] **Step 6: Wire durable upsert and pull**

Add `daily-session` to the durable outbox union. Upsert on
`profile_id,day`; pull only the current day; merge before local save.

- [ ] **Step 7: Run focused sync and schema tests**

Run: `node lib/daily-session-store.test.mjs && node lib/sync/schema.test.mjs && node lib/sync/coverage.test.mjs`  
Expected: PASS, including account attribution and retry.

- [ ] **Step 8: Commit persistence**

```bash
git add lib/db lib/daily-session-store.ts lib/daily-session-store.test.mjs lib/sync supabase/daily_sessions.sql
git commit -m "Persist and sync resumable daily sessions"
```

### Task 3: Session hook and idempotent completion

**Files:**
- Create: `lib/hooks/useDailySession.ts`
- Create: `lib/daily-session-reward.ts`
- Create: `lib/daily-session-reward.test.mjs`
- Modify: `lib/cosmetics.ts`
- Modify: `lib/analytics.ts`

**Interfaces:**
- Consumes: composer and store from Tasks 1–2, existing player repository, quests, SRS progress, attempts, and analytics.
- Produces: `useDailySession()` with `{session, loading, start, checkpoint, claimCompletion}` and `applySessionCompletion`.

- [ ] **Step 1: Write failing one-time reward tests**

```js
test("completion reward is idempotent", () => {
  const first = applySessionCompletion(player(), session({ rewardClaimed: false }));
  const second = applySessionCompletion(first.player, first.session);
  assert.equal(first.reward.xp > 0, true);
  assert.equal(second.reward.xp, 0);
  assert.equal(second.player.xp, first.player.xp);
});
```

- [ ] **Step 2: Implement the pure reward transition**

Award the configured session XP/stars only when every required activity is
`completed` or `technical-skip` and `rewardClaimed === false`. Return updated
player and session in one pure result so persistence can write both once.

- [ ] **Step 3: Implement the hook**

The hook loads today’s saved session first, composes only when absent, saves
before exposing it, and tracks start/resume/checkpoint/complete without free
text. It does not recompose after learner data changes mid-session.

- [ ] **Step 4: Run tests**

Run: `node lib/daily-session-reward.test.mjs && npm test`  
Expected: PASS.

- [ ] **Step 5: Commit orchestration**

```bash
git add lib/hooks/useDailySession.ts lib/daily-session-reward.ts lib/daily-session-reward.test.mjs lib/cosmetics.ts lib/analytics.ts
git commit -m "Orchestrate resumable daily session state"
```

### Task 4: Dashboard hierarchy

**Files:**
- Create: `components/today-session-card.tsx`
- Modify: `app/page.tsx`
- Modify: `lib/i18n.ts`
- Test: `lib/ui/typography.test.mjs`

**Interfaces:**
- Consumes: `useDailySession()` from Task 3 and the existing `CharacterIllustration` migration seam.
- Produces: a single above-the-fold session card and reordered supporting dashboard.

- [ ] **Step 1: Add failing source-level UI contract tests**

Assert the home page renders `TodaySessionCard` before `ReadinessCard`,
`PlayerBar`, `ReviewCallout`, and store/explore surfaces, and that the new
component contains objective, outcome, time, activity types, progress, reward,
and start/continue labels.

- [ ] **Step 2: Read the Next.js page guide**

Run: `rg -n "Client Components|use client" node_modules/next/dist/docs/01-app/03-building-your-application -g '*.md' | head -20`  
Expected: identify the installed-version guidance governing the existing client page.

- [ ] **Step 3: Build the card**

Use one semantic `<section>` and one primary link/button. At 320px, keep greeting,
objective, time, progress, and CTA visible without horizontal overflow.

- [ ] **Step 4: Reorder the home page**

Order: session → current goal → review need → weekly consistency/path →
compact XP/streak/stars → customization and exploration.

- [ ] **Step 5: Run type, lint, and UI tests**

Run: `node lib/ui/typography.test.mjs && npm run typecheck && npm run lint:ratchet`  
Expected: PASS with zero lint errors.

- [ ] **Step 6: Commit dashboard**

```bash
git add app/page.tsx components/today-session-card.tsx lib/i18n.ts lib/ui/typography.test.mjs
git commit -m "Center dashboard on today's learning session"
```

### Task 5: Guided `/today` runner and completion

**Files:**
- Replace: `app/today/page.tsx`
- Create: `components/daily-session/session-intro.tsx`
- Create: `components/daily-session/activity-shell.tsx`
- Create: `components/daily-session/session-complete.tsx`
- Create: `components/daily-session/technical-recovery.tsx`
- Modify: `lib/i18n.ts`

**Interfaces:**
- Consumes: `useDailySession()` and existing lesson/review/listening/speech/talk routes.
- Produces: an in-order runner with checkpointed transitions and a meaningful completion summary.

- [ ] **Step 1: Add failing UI-contract tests**

Assert progress, saved state, remaining time, objective, technical-recovery copy,
improvement, review mistake, rewards, tomorrow suggestion, and **Done for today**
are present in the relevant component sources.

- [ ] **Step 2: Build the intro and activity shell**

Show practical goal, outcome, activities, time, reward, current step, and a
single action. Each external activity route receives `returnTo=/today` and
`sessionActivity=<id>` so completion returns to checkpoint rather than home.

- [ ] **Step 3: Build non-punitive technical recovery**

The recovery state says progress is safe, records no score, offers retry, and
offers a valid listening continuation. It never displays a learner failure.

- [ ] **Step 4: Build completion**

Derive “practiced,” “improved,” and “review next” from valid session evidence.
If evidence is missing, use precise neutral copy rather than inventing an
improvement.

- [ ] **Step 5: Run verification**

Run: `npm run typecheck && npm run lint:ratchet && npm test && npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit runner**

```bash
git add app/today/page.tsx components/daily-session lib/i18n.ts
git commit -m "Guide learners through a resumable daily session"
```

