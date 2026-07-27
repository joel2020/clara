# Phase 1: Paths and Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student chooses a path at onboarding, and the home screen leads with one honest readiness number, its trend, and one next action — replacing the grid of thirteen equal tiles.

**Architecture:** A pure scoring module (`lib/readiness.ts`) computes score, band, four subskills and a named blocker from data already captured (attempts, progress, onboarding). The path is one new field inside the existing `settings.onboarding` jsonb, so no migration. The home page composes the score card, a trajectory sparkline, one CTA, three intents, and an expander holding the existing modes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4, Dexie (IndexedDB) via `lib/hooks/useData`, Supabase for sync, `npx tsx` for `.mjs` unit tests.

## Global Constraints

- Never use emojis in code, copy, or commit messages.
- Student-facing copy is Colombian Spanish; English strings live in `lib/i18n.ts` alongside them via `t(key, lang)`.
- Commits must be authored `46899218+joel2020@users.noreply.github.com` or the Vercel deploy blocks. End commit bodies with the Claude co-author trailer.
- Existing students must default to `path: "general"` — nobody is silently placed on the job track.
- Switching path must never modify `attempts`, `progress`, or `player` rows.
- `ItemProgress.lastResult` is `"pass" | "fail" | null`, never a boolean.
- Target for B2 is score 80. Bands come from `lib/placement.ts` `LEVELS` = `["A0","A1","A2","B1","B2","C1","C2"]`.
- Tests that import through the `@/` alias must run with `npx tsx`, not bare `node`.

---

## File Structure

- Create `lib/readiness.ts` — pure scoring: score, band, target, four subskills, blocker, milestone. No React, no Dexie.
- Create `lib/readiness.test.mjs` — unit tests for the above.
- Modify `lib/onboarding.ts` — add `LearningPath` type and `path` on `OnboardingProfile`.
- Modify `components/onboarding-flow.tsx` — one new step asking which path.
- Modify `app/profile/page.tsx` — path switcher with the reassurance copy.
- Create `components/readiness-card.tsx` — score, band chip, trajectory sparkline, subskill bars.
- Modify `app/page.tsx` — lead with readiness, one CTA, three intents, existing tiles behind the expander.
- Modify `lib/i18n.ts` — new strings, Spanish and English.

---

### Task 1: The readiness engine

**Files:**
- Create: `lib/readiness.ts`
- Test: `lib/readiness.test.mjs`

**Interfaces:**
- Consumes: `ItemProgress`, `Attempt` from `@/lib/db/types`; `Level`, `LEVELS`, `levelIndex` from `@/lib/placement`; `isMastered` from `@/lib/srs`.
- Produces: `type LearningPath = "job" | "general"`, `interface Subskill { key: SubskillKey; score: number; atTarget: boolean }`, `type SubskillKey = "intelligibility" | "fluency" | "listening" | "interaction"`, `interface Readiness { score: number; band: Level; target: number; subskills: Subskill[]; blocker: SubskillKey | null; provisional: boolean }`, `function computeReadiness(input: ReadinessInput): Readiness`, `interface ReadinessInput { attempts: Attempt[]; progress: ItemProgress[]; band: Level; path: LearningPath; examPassed?: boolean; now?: number }`.

- [ ] **Step 1: Write the failing test**

```js
// npx tsx lib/readiness.test.mjs
import { computeReadiness } from "./readiness.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };

const att = (score, passed, at) => ({ itemId: "i", lessonId: "l", categoryId: "c", phoneme: "p", target: "t", heard: "t", score, passed, at });
const prog = (itemId, box, lastResult) => ({ itemId, lessonId: "l", categoryId: "c", phoneme: "p", attempts: 4, passes: 2, box, dueAt: 0, lastResult, lastScore: 60, updatedAt: 1 });

// No data at all: score 0, no blocker, provisional.
const empty = computeReadiness({ attempts: [], progress: [], band: "A1", path: "general" });
eq(empty.score, 0, "empty score is 0");
eq(empty.blocker, null, "empty has no blocker");
eq(empty.provisional, true, "no passed exam means provisional");
eq(empty.target, 80, "target is always 80 for B2");

// Strong recent attempts lift the score above weak ones.
const strong = computeReadiness({ attempts: [att(95, true, 5), att(92, true, 4), att(90, true, 3)], progress: [prog("a", 5, "pass")], band: "B1", path: "general" });
const weak = computeReadiness({ attempts: [att(40, false, 5), att(45, false, 4), att(38, false, 3)], progress: [prog("a", 0, "fail")], band: "B1", path: "general" });
eq(strong.score > weak.score, true, "strong attempts score higher than weak");

// The blocker is the lowest subskill, and it is flagged not at target.
const blocked = computeReadiness({ attempts: [att(90, true, 3), att(88, true, 2)], progress: [prog("a", 4, "pass")], band: "B1", path: "general" });
eq(typeof blocked.blocker === "string" || blocked.blocker === null, true, "blocker is a key or null");
eq(blocked.subskills.length, 4, "always four subskills");
eq(blocked.subskills.every((s) => s.score >= 0 && s.score <= 100), true, "subskills are 0..100");

// A passed exam clears the provisional flag.
const examined = computeReadiness({ attempts: [att(85, true, 1)], progress: [prog("a", 5, "pass")], band: "B2", path: "job", examPassed: true });
eq(examined.provisional, false, "passed exam is not provisional");

// Score is bounded and never NaN with degenerate input.
const odd = computeReadiness({ attempts: [att(0, false, 1)], progress: [], band: "A0", path: "job" });
eq(Number.isFinite(odd.score), true, "score is finite");
eq(odd.score >= 0 && odd.score <= 100, true, "score is bounded 0..100");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx lib/readiness.test.mjs`
Expected: FAIL — cannot resolve `./readiness.ts`.

- [ ] **Step 3: Write the implementation**

```ts
import type { Attempt, ItemProgress } from "@/lib/db/types";
import { type Level } from "@/lib/placement";
import { isMastered } from "@/lib/srs";

export type LearningPath = "job" | "general";
export type SubskillKey = "intelligibility" | "fluency" | "listening" | "interaction";

export interface Subskill {
  key: SubskillKey;
  score: number;
  atTarget: boolean;
}

export interface Readiness {
  score: number;
  band: Level;
  target: number;
  subskills: Subskill[];
  blocker: SubskillKey | null;
  /** True until a stage exam has actually been passed at this band. */
  provisional: boolean;
}

export interface ReadinessInput {
  attempts: Attempt[];
  progress: ItemProgress[];
  band: Level;
  path: LearningPath;
  examPassed?: boolean;
  now?: number;
}

/** B2 is the hiring bar and the fluency bar alike. */
export const TARGET_SCORE = 80;
const RECENT = 40;

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const { attempts, progress, band, examPassed = false } = input;
  const recent = [...attempts].sort((a, b) => b.at - a.at).slice(0, RECENT);

  // Intelligibility: how accurate her recent speech was.
  const intelligibility = clamp(mean(recent.map((a) => a.score)));
  // Fluency: pass rate is the proxy until Azure fluency is threaded through.
  const passRate = recent.length ? recent.filter((a) => a.passed).length / recent.length : 0;
  const fluency = clamp(passRate * 100);
  // Listening: share of practised items that reached mastery.
  const practised = progress.filter((p) => p.attempts > 0);
  const listening = clamp(practised.length ? (practised.filter(isMastered).length / practised.length) * 100 : 0);
  // Interaction: breadth of material she can handle, capped so it cannot carry
  // the whole score on volume alone.
  const interaction = clamp(Math.min(practised.length, 120) / 1.2);

  const subskills: Subskill[] = (
    [
      ["intelligibility", intelligibility],
      ["fluency", fluency],
      ["listening", listening],
      ["interaction", interaction],
    ] as const
  ).map(([key, score]) => ({ key, score, atTarget: score >= TARGET_SCORE }));

  const score = clamp(mean(subskills.map((s) => s.score)));
  const lowest = subskills.reduce((a, b) => (b.score < a.score ? b : a));
  const blocker = score > 0 && !lowest.atTarget ? lowest.key : null;

  return { score, band, target: TARGET_SCORE, subskills, blocker, provisional: !examPassed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx lib/readiness.test.mjs`
Expected: `12 ok, 0 failed`

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npx eslint lib/readiness.ts`
Expected: no output from either.

- [ ] **Step 6: Commit**

```bash
git add lib/readiness.ts lib/readiness.test.mjs
git commit -m "Add the readiness engine: one honest number per path"
```

---

### Task 2: The path on the onboarding profile

**Files:**
- Modify: `lib/onboarding.ts`
- Modify: `lib/db/types.ts` (only if `OnboardingProfile` needs re-export; it is already referenced via `import("@/lib/onboarding").OnboardingProfile`)

**Interfaces:**
- Consumes: `LearningPath` from `@/lib/readiness`.
- Produces: `OnboardingProfile.path?: LearningPath` — optional so existing stored profiles stay valid, and read with `?? "general"` everywhere.

- [ ] **Step 1: Add the field**

In `lib/onboarding.ts`, import the type and extend the interface:

```ts
import type { LearningPath } from "./readiness.ts";

export interface OnboardingProfile {
  // ... existing fields unchanged ...
  /**
   * Which destination she is working toward. Optional because profiles saved
   * before paths existed have no value; every read defaults to "general" so no
   * existing student is silently placed on the job track.
   */
  path?: LearningPath;
}
```

- [ ] **Step 2: Add the accessor with a test**

Append to `lib/onboarding.ts`:

```ts
/** The student's path, defaulting existing profiles to the general track. */
export function pathOf(profile?: Pick<OnboardingProfile, "path">): LearningPath {
  return profile?.path ?? "general";
}
```

Create `lib/onboarding-path.test.mjs`:

```js
// npx tsx lib/onboarding-path.test.mjs
import { pathOf } from "./onboarding.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", a, "want", b); } };

eq(pathOf(undefined), "general", "missing profile defaults to general");
eq(pathOf({}), "general", "profile without path defaults to general");
eq(pathOf({ path: "job" }), "job", "explicit job path is respected");
eq(pathOf({ path: "general" }), "general", "explicit general path is respected");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 3: Run the test**

Run: `npx tsx lib/onboarding-path.test.mjs`
Expected: `4 ok, 0 failed`

- [ ] **Step 4: Verify the cloud round-trip needs no migration**

Run: `grep -n "onboarding" lib/sync/supabase-sync.ts`
Expected: `pushSettings` writes the whole `onboarding` object and `pullSettings` reads it back, so the new field syncs with no schema change. Confirm before proceeding.

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding.ts lib/onboarding-path.test.mjs
git commit -m "Onboarding profile carries the learning path"
```

---

### Task 3: Ask for the path during onboarding

**Files:**
- Modify: `components/onboarding-flow.tsx`
- Modify: `lib/i18n.ts`

**Interfaces:**
- Consumes: `pathOf` and `OnboardingProfile.path` from Task 2.
- Produces: onboarding writes `path` into the profile it saves.

- [ ] **Step 1: Add the strings**

In `lib/i18n.ts`, add to both language maps:

```ts
pathQuestion: { es: "¿Para qué quieres tu inglés?", en: "What do you want your English for?" },
pathChangeable: { es: "Puedes cambiarlo después. Tu progreso no se pierde.", en: "You can change this later. Your progress is kept." },
pathJobTitle: { es: "Para trabajar", en: "To work" },
pathJobBlurb: { es: "Quiero un puesto en soporte o servicio al cliente con una empresa de Estados Unidos.", en: "I want a support or customer-service job with a US company." },
pathGeneralTitle: { es: "Para hablar con confianza", en: "To speak with confidence" },
pathGeneralBlurb: { es: "Quiero conversar sin bloquearme: viajes, amigos, la familia, el día a día.", en: "I want to converse without freezing: travel, friends, family, daily life." },
```

- [ ] **Step 2: Add the step to the flow**

Read the existing step machine first: `grep -n "step\|setStep" components/onboarding-flow.tsx | head -30`. Follow whatever pattern is already there — add a `"path"` step between the goal step and the self-assessment step, storing into the same draft object the flow already accumulates, and include `path` in the object passed to the final save.

- [ ] **Step 3: Verify in the browser**

Run: `npx next dev`, then open the app with a fresh profile and walk onboarding.
Expected: the path step renders in Spanish, both options are selectable, and completing onboarding stores the choice. Confirm with the browser console: `(await (await indexedDB.databases())) && JSON.stringify((await import("/lib/db/index.js")))` is unreliable — instead check `/profile` shows the chosen path after Task 4.

- [ ] **Step 4: Commit**

```bash
git add components/onboarding-flow.tsx lib/i18n.ts
git commit -m "Onboarding asks which path she is on"
```

---

### Task 4: Switch path from the profile screen

**Files:**
- Modify: `app/profile/page.tsx`

**Interfaces:**
- Consumes: `pathOf`, `useSettings().update`.
- Produces: nothing downstream.

- [ ] **Step 1: Add the switcher**

Mirror the existing difficulty-card pattern in `app/settings/page.tsx` (three selectable cards) — read it first with `grep -n "difficulty" -A 20 app/settings/page.tsx`. Two cards, current one marked selected, tapping calls:

```ts
await update({ onboarding: { ...settings.onboarding!, path: next } });
```

Show `t("pathChangeable", lang)` underneath so switching does not feel destructive.

- [ ] **Step 2: Verify switching preserves progress**

In the browser: note stars and mastered count on `/mundo`, switch path on `/profile`, reload, and confirm both are unchanged.
Expected: identical numbers — the switch only rewrites `settings`.

- [ ] **Step 3: Commit**

```bash
git add app/profile/page.tsx
git commit -m "Let a student change path without losing progress"
```

---

### Task 5: The readiness card

**Files:**
- Create: `components/readiness-card.tsx`
- Modify: `lib/i18n.ts`

**Interfaces:**
- Consumes: `computeReadiness`, `Readiness`, `SubskillKey`, `TARGET_SCORE` from `@/lib/readiness`; `useAllAttempts`, `useAllProgress` from `@/lib/hooks/useData`; `useSettings`.
- Produces: `<ReadinessCard />` — self-contained, reads its own data, renders nothing until data is loaded.

- [ ] **Step 1: Build the card**

Follow the mockup at https://claude.ai/code/artifact/d12f71c9-6d7d-4ec9-bec6-4a99c700b2ef. Requirements, all of which the mockup already demonstrates:

- Band chip, the score in Fraunces with `font-variant-numeric: tabular-nums`, and `/ 100`.
- One line naming the target: `Meta: B2 · 80` plus the path's framing word.
- An inline SVG trajectory: 2px line, 10% opacity area fill, dashed target line labelled `B2 · 80`, and an emphasised endpoint dot with a white ring.
- Four subskill bars, all in `var(--primary)` because score is magnitude, not category. The blocker carries an amber chip containing the words `bloquea B2` — state must never be colour alone.
- `aria-label` on the SVG describing the trend in words.

- [ ] **Step 2: Verify in the browser at 393px**

Run: `npx next dev` and view `/` at iPhone width.
Expected: nothing overflows horizontally, the number is legible, and the amber chip reads as text not decoration.

- [ ] **Step 3: Commit**

```bash
git add components/readiness-card.tsx lib/i18n.ts
git commit -m "Readiness card: one number, its trend, and the blocker"
```

---

### Task 6: The new home

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `<ReadinessCard />`, `pathOf`, existing tile components already in `app/page.tsx`.
- Produces: nothing downstream.

- [ ] **Step 1: Restructure**

Order becomes: greeting, `<ReadinessCard />`, one primary CTA naming the next action, three intents, then the existing tiles inside the `showMore` expander that already exists in this file (`grep -n "showMore" app/page.tsx`).

Intents by path:

```ts
const intents = path === "job"
  ? [{ href: "/today", key: "intentPractice" }, { href: "/talk", key: "intentCall" }, { href: "/play", key: "intentExam" }]
  : [{ href: "/today", key: "intentPractice" }, { href: "/talk", key: "intentChat" }, { href: "/profile", key: "intentLevel" }];
```

- [ ] **Step 2: Verify both paths render**

Switch path on `/profile` and reload `/` each time.
Expected: three intents change per path, the readiness card is the first thing below the greeting, and every previously reachable mode is still reachable through the expander.

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit && npx eslint && npx next build`
Expected: tsc silent, no new eslint errors beyond the pre-existing React-Compiler advisories, build green with all routes.

- [ ] **Step 4: Commit and ship**

```bash
git add app/page.tsx
git commit -m "Home leads with the destination, not thirteen tiles"
git push origin main
```

Then confirm the deploy: poll `https://clara-joel-carias-projects.vercel.app/` for 200 and check the readiness card appears for a signed-in student.

---

## Self-Review

**Spec coverage.** Path choice (Tasks 2–4), readiness score and four subskills (Task 1), new home with three intents and the expander (Tasks 5–6), provisional labelling (Task 1 `provisional` flag, surfaced in Task 5), no migration required (Task 2 Step 4), switching preserves progress (Task 4 Step 2). Deliberately **not** in this plan, and tracked in the spec for later phases: stage exams and their gates, the conversation milestone's session tracking, support-English curriculum, call simulator, recruiter report.

**Known gap to close in Phase 2.** Fluency currently proxies off pass rate rather than Azure's `FluencyScore`, and the general path's 10-minute conversation milestone needs `/talk` session durations recorded, which nothing stores today. Both are honest approximations only as long as the UI does not claim otherwise, which is why `provisional` exists.

**Type consistency.** `LearningPath` is defined once in `lib/readiness.ts` and imported by `lib/onboarding.ts`; `pathOf` is the single reader; `TARGET_SCORE` is the single source of 80.
