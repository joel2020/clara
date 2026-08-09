# Lumi Experience and Closet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Clara into a focused, delightful four-space daily learning app led consistently by the existing Lumi character and her six-outfit City Remix collection.

**Architecture:** Four route-level spaces share one responsive shell while immersive practice routes hide global navigation. Lumi identity and pose assets are controlled by a manifest. Closet pricing/unlocks and purchase quotes stay pure; the UI previews, confirms, saves locally, and syncs through the existing outbox without owning economy logic.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Base UI dialogs, Dexie/Supabase sync, Sharp, Higgsfield GPT Image 2.

## Global Constraints

- Preserve the approved current `public/character/lumi.png` character identity: face, hair, skin tone, body proportions, line treatment, and personality.
- Clara is the app; Lumi is the only recurring student-facing character. Scenario extras may be non-recurring.
- Remove Joel visuals/media, legacy Clara renders, learner avatar, caps, and pets from learner-facing routes.
- Primary learner destinations are exactly Hoy, Camino, Hablar, and Yo.
- The Closet is reached from Yo or an earned-outfit preview, not primary navigation.
- Cards and motion support comprehension. No perpetual character float beside reading or recording controls.
- Every control has a visible focus state, keyboard operation, text plus icon status, and a 44×44 CSS-pixel target where applicable.
- Never charge real money, permit a negative star balance, or sell a milestone outfit early.

---

### Task 1: Lock the four-space navigation contract

**Files:**
- Create: `lib/navigation.ts`
- Create: `lib/navigation.test.mjs`
- Modify: `components/mobile-nav.tsx`
- Modify: `components/site-header.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**

```ts
export type LearnerSpace = "hoy" | "camino" | "hablar" | "yo";
export interface LearnerNavItem {
  id: LearnerSpace;
  href: "/" | "/map" | "/talk" | "/profile";
  labelKey: string;
}
export const LEARNER_NAV: readonly LearnerNavItem[];
export function isImmersiveRoute(pathname: string): boolean;
```

- [ ] **Step 1: Write failing route-contract tests**

Assert four and only four primary items, unique labels/hrefs, Hoy at `/`, Camino at
`/map`, Hablar at `/talk`, Yo at `/profile`, and no Shop/Closet item. Assert lessons,
daily activities, exams, calls, and onboarding are immersive routes without global nav.

- [ ] **Step 2: Confirm failure**

```bash
node --experimental-strip-types lib/navigation.test.mjs
```

- [ ] **Step 3: Make desktop and mobile navigation consume one contract**

Use the existing icon map. Add `aria-current="page"`, safe-area padding, ≥44px targets,
visible focus, and label text at all supported sizes. Keep the skip link and browser zoom.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/navigation.test.mjs
npm run typecheck
git add lib/navigation.ts lib/navigation.test.mjs components/mobile-nav.tsx components/site-header.tsx app/layout.tsx
git commit -m "feat: establish Clara four-space navigation"
```

### Task 2: Make Hoy the single daily destination

**Files:**
- Create: `components/hoy/hoy-screen.tsx`
- Create: `components/hoy/daily-promise.tsx`
- Create: `components/hoy/current-focus.tsx`
- Create: `components/hoy/hoy-screen.test.tsx`
- Modify: `app/page.tsx`
- Modify: `app/today/page.tsx`
- Modify: `components/today-session-card.tsx`
- Modify: `lib/today.ts`
- Modify: `lib/today.test.mjs`

**Interfaces:**
- `/` renders the canonical Hoy state.
- `/today` uses a permanent redirect to `/` after saved links are verified.
- One primary CTA starts or resumes today's session.

- [ ] **Step 1: Write failing state and accessibility tests**

Cover first visit, resumable session, completed day, offline cached day, due pronunciation
focus, and technical provider outage. Assert the page states what the learner can say
today, why it matters, one current sound focus, estimated session size, and exactly one
primary start/resume action.

- [ ] **Step 2: Confirm focused tests fail**

```bash
npx vitest run components/hoy/hoy-screen.test.tsx
node --experimental-strip-types lib/today.test.mjs
```

- [ ] **Step 3: Extract and simplify Hoy**

Keep streak/XP secondary to the promise. Surface Lumi once as a contextual guide. Remove
the competing generic home/today CTA and all Joel conversation marketing. Let the daily
composer select the pronunciation focus from the pronunciation plan.

- [ ] **Step 4: Redirect the duplicate route and verify deep links**

Use `permanentRedirect("/")` in `app/today/page.tsx`. Update internal links and tests;
do not break a saved in-progress daily-session return URL.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run components/hoy/hoy-screen.test.tsx
node --experimental-strip-types lib/today.test.mjs
npm run typecheck
git add app/page.tsx app/today/page.tsx components/hoy components/today-session-card.tsx lib/today.ts lib/today.test.mjs
git commit -m "feat: make Hoy Clara's daily home"
```

### Task 3: Consolidate Camino and Yo

**Files:**
- Create: `components/camino/camino-screen.tsx`
- Create: `components/yo/yo-screen.tsx`
- Create: `components/camino/camino-screen.test.tsx`
- Create: `components/yo/yo-screen.test.tsx`
- Modify: `app/map/page.tsx`
- Modify: `app/profile/page.tsx`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/mundo/page.tsx`
- Modify: `components/profile-binder.tsx`

**Interfaces:**
- Camino owns units, priority sounds, stage assessments, job track, and what unlocks next.
- Yo owns meaningful progress, streak history, sound profile, settings, privacy, and Closet entry.

- [ ] **Step 1: Add failing responsibility tests**

Assert Camino exposes no duplicate settings/store/progress dashboard; Yo exposes no
separate learner avatar, caps, or pets. Assert locked content names its requirement and
progress charts have text summaries. Verify `/dashboard` redirects to `/profile` and
`/mundo` redirects to `/map` after link migration.

- [ ] **Step 2: Confirm tests fail**

```bash
npx vitest run components/camino/camino-screen.test.tsx components/yo/yo-screen.test.tsx
```

- [ ] **Step 3: Build the two screens from existing data**

Reuse current map, achievements, sound insights, and settings data rather than duplicating
queries. Rename labels in both languages. In Yo, place the Closet entry beside Lumi and
show equipped outfit plus queued-sync state.

- [ ] **Step 4: Redirect duplicates and verify**

```bash
npx vitest run components/camino/camino-screen.test.tsx components/yo/yo-screen.test.tsx
npm run typecheck
git add app/map/page.tsx app/profile/page.tsx app/dashboard/page.tsx app/mundo/page.tsx components/camino components/yo components/profile-binder.tsx
git commit -m "feat: consolidate Camino and Yo spaces"
```

### Task 4: Make Hablar and all guide identity Lumi-only

**Files:**
- Create: `components/hablar/hablar-screen.tsx`
- Create: `lib/student-facing-identity.test.mjs`
- Modify: `app/talk/page.tsx`
- Modify: `app/call/page.tsx`
- Modify: `app/virtual-call/page.tsx`
- Modify: `components/practice/duet-scene.tsx`
- Modify: `components/practice/learn-intro.tsx`
- Modify: `components/virtual-call/guide-stage.tsx`
- Modify: `lib/content/scenarios.ts`
- Modify: `lib/content/call-scenarios.ts`
- Modify: `lib/content/duets.ts`
- Modify: `lib/content/audio-manifest.ts`
- Modify: `lib/content/virtual-call-scenarios.ts`

**Interfaces:**
- `/talk` becomes the Hablar landing page for virtual calls, scenarios, duets, and speaking games.
- Every recurring guide presentation resolves through the Lumi character manifest.

- [ ] **Step 1: Write a failing learner-surface identity scan**

Scan runtime learner routes/components/content—not admin reports or formal instructor
credit—and reject Joel avatar/video imports, introductions such as “I'm Clara,” separate
learner avatars, and recurring pet characters. Assert all virtual-call openings and
visible guide labels name Lumi.

```bash
node lib/student-facing-identity.test.mjs
```

Expected: FAIL on `/talk`, `/call`, duet, lesson-intro, and legacy scenario sources.

- [ ] **Step 2: Build the Hablar landing experience**

Give each mode a concrete promise, difficulty, microphone expectation, and recent target.
Keep full calls/scenarios immersive after selection. Route scripted speaking through the
pronunciation plan's shared coach.

- [ ] **Step 3: Replace learner-facing recurring media with Lumi**

Replace `JoelAvatar`, Joel scene videos, legacy Clara render paths, and learner avatar/pet
stage elements. Update copy and audio labels so the guide is Lumi. Instructor-only coach,
reports, authorship, and teacher contact may continue to name Joel as the real instructor,
but he is not rendered as the learner's recurring practice character.

- [ ] **Step 4: Verify and commit**

```bash
node lib/student-facing-identity.test.mjs
npm test
npm run typecheck
git add app/talk/page.tsx app/call/page.tsx app/virtual-call/page.tsx components/hablar components/practice/duet-scene.tsx components/practice/learn-intro.tsx components/virtual-call/guide-stage.tsx lib/content
git commit -m "feat: make Lumi the sole learner-facing guide"
```

### Task 5: Add durable Closet unlock progress

**Files:**
- Modify: `lib/db/types.ts`
- Modify: `lib/db/dexie.ts`
- Modify: `lib/daily-session-reward.ts`
- Modify: `lib/daily-session-reward.test.mjs`
- Modify: `lib/milestone.ts`
- Modify: `lib/milestone.test.mjs`
- Modify: `lib/sync/supabase-sync.ts`
- Create: `supabase/migration-v8-closet-unlocks.sql`
- Modify: `supabase/current-schema.sql`
- Modify: `lib/sync/schema.test.mjs`

**Data additions to `PlayerStats`:**

```ts
completedDailySessions: number;
unlockedMilestones: string[];
```

- [ ] **Step 1: Add failing idempotency and migration tests**

Prove a completed daily session increments the lifetime counter once even when the reward
request repeats; missed days do not reset it; the first passed interview/call milestone
adds `first-passed-interview-call` once; legacy players default to zero/empty; and cloud
merge chooses the non-lossy counter/set result.

- [ ] **Step 2: Confirm failure**

```bash
node --experimental-strip-types lib/daily-session-reward.test.mjs
node --experimental-strip-types lib/milestone.test.mjs
node lib/sync/schema.test.mjs
```

- [ ] **Step 3: Add Dexie version 13 and migration v8**

Use a non-negative integer for completed sessions and a bounded milestone ID array. Keep
owner-only RLS and existing outbox conflict rules. Backfill legacy rows safely.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/daily-session-reward.test.mjs
node --experimental-strip-types lib/milestone.test.mjs
node lib/sync/schema.test.mjs
npm run typecheck
git add lib/db lib/daily-session-reward.ts lib/daily-session-reward.test.mjs lib/milestone.ts lib/milestone.test.mjs lib/sync/supabase-sync.ts supabase/migration-v8-closet-unlocks.sql supabase/current-schema.sql lib/sync/schema.test.mjs
git commit -m "feat: track durable Closet unlock progress"
```

### Task 6: Extend the pure Closet catalog and economy

**Files:**
- Modify: `lib/cosmetics.ts`
- Modify: `lib/store.ts`
- Modify: `lib/store.test.mjs`
- Create: `lib/closet-catalog.test.mjs`

**Interfaces:**

```ts
export type UnlockRule =
  | { type: "none" }
  | { type: "level"; level: number }
  | { type: "completed-daily-sessions"; count: number }
  | { type: "milestone"; id: "first-passed-interview-call" };

export interface ClosetEligibility {
  level: number;
  completedDailySessions: number;
  unlockedMilestones: string[];
}

export function quoteClosetAction(input: {
  cosmetic: Cosmetic;
  stats: PlayerStats;
  eligibility: ClosetEligibility;
}): { status: "equip" | "buy" | "locked"; cost: number; balanceAfter?: number };
```

- [ ] **Step 1: Write failing catalog and economy tests**

Assert the exact collection:

```text
cancha-chic     140 stars
club-lectura   160 stars
nuevo-romance  180 stars
moto-rosa      level 5 + 200 stars
retro-86       7 completed daily sessions
la-jefa        first-passed-interview-call milestone
```

Prove owned beats later lock changes, earned items cannot be bought, repeated purchase is
idempotent, insufficient balance cannot go negative, preview does not mutate state, and
equipping writes only the outfit slot.

- [ ] **Step 2: Confirm tests fail**

```bash
node --experimental-strip-types lib/store.test.mjs
node --experimental-strip-types lib/closet-catalog.test.mjs
```

- [ ] **Step 3: Implement the union unlock rule and collection**

Retain only backgrounds/effects that improve Lumi's stage. Remove learner
`avatar-outfit`, cap, and pet presentation from the exported learner catalog. Do not
delete assets until Task 10 proves no runtime references.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/store.test.mjs
node --experimental-strip-types lib/closet-catalog.test.mjs
npm run typecheck
git add lib/cosmetics.ts lib/store.ts lib/store.test.mjs lib/closet-catalog.test.mjs
git commit -m "feat: add Lumi City Remix economy"
```

### Task 7: Produce and approve the Lumi City Remix asset set

**Files:**
- Create: `docs/redesign/assets/lumi-city-remix-manifest.json`
- Create: `docs/redesign/assets/PROMPTS.md`
- Create: `scripts/process-lumi-outfit.mjs`
- Create: `scripts/validate-lumi-city-remix.mjs`
- Create: `public/character/outfits/cancha-chic-{idle,cheer,think,encourage,clap,point,love}.webp`
- Create: `public/character/outfits/club-lectura-{idle,cheer,think,encourage,clap,point,love}.webp`
- Create: `public/character/outfits/nuevo-romance-{idle,cheer,think,encourage,clap,point,love}.webp`
- Create: `public/character/outfits/moto-rosa-{idle,cheer,think,encourage,clap,point,love}.webp`
- Create: `public/character/outfits/retro-86-{idle,cheer,think,encourage,clap,point,love}.webp`
- Create: `public/character/outfits/la-jefa-{idle,cheer,think,encourage,clap,point,love}.webp`
- Modify: `lib/character.ts`
- Modify: `lib/character-manifest.test.mjs`
- Modify: `package.json`

**External action:** Higgsfield image generation spends credits. Before generating, record
the current per-image estimate and total estimate for one test plus the planned batch.

- [ ] **Step 1: Write the failing 6×7 manifest validator**

Require 42 unique accepted files, the existing seven pose IDs, exact safe canvas/aspect,
alpha transparency, optimized file-size ceiling, non-empty generation ID/model/settings,
cost, prompt hash, review status, and rejection reason for rejected candidates.

```bash
node scripts/validate-lumi-city-remix.mjs
```

Expected: FAIL because no accepted City Remix assets exist.

- [ ] **Step 2: Create the reusable Higgsfield reference**

In the approved Higgsfield workspace, upload `public/character/lumi.png` and create the
reusable element `lumi-clara-app`. Select GPT Image 2, 2K high quality, 3:4. Do not use
the realistic Soul model. Record workspace, reference-element ID, settings, credit rate,
and estimated batch cost in the manifest; never commit account credentials.

- [ ] **Step 3: Generate and review one Cancha Chic idle test**

Use the existing idle pose as the pose reference and this locked prompt pattern:

```text
Edit clothing only on the supplied Lumi character. Preserve exactly her face, eyes,
hair shape and color, skin tone, body proportions, pose, expression, anime linework,
lighting direction, and transparent background. Dress her in an oversized blue football
jersey, white pleated skort, red sneakers, and compact crossbody bag. No text, logo, flag,
extra limb, cropped hand, or background. Full character centered on the same safe canvas.
```

Reject for any likeness, anatomy, pose, transparency, text/logo, lighting, or stage-fit
failure. Stop the batch until this single file passes visual review in the actual Closet
stage at mobile and desktop sizes.

- [ ] **Step 4: Generate the remaining accepted poses**

For each outfit, inject `lumi-clara-app` plus the matching existing pose reference and
change only the clothing brief from the approved spec. Record every generation and
rejection. Generate replacements only for rejected poses; 42 accepted files is the gate.

- [ ] **Step 5: Normalize and optimize assets**

Use Sharp in `scripts/process-lumi-outfit.mjs` to validate alpha, crop/pad to the current
Lumi safe canvas without changing proportions, and emit WebP. Never overwrite the base
Lumi reference. Update `lib/character.ts` to use the new exact manifest paths.

- [ ] **Step 6: Verify visual and source contracts**

```bash
node scripts/validate-lumi-city-remix.mjs
node lib/character-manifest.test.mjs
npm run typecheck
```

- [ ] **Step 7: Commit accepted assets and provenance**

```bash
git add docs/redesign/assets/lumi-city-remix-manifest.json docs/redesign/assets/PROMPTS.md scripts/process-lumi-outfit.mjs scripts/validate-lumi-city-remix.mjs public/character/outfits lib/character.ts lib/character-manifest.test.mjs package.json package-lock.json
git commit -m "feat: add Lumi City Remix artwork"
```

### Task 8: Redesign El clóset de Lumi

**Files:**
- Create: `components/closet/closet-screen.tsx`
- Create: `components/closet/lumi-try-on-stage.tsx`
- Create: `components/closet/outfit-card.tsx`
- Create: `components/closet/purchase-dialog.tsx`
- Create: `components/closet/closet-screen.test.tsx`
- Modify: `app/shop/page.tsx`
- Modify: `components/lumi-scene.tsx`
- Modify: `lib/i18n.ts`

**Interfaces:**
- Selecting previews locally without purchase.
- Confirming consumes one pure quote, writes locally once, then enqueues sync.

- [ ] **Step 1: Add failing interaction/accessibility tests**

Cover available, locked, owned, equipped, insufficient funds, repeated confirm, milestone
unlock, local-success/queued-sync, and retry-sync states. Assert preview changes Lumi
without balance mutation; dialog names price/current/after balances; Escape and cancel
restore focus; status uses text plus icon; cards and confirmation targets are ≥44px.

- [ ] **Step 2: Confirm failure**

```bash
npx vitest run components/closet/closet-screen.test.tsx
```

- [ ] **Step 3: Build the one-stage Closet**

Rename the route UI to `El clóset de Lumi · Lumi's Closet`. Put one large responsive
try-on stage above/beside the collection. Selecting never buys. Purchase confirmation
uses the Base UI dialog, and equipped changes save locally before the existing outbox.
Failed sync retains the local outfit and shows a retryable queued message.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run components/closet/closet-screen.test.tsx
node --experimental-strip-types lib/store.test.mjs
npm run typecheck
git add components/closet app/shop/page.tsx components/lumi-scene.tsx lib/i18n.ts
git commit -m "feat: redesign Lumi's Closet"
```

### Task 9: Add purposeful motion, sound, and reduced-motion behavior

**Files:**
- Create: `lib/ui/feedback-motion.ts`
- Create: `lib/ui/feedback-motion.test.mjs`
- Create: `components/ui/meaningful-feedback.tsx`
- Modify: `components/character/character-reaction.tsx`
- Modify: `components/practice/practice-session.tsx`
- Modify: `components/closet/closet-screen.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write failing state-to-feedback tests**

Mastery and meaningful unlock may play a short success cue; retry must not play a punitive
buzzer; purchase/equip/save motion is 150–300ms; reduced-motion returns still-state class
names; optional vibration occurs only after explicit meaningful confirmation.

- [ ] **Step 2: Confirm failure**

```bash
node --experimental-strip-types lib/ui/feedback-motion.test.mjs
```

- [ ] **Step 3: Implement finite reactions and semantic feedback**

Lumi uses only existing finite reaction poses. She cannot float perpetually or obscure
target text, microphone, correction, or reading content. Ensure every animated transition
lands on a clear still and every audio cue has a visual equivalent.

- [ ] **Step 4: Verify and commit**

```bash
node --experimental-strip-types lib/ui/feedback-motion.test.mjs
npm run typecheck
git add lib/ui/feedback-motion.ts lib/ui/feedback-motion.test.mjs components/ui/meaningful-feedback.tsx components/character/character-reaction.tsx components/practice/practice-session.tsx components/closet/closet-screen.tsx app/globals.css
git commit -m "feat: add purposeful accessible feedback"
```

### Task 10: Remove unreachable legacy character systems

**Files:**
- Delete after reference proof: `components/joel-avatar.tsx`
- Delete after reference proof: `components/avatar/`
- Delete after reference proof: `lib/avatar.ts`
- Delete after reference proof: `lib/avatar.test.mjs`
- Delete after reference proof: `public/character/clara/`
- Delete after reference proof: `public/character/joel-*.{jpg,mp4,webm}`
- Modify: `lib/db/types.ts`
- Modify: `lib/store.ts`
- Modify: `lib/student-facing-identity.test.mjs`

- [ ] **Step 1: Prove runtime references are gone before deletion**

```bash
rg -n 'JoelAvatar|components/avatar|avatarBase|equippedAvatarOutfit|equippedCap|equippedPet|/character/clara|/character/joel-' app components lib --glob '!**/*.test.*'
```

Expected: no learner-runtime hits. If a migration reader still needs a legacy field, keep
the read-only type until its migration is complete but never expose it in learner UI.

- [ ] **Step 2: Delete only the proven-unreachable code and media**

Use explicit paths from the clean reference report. Do not delete teacher contact,
instructor-only coach/report credit, or base/current Lumi assets.

- [ ] **Step 3: Tighten the identity test and verify**

```bash
node lib/student-facing-identity.test.mjs
node lib/character-manifest.test.mjs
npm test
npm run typecheck
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A components/joel-avatar.tsx components/avatar lib/avatar.ts lib/avatar.test.mjs public/character/clara public/character lib/db/types.ts lib/store.ts lib/student-facing-identity.test.mjs
git commit -m "refactor: remove legacy learner character systems"
```

### Task 11: Record cross-size visual acceptance

**Files:**
- Create: `docs/verification/lumi-experience-visual-review.md`
- Create: `tests/visual/lumi-experience.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Add deterministic screenshot journeys**

Capture Hoy, Camino, Hablar, Yo, all Closet states, all seven Lumi poses, Spanish long
labels, reduced motion, 200% browser zoom, 320×568, 390×844, 768×1024, and 1440×900.
Mask timestamps and non-deterministic particles, not product content.

- [ ] **Step 2: Run the visual suite and review diffs**

```bash
npm run test:visual
```

Record reviewer, date, viewport, expected/actual, and evidence path. Reject clipped Lumi,
overlapping controls, unreadable balance/lock state, broken safe areas, or face/pose drift.

- [ ] **Step 3: Run the experience gate and commit evidence scaffolding**

```bash
npm test
npm run typecheck
npm run lint:ratchet
npm run build
git add docs/verification/lumi-experience-visual-review.md tests/visual/lumi-experience.spec.ts package.json package-lock.json
git commit -m "test: add Lumi experience visual acceptance"
```

## Experience and Closet completion gate

- [ ] Hoy, Camino, Hablar, and Yo are the only primary learner spaces; immersive routes hide global navigation.
- [ ] Lumi is the only recurring character on learner-facing routes and is named consistently.
- [ ] All 42 accepted City Remix assets pass manifest, likeness, alpha, stage-fit, and visual review.
- [ ] Exact price/level/session/milestone unlock tests, ownership precedence, and idempotent purchase tests pass.
- [ ] Closet preview, confirm, local-first equip, queued sync, and sync retry work without negative balances.
- [ ] Keyboard, reduced motion, 200% zoom, long Spanish labels, and supported viewport reviews pass.
- [ ] `npm test && npm run typecheck && npm run lint:ratchet && npm run build` exits 0.
