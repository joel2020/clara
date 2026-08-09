# Contextual Visual Learning — Coffee Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved Lumi-led café lesson as a production-quality visual story → tap/listen → speak → evidence-based feedback loop, with a reusable, validated scene-kit architecture that can expand only after the LATAM learner pilot passes.

**Architecture:** Curriculum records stable visual IDs. A pure manifest/resolver maps those IDs to accepted, provenance-tracked static assets. Client components layer the environment, the focused object, and the learner's currently equipped Lumi outfit while the existing practice session continues to own sequencing, recording, grading, rewards, and persistence. Higgsfield is an offline production tool only; no generation API or credential enters the application.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Next Image, Vitest/Testing Library, plain Node/tsx contract tests, Sharp, existing speech player and pronunciation pipeline, Higgsfield through the approved external asset workflow.

## Global Constraints

- This plan implements **Phase 1: Café & restaurant**. Do not generate or expose the other nine topic packs before Gate 2 records at least five unaided completions from six representative adult LATAM learners.
- Lumi is the only recurring illustrated student-facing character. Use `CharacterIllustration`; never bake Lumi, an outfit, labels, or UI into a scene asset.
- Resolve the currently equipped City Remix outfit through the character/cosmetics contract. If the requested pose is unavailable, use the same base-Lumi pose without changing the learner's saved outfit selection.
- Treat `docs/superpowers/plans/2026-08-08-lumi-experience-closet.md` Task 7 as the authority for the six outfit pose sets. This plan consumes that manifest and must not generate duplicate Lumi poses.
- Preserve the existing recording consent, pronunciation scoring, stricter LATAM thresholds, rewards, SRS, and persistence logic. Visual components never decide whether pronunciation passed.
- No runtime Higgsfield calls, keys, SDKs, URLs carrying generation tokens, learner data, names, recordings, transcripts, or free-form analytics.
- Every visual must carry meaning. The initial discovery grid contains exactly `coffee`, `menu`, `table`, and `card`; later phrase cards may use the remaining accepted café objects.
- The accepted café pack contains exactly ten object IDs: `table`, `menu`, `coffee`, `chicken`, `onion`, `meal`, `check`, `card`, `takeaway-bag`, and `change`.
- Mobile environment ≤180 KB, each object ≤60 KB, and initial story payload ≤450 KB excluding cached shell/Closet assets.
- The complete flow must work with images missing, audio failing, reduced motion enabled, keyboard only, screen reader, and at 200% zoom.
- Keep commits task-scoped. Do not merge, push, deploy, apply remote Supabase DDL, or spend Higgsfield credits without the explicit gate in the relevant task.

---

### Task 1: Add the visual-learning domain contract and pure resolver

**Files:**
- Create: `lib/visual-learning/types.ts`
- Create: `lib/visual-learning/resolve.ts`
- Create: `lib/visual-learning/resolve.test.mjs`
- Modify: `lib/db/types.ts`

**Interfaces:**

```ts
export const VISUAL_TOPIC_IDS = [
  "cafe-restaurant",
  "airport-travel",
  "hotel",
  "directions-transport",
  "work-meetings",
  "shopping-payments",
  "doctor-pharmacy",
  "introductions",
  "social-plans",
  "home-routines",
] as const;

export type VisualTopicId = (typeof VISUAL_TOPIC_IDS)[number];
export type VisualObjectId = string;
export type VisualLanguage = "en" | "es";
export type VisualFallbackClass =
  | "topic-missing"
  | "environment-missing"
  | "object-missing"
  | "outfit-pose-missing"
  | "image-decode";

export interface LocalizedVisualText {
  en: string;
  es: string;
}

export interface VisualObject {
  id: VisualObjectId;
  label: LocalizedVisualText;
  pronunciation: string;
  image: string;
  audioItemId?: string;
  alt: LocalizedVisualText;
}

export interface VisualMoment {
  pose: "idle" | "cheer" | "think" | "encourage" | "clap" | "point" | "love";
  focusObjectIds: VisualObjectId[];
}

export interface VisualTopicPack {
  id: VisualTopicId;
  environment: { desktop: string; mobile: string };
  story: {
    eyebrow: LocalizedVisualText;
    title: LocalizedVisualText;
    body: LocalizedVisualText;
    cta: LocalizedVisualText;
  };
  discoveryObjectIds: VisualObjectId[];
  entryObjectId: VisualObjectId;
  entryPhraseItemId: string;
  objects: VisualObject[];
  moments: Record<"story" | "discover" | "speak" | "success" | "retry", VisualMoment>;
}

export interface VisualRegistry {
  packs: Partial<Record<VisualTopicId, VisualTopicPack>>;
}

export function resolveTopicPack(
  registry: VisualRegistry,
  topicId?: VisualTopicId,
): VisualTopicPack | null;

export function resolveVisualObject(
  pack: VisualTopicPack,
  objectId?: VisualObjectId,
): VisualObject | null;

export function orderEntryPhraseFirst<T extends { id: string }>(
  items: readonly T[],
  entryPhraseItemId?: string,
): T[];
```

`Lesson` receives `visualTopicId?: VisualTopicId`; `PracticeItem` receives
`visualObjectId?: VisualObjectId`. Use `import type` so the database types do not pull
runtime client code into persistence modules.

- [ ] **Step 1: Write the failing pure tests**

Cover absent topic → `null`, absent object → `null`, exact ID resolution, entry phrase
promotion without mutating the source array, stable order for remaining phrases, unknown
entry ID → unchanged copy, and duplicate input IDs remaining deterministic.

- [ ] **Step 2: Confirm the focused test fails**

```bash
npx tsx lib/visual-learning/resolve.test.mjs
```

- [ ] **Step 3: Implement the minimal pure contract and type extensions**

Do not register a topic pack or refer to files that do not exist yet. `resolve.ts` must
have no browser, React, database, analytics, or filesystem imports.

- [ ] **Step 4: Verify and commit**

```bash
npx tsx lib/visual-learning/resolve.test.mjs
npm run typecheck
git add lib/visual-learning/types.ts lib/visual-learning/resolve.ts lib/visual-learning/resolve.test.mjs lib/db/types.ts
git commit -m "feat: define contextual visual learning contract"
```

---

### Task 2: Create the accepted-asset and provenance gate

**Files:**
- Create: `docs/redesign/assets/context-scene-manifest.json`
- Create: `docs/redesign/prompts/cafe-context-scenes.md`
- Create: `scripts/context-assets.mjs`
- Create: `lib/visual-learning/assets.test.mjs`
- Create directory: `public/visual-learning/cafe-restaurant/objects/`

**Manifest shape:**

```json
{
  "version": 1,
  "provider": "higgsfield",
  "runtimeGeneration": false,
  "batch": {
    "topicId": "cafe-restaurant",
    "estimatedCredits": 0,
    "approvedMaximumCredits": 0,
    "approvalStatus": "pending"
  },
  "assets": []
}
```

The zero values are a real locked state, not placeholders: the script must refuse any
`accept` operation while approval is pending. Once current Higgsfield pricing is visible,
record the estimate and user-approved maximum through the script; never hand-edit a false
approval.

**Accepted runtime filenames:**

```text
public/visual-learning/cafe-restaurant/environment-mobile.webp
public/visual-learning/cafe-restaurant/environment-desktop.webp
public/visual-learning/cafe-restaurant/objects/table.webp
public/visual-learning/cafe-restaurant/objects/menu.webp
public/visual-learning/cafe-restaurant/objects/coffee.webp
public/visual-learning/cafe-restaurant/objects/chicken.webp
public/visual-learning/cafe-restaurant/objects/onion.webp
public/visual-learning/cafe-restaurant/objects/meal.webp
public/visual-learning/cafe-restaurant/objects/check.webp
public/visual-learning/cafe-restaurant/objects/card.webp
public/visual-learning/cafe-restaurant/objects/takeaway-bag.webp
public/visual-learning/cafe-restaurant/objects/change.webp
```

**Generation prompts:**

Environment master:

```text
Premium anime-influenced 2.5D editorial illustration of a contemporary independent café
in Medellín for an adult English-learning app. Warm daylight, polished wood, restrained
coral and teal accents, clear ordering counter, menu area, tables, payment terminal, and
takeaway station. Clean contours, readable silhouettes, sophisticated adult atmosphere,
generous central and lower safe areas for live UI overlays. Empty of recurring characters.
No text, letters, numbers, logos, brands, speech bubbles, mascots, chibi proportions,
children's clip art, photorealism, or imitation of another language-learning product.
```

Object master (substitute only the bracketed noun inside Higgsfield, then save the final
prompt verbatim in provenance):

```text
Single isolated [OBJECT] for a premium adult English-learning app, matching a warm
anime-influenced 2.5D editorial café scene. Three-quarter view, clean contour, recognizable
at 96 CSS pixels, restrained modeled light from upper left, centered with safe padding,
transparent background. No person, hand, face, text, letters, numbers, logo, brand,
watermark, extra object, cast-off frame, chibi style, or photorealism.
```

- [ ] **Step 1: Write failing asset-contract tests**

Assert the manifest schema, unique runtime path and logical ID, accepted-only status,
generation ID, prompt SHA-256, model/settings, generated-at timestamp, reviewer,
reviewed-at timestamp, credit cost, and rejection reason requirements. Accepted assets
must exist; rejected assets must not use a runtime path. Also assert no secret-like keys
(`token`, `secret`, `password`, `apiKey`) and no learner fields.

- [ ] **Step 2: Confirm the tests fail**

```bash
npx tsx lib/visual-learning/assets.test.mjs
```

- [ ] **Step 3: Implement the asset CLI**

`scripts/context-assets.mjs` supports these exact commands:

```bash
node scripts/context-assets.mjs estimate --credits 24 --maximum 30
node scripts/context-assets.mjs process --source /absolute/path/to/candidate.png --id environment-mobile
node scripts/context-assets.mjs accept --id environment-mobile --generation-id <provider-id> --reviewer Joel
node scripts/context-assets.mjs reject --id environment-mobile --reason character-present
node scripts/context-assets.mjs verify
```

The example numbers demonstrate syntax only; execution must use the live estimate and the
user-approved maximum. `process` writes candidates under an ignored
`.artifacts/context-scenes/` directory, never directly to `public`. Use Sharp to:

- resize mobile environment to 780×1688 and desktop to 2880×1800;
- resize objects to a 512×512 transparent canvas without stretching;
- strip metadata;
- encode WebP;
- verify object alpha and environment opacity;
- reject files over their byte limit;
- calculate the SHA-256 recorded in provenance.

Only `accept` may copy a candidate to its exact runtime filename, and only after the cost
approval, generation ID, prompt hash, and reviewer are present.

- [ ] **Step 4: Stop at the Higgsfield cost checkpoint**

Open the approved Higgsfield workflow, inspect current per-generation credit cost, compute
one environment plus one object test including one retry each, record the estimate, and
present the maximum credit request to the user. Do not generate while the manifest says
`pending` or the approved maximum is zero.

- [ ] **Step 5: Produce and review one environment and one coffee object**

Use the exact prompts, reference settings, and one candidate per class first. Review at
320×568, 390×844, and 1440×900 with the live UI safe areas overlaid. Reject character
presence, text, logos, childish treatment, cultural cliché, unreadable object shape,
lighting mismatch, or unsafe crop. Record rejected candidates outside `public`.

- [ ] **Step 6: Generate the remaining accepted coffee pack only after the test pair passes**

Create the desktop/mobile crops from the same accepted environment master. Produce the ten
exact object IDs. Do not create Lumi assets in this task.

- [ ] **Step 7: Verify and commit accepted assets plus provenance**

```bash
node scripts/context-assets.mjs verify
npx tsx lib/visual-learning/assets.test.mjs
git add docs/redesign/assets/context-scene-manifest.json docs/redesign/prompts/cafe-context-scenes.md scripts/context-assets.mjs lib/visual-learning/assets.test.mjs public/visual-learning/cafe-restaurant
git commit -m "assets: add accepted cafe visual learning kit"
```

---

### Task 3: Register and validate the café topic pack

**Files:**
- Create: `lib/visual-learning/manifest.ts`
- Create: `lib/visual-learning/manifest.test.mjs`
- Modify: `lib/content/conversation.ts`

**Runtime contract:**

```ts
export const VISUAL_TOPIC_PACKS: VisualRegistry = {
  packs: {
    "cafe-restaurant": CAFE_RESTAURANT_PACK,
  },
};

export const CAFE_RESTAURANT_PACK: VisualTopicPack;
```

Use these exact discovery values:

```ts
discoveryObjectIds: ["coffee", "menu", "table", "card"],
entryObjectId: "coffee",
entryPhraseItemId: "conv-cafe:3",
```

Map all ten `conv-cafe` items in order to the ten exact object IDs in Global Constraints.
Use the existing item ID as `audioItemId`, so `coffee` resolves to `conv-cafe:3`. Story
copy is live bilingual text:

```ts
story: {
  eyebrow: { es: "Tu misión · Café", en: "Your mission · Café" },
  title: { es: "Pide un café con confianza", en: "Order a coffee with confidence" },
  body: {
    es: "Lumi te acompaña: primero explora la escena, después escucha y pide tu café.",
    en: "Lumi is with you: explore the scene, listen, then order your coffee.",
  },
  cta: { es: "Entrar al café", en: "Enter the café" },
}
```

- [ ] **Step 1: Write failing manifest tests**

Assert the single registered pack, ten unique objects, four unique discovery objects,
entry IDs resolving, every object having non-empty bilingual label/alt/pronunciation,
every phrase focus resolving, allowed Lumi moods only, accepted runtime paths only, and
no Higgsfield import, URL, credential, or generation call in `lib/visual-learning`.

- [ ] **Step 2: Confirm failure**

```bash
npx tsx lib/visual-learning/manifest.test.mjs
```

- [ ] **Step 3: Implement the pack and curriculum mappings**

Set `visualTopicId: "cafe-restaurant"` on `conv-cafe`. Set one `visualObjectId` on each
item after `chunks()` returns, using an explicit ten-element mapping and a length assertion
that throws during development if the authored lesson drifts.

- [ ] **Step 4: Verify and commit**

```bash
npx tsx lib/visual-learning/resolve.test.mjs
npx tsx lib/visual-learning/manifest.test.mjs
npm run typecheck
git add lib/visual-learning/manifest.ts lib/visual-learning/manifest.test.mjs lib/content/conversation.ts
git commit -m "feat: register the cafe visual topic pack"
```

---

### Task 4: Add privacy-bounded visual analytics before UI producers

**Files:**
- Modify: `lib/analytics-schema.ts`
- Modify: `lib/analytics-schema.test.mjs`

**Events:**

```ts
type VisualAnalyticsEvent =
  | "visual_topic_shown"
  | "visual_object_selected"
  | "visual_object_replay"
  | "visual_discovery_complete"
  | "visual_to_speaking"
  | "visual_fallback"
  | "visual_asset_loaded";
```

Add closed enums:

```ts
const VISUAL_FALLBACK_CLASSES = [
  "topic-missing",
  "environment-missing",
  "object-missing",
  "outfit-pose-missing",
  "image-decode",
] as const;
const VISUAL_ASSET_CLASSES = ["environment", "object", "character"] as const;
const VISUAL_LOAD_BANDS = ["under-250", "250-999", "1000-2999", "3000-plus"] as const;
```

Required properties are bounded IDs/enums only. Use `topicId`, `lessonId`, `objectId`,
`fallbackClass`, `assetClass`, and `loadBand`; never use properties containing the denied
substrings `text`, `phrase`, `audio`, `voice`, `name`, or `content`.

- [ ] **Step 1: Extend failing privacy tests**

Assert every new event validates its required bounded properties, rejects missing/invalid
required values, drops harmless unknown optional properties, rejects transcript/name/raw
fields, and cannot carry a sentence through an ID. Keep the generic all-events loop.

- [ ] **Step 2: Confirm failure, implement, and rerun**

```bash
npx tsx lib/analytics-schema.test.mjs
```

- [ ] **Step 3: Commit**

```bash
git add lib/analytics-schema.ts lib/analytics-schema.test.mjs
git commit -m "feat: bound contextual visual analytics"
```

---

### Task 5: Make pronunciation playback report real UI states

**Files:**
- Create: `lib/speech/player.test.mjs`
- Modify: `lib/speech/synthesis.ts`
- Modify: `lib/speech/player.ts`
- Modify: `components/practice/listen-button.tsx`

**Interface change:**

```ts
export interface SpeakOptions {
  rate?: number;
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export interface PlayOptions {
  // existing fields remain
  onError?: () => void;
}
```

- [ ] **Step 1: Write failing player tests**

Mock `Audio`, `speechSynthesis`, and the utterance object. Assert a second playback pauses
the first, an alternate-recording failure retries the primary recording once, a primary
failure tries synthesis, unsupported synthesis calls `onError`, synthesis error calls
`onError` rather than `onEnd`, successful completion calls `onEnd` once, and `stopPronunciation`
does not report a false failure.

- [ ] **Step 2: Confirm failure**

```bash
npx tsx lib/speech/player.test.mjs
```

- [ ] **Step 3: Implement explicit terminal states**

Keep the current cancel/replace behavior. Add a once-only terminal guard inside
`playPronunciation` so retries cannot call `onEnd`/`onError` twice. In `speak`, report
unsupported synthesis immediately and wire `utter.onerror` to `onError`; preserve current
callers that do not pass the new callback.

- [ ] **Step 4: Give the existing Listen button a visible retry state**

On terminal failure, clear `speaking`, render a small `role="alert"` message and a retry
button. Do not block recording or the next lesson action.

- [ ] **Step 5: Verify and commit**

```bash
npx tsx lib/speech/player.test.mjs
npm run typecheck
git add lib/speech/player.test.mjs lib/speech/synthesis.ts lib/speech/player.ts components/practice/listen-button.tsx
git commit -m "fix: expose reliable pronunciation playback states"
```

---

### Task 6: Build the layered context visual and story entry

**Files:**
- Create: `components/visual-learning/context-visual.tsx`
- Create: `components/visual-learning/context-story-intro.tsx`
- Create: `components/visual-learning/context-story.test.tsx`
- Create: `components/character/character-illustration-fallback.test.tsx`
- Modify: `components/character/character-illustration.tsx`
- Modify: `lib/character.ts`

**Interfaces:**

```ts
export function ContextVisual(props: {
  pack: VisualTopicPack;
  moment: keyof VisualTopicPack["moments"];
  objectId?: VisualObjectId;
  language: VisualLanguage;
  priority?: boolean;
  onFallback?: (fallback: VisualFallbackClass) => void;
}): React.ReactNode;

export function ContextStoryIntro(props: {
  pack: VisualTopicPack;
  language: VisualLanguage;
  onStart: () => void;
}): React.ReactNode;
```

- [ ] **Step 1: Write failing component tests**

Mock Next Image and `CharacterIllustration`. Assert mobile/desktop environment sources,
environment is decorative beside live story copy, exactly one Lumi layer uses the pack's
story pose without an outfit override, optional focused object uses manifest alt text,
the CTA is a ≥44px button, Enter/Space activates it, and `onFallback` receives bounded
classes on image error. In the character fallback test, assert an equipped-outfit image
failure retries the requested mood through base Lumi exactly once, preserves the saved
outfit, reports the fallback, and does not loop when base art also fails.

- [ ] **Step 2: Confirm failure**

```bash
npx vitest run components/visual-learning/context-story.test.tsx components/character/character-illustration-fallback.test.tsx
```

- [ ] **Step 3: Implement the layered scene**

Use `<picture>` for the environment so the mobile crop is selected before download. Use
Next Image with intrinsic dimensions for objects. Render `CharacterIllustration`
`mode="scene"` with the manifest mood and no direct asset path. Keep live text and controls
outside the artwork stack. Do not autoplay video.

- [ ] **Step 4: Implement safe fallbacks and reduced motion**

Environment failure becomes a neutral `bg-card` scene with a café icon and live title.
Object failure keeps the bilingual label in a stable box. Character fallback remains the
character system's responsibility: export `BASE_LUMI_ART_BASE` from `lib/character.ts`,
let `CharacterIllustration` switch from the equipped art to the same base-Lumi mood after
one image failure, and expose `onArtFallback?: () => void` so the context layer can report
`outfit-pose-missing`. Disable decorative entrance motion under
`prefers-reduced-motion`.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run components/visual-learning/context-story.test.tsx components/character/character-illustration-fallback.test.tsx
npm run typecheck
git add components/visual-learning/context-visual.tsx components/visual-learning/context-story-intro.tsx components/visual-learning/context-story.test.tsx components/character/character-illustration.tsx components/character/character-illustration-fallback.test.tsx lib/character.ts
git commit -m "feat: add Lumi-led contextual story scene"
```

---

### Task 7: Build tap/listen object discovery

**Files:**
- Create: `components/visual-learning/object-discovery-grid.tsx`
- Create: `components/visual-learning/object-discovery-grid.test.tsx`

**Interface:**

```ts
export function ObjectDiscoveryGrid(props: {
  pack: VisualTopicPack;
  language: VisualLanguage;
  synthesisSupported: boolean;
  onComplete: (objectId: VisualObjectId) => void;
}): React.ReactNode;
```

The primary continue action stays disabled until `entryObjectId` has been selected at
least once. Selecting other objects is encouraged but not required. Selection is not a
score and grants no XP/stars.

- [ ] **Step 1: Write failing behavior and accessibility tests**

Assert exactly four discovery buttons, bilingual visible labels, accessible names,
single selected state with `aria-pressed`, IPA and Spanish reveal, one playback request
per activation, later taps replace earlier playback, visible playing state, visible
failure/retry, keyboard parity, ≥44px targets, entry-object gate, and no reward/database
call.

- [ ] **Step 2: Confirm failure**

```bash
npx vitest run components/visual-learning/object-discovery-grid.test.tsx
```

- [ ] **Step 3: Implement discovery and bounded analytics producers**

Call `playPronunciation` with `audioItemId`, English label, and callbacks. Track
`visual_object_selected`, `visual_object_replay`, and `visual_discovery_complete` with
stable IDs only. Stop playback on unmount. The retry button reuses the selected object's
same bounded metadata.

- [ ] **Step 4: Verify and commit**

```bash
npx vitest run components/visual-learning/object-discovery-grid.test.tsx
npm run typecheck
git add components/visual-learning/object-discovery-grid.tsx components/visual-learning/object-discovery-grid.test.tsx
git commit -m "feat: add cafe object discovery interaction"
```

---

### Task 8: Add the focused phrase scene without changing grading

**Files:**
- Create: `components/visual-learning/context-phrase-scene.tsx`
- Create: `components/visual-learning/context-phrase-scene.test.tsx`
- Modify: `components/practice/practice-session.tsx`

**Interface:**

```ts
export function ContextPhraseScene(props: {
  pack: VisualTopicPack;
  item: PracticeItem;
  language: VisualLanguage;
}): React.ReactNode;
```

- [ ] **Step 1: Write failing phrase-scene tests**

Assert resolved object image and label, live English phrase, Spanish meaning, IPA,
manifest speak pose, missing object fallback, and no microphone/scoring/reward logic in
the component.

- [ ] **Step 2: Confirm failure**

```bash
npx vitest run components/visual-learning/context-phrase-scene.test.tsx
```

- [ ] **Step 3: Implement and place the scene in the existing speaking card**

Resolve the lesson pack once in `PracticeSession`. When `current.visualObjectId` resolves,
render `ContextPhraseScene` in place of the text-only `ProduceItemCard`; keep the existing
`ListenButton`, pronunciation cue, `ProducePanel`, result card, attempt recorder, stricter
LATAM scoring, and reward callbacks unchanged. When any ID is absent, render the current
text-only card exactly as before.

- [ ] **Step 4: Prove grading ownership did not move**

Add a source-level assertion in the test that `context-phrase-scene.tsx` does not import
`recordPracticeAttempt`, `repo`, `lib/practice`, or gamification modules. Exercise one
mocked failed and passed `ProducePanel` result to confirm Lumi's result mood still follows
the real `PracticeOutcome`, not visual state.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run components/visual-learning/context-phrase-scene.test.tsx
npm run typecheck
git add components/visual-learning/context-phrase-scene.tsx components/visual-learning/context-phrase-scene.test.tsx components/practice/practice-session.tsx
git commit -m "feat: layer cafe visuals into speaking practice"
```

---

### Task 9: Integrate the story → discover → speak lesson sequence

**Files:**
- Create: `components/practice/practice-session-visual.test.tsx`
- Modify: `components/practice/practice-session.tsx`
- Modify: `lib/i18n.ts`

**Stage contract:**

```ts
type Stage =
  | "loading"
  | "story"
  | "discover"
  | "learn"
  | "distinguish"
  | "produce"
  | "phrases"
  | "done";
```

For a resolved visual topic, initial stages are `story` → `discover` → the existing
academic drill sequence, with the entry phrase promoted to the front. The story replaces
the legacy mini-class for that lesson so the approved visual loop reaches speaking
directly; non-visual lessons retain `learn` unchanged.

- [ ] **Step 1: Write failing full-sequence tests**

Mock repository progress, speech support, analytics, and heavy child components. Assert:

- `conv-cafe` starts at story and tracks `visual_topic_shown` once;
- story CTA advances to four-object discovery;
- coffee selection and continue advances to phrase speaking;
- `conv-cafe:3` is first, remaining phrases retain authored order;
- `visual_to_speaking` fires once with bounded IDs;
- restart returns to story;
- exit before completion still records lesson abandon;
- a missing pack falls back to the old learn/phrase sequence;
- an unrelated lesson has no visual stages or changed ordering.

- [ ] **Step 2: Confirm failure**

```bash
npx vitest run components/practice/practice-session-visual.test.tsx
```

- [ ] **Step 3: Implement a single stage-transition helper**

Centralize `startStageForLesson`, `stageAfterStory`, and `stageAfterDiscovery` as pure local
helpers or a small pure `lib/visual-learning/sequence.ts` module if tests need direct
coverage. Do not scatter nested conditions through event handlers. Reset audio and index
when crossing stage boundaries.

- [ ] **Step 4: Add localized stage and action labels**

Add Spanish and English keys for `stageStory`, `stageDiscover`, `startScene`,
`chooseCoffee`, `useThisWord`, `audioUnavailable`, and `retryAudio`. Keep instructions in
live text; do not bake copy into images.

- [ ] **Step 5: Verify and commit**

```bash
npx vitest run components/practice/practice-session-visual.test.tsx components/visual-learning/*.test.tsx
npm run typecheck
git add components/practice/practice-session.tsx components/practice/practice-session-visual.test.tsx lib/i18n.ts
git commit -m "feat: connect cafe story discovery and speaking"
```

---

### Task 10: Enforce asset, accessibility, and performance budgets in CI

**Files:**
- Create: `scripts/verify-context-assets.mjs`
- Create: `docs/qa/contextual-visual-learning-checklist.md`
- Modify: `package.json`

**Automated budgets:**

```ts
const MAX_MOBILE_ENV_BYTES = 180 * 1024;
const MAX_OBJECT_BYTES = 60 * 1024;
const MAX_INITIAL_STORY_BYTES = 450 * 1024;
const REQUIRED_VIEWPORTS = [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const;
```

- [ ] **Step 1: Write the verification script as a failing gate**

Read the accepted provenance manifest and runtime files. Assert byte limits, exact image
dimensions, environment opacity, object alpha, decodable WebP, intrinsic dimensions,
unique paths, and summed initial payload. Exit nonzero with the asset ID and violated
budget; never print provider URLs or credentials.

- [ ] **Step 2: Add every new test to the standard suite**

Change `test` to run plain-node/tsx discovery plus these component tests:

```json
"test": "node scripts/test.mjs && vitest run components/accessibility-behavior.test.tsx components/settings-consent-transaction.test.tsx components/visual-learning/*.test.tsx components/character/character-illustration-fallback.test.tsx components/practice/practice-session-visual.test.tsx && node scripts/verify-context-assets.mjs"
```

- [ ] **Step 3: Add the manual accessibility/device checklist**

Require keyboard-only, VoiceOver/TalkBack or equivalent real screen reader, 200% zoom,
reduced motion, Data Saver, image failure, audio failure, offline cached pack, visible
focus over both scene crops, 44px targets, no obscured phrase/microphone/feedback, and the
four required responsive sizes. Record tester, device/browser/OS, date, result, evidence
path, and issue link for every row.

- [ ] **Step 4: Run the full local gate and commit**

Use the repository's pinned Node 24 runtime.

```bash
npm run verify
git add scripts/verify-context-assets.mjs docs/qa/contextual-visual-learning-checklist.md package.json
git commit -m "test: gate contextual visual learning quality"
```

---

### Task 11: Capture Preview evidence and run the LATAM coffee pilot gate

**Files:**
- Create: `docs/qa/evidence/contextual-visual-learning/coffee-preview.md`
- Create: `docs/qa/evidence/contextual-visual-learning/coffee-pilot.csv`
- Create directory: `docs/qa/evidence/contextual-visual-learning/screenshots/`
- Modify: `docs/qa/contextual-visual-learning-checklist.md`

**Pilot CSV columns:**

```text
participant_id,latam_region,device_class,completed_unaided,object_recognition_issue,visual_to_speaking_issue,pronunciation_transition_issue,accessibility_issue,facilitator_notes_category
```

Participant IDs are opaque (`pilot-01` through `pilot-06`). Do not store names, emails,
recordings, transcripts, free-form learner quotes, or sensitive demographic data in the
repository.

- [ ] **Step 1: Deploy only to Vercel Preview after local verification**

Confirm the Preview uses the intended branch, no production alias, the correct environment
variables, healthy Supabase connectivity, and no runtime Higgsfield variables. Record the
immutable Preview URL and commit SHA. Do not promote to Production in this task.

- [ ] **Step 2: Capture automated responsive evidence**

At 320×568, 390×844, 768×1024, and 1440×900 capture story, selected-coffee discovery,
phrase speaking, passing feedback, retry feedback, and image/audio fallback states. Keep
screenshots free of real learner identity or transcript content.

- [ ] **Step 3: Complete the real-device and screen-reader checklist**

Run iPhone Safari, Android Chrome, desktop Chromium/WebKit, one real screen reader,
keyboard only, 200% zoom, reduced motion, and throttled mid-tier mobile. Verify the initial
story payload and route performance do not regress the current approved budget.

- [ ] **Step 4: Run six adult LATAM learner sessions**

Each participant must attempt story → coffee discovery → listening → speaking → feedback
without facilitator explanation. Record only bounded issue categories and unaided
completion. A facilitator intervention makes `completed_unaided=false`.

- [ ] **Step 5: Apply the hard expansion gate**

Pass only when at least five of six complete unaided and no unresolved P0 accessibility,
identity, pronunciation-transition, data-loss, or broken-fallback issue exists. If the
gate fails, fix coffee and repeat the affected checks; do not generate the remaining nine
topic packs.

- [ ] **Step 6: Commit evidence and stop for expansion approval**

```bash
git add docs/qa/evidence/contextual-visual-learning docs/qa/contextual-visual-learning-checklist.md
git commit -m "docs: record cafe visual learning pilot evidence"
```

After this commit, report the exact completion count, device/accessibility results,
performance budget, outstanding issues, and Higgsfield credits spent. Write the separate
**Nine Topic Expansion Implementation Plan** only if Gate 2 passed and the user approves
the next credit batch.

---

## Final Phase-1 Verification

- [ ] `npm run verify` passes on pinned Node 24.
- [ ] The coffee route completes story → discover → entry phrase → real pronunciation
  feedback without visual code changing the score.
- [ ] Non-visual lessons are behaviorally unchanged.
- [ ] Equipped City Remix outfit appears in story/phrase scenes; base Lumi is safe fallback.
- [ ] No runtime Higgsfield call, key, SDK, or learner data path exists.
- [ ] Asset and initial-payload budgets pass.
- [ ] Responsive, real-device, keyboard, 200% zoom, reduced-motion, and screen-reader
  evidence is recorded.
- [ ] At least five of six adult LATAM pilot learners completed unaided.
- [ ] No P0 issue is open.
- [ ] Only then may the remaining nine topic packs enter a separately cost-approved plan.
