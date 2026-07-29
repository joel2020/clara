# Character, Store, and Humor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Lumi’s learner-facing role with a consistent premium adult Clara guide, add adult learner avatars with baseball caps and pets, and introduce reviewed Medellín humor.

**Architecture:** Character identity is asset-manifest driven: one approved master sheet precedes seven Clara production states and responsive derivatives. Learner avatars are a separate compositing system with typed slots for base, outfit, baseball cap, and pet; teaching identity cannot be changed through the store. Humor is a pure, frequency-capped content selector with explicit context restrictions and approval metadata.

**Tech Stack:** OpenAI image generation for approved source artwork, transparent PNG/WebP assets, Next.js Image, React/TypeScript, existing cosmetic/store state, Tailwind CSS, Node tests.

## Global Constraints

- Clara is the sole learner-facing daily guide; Joel remains the real instructor.
- Learner avatars are adults in their 20s and never alternate teachers.
- No childish proportions, stock-vector style, cheap 3D, excessive mascot cuteness, sexualization, copied logos, or copyrighted mascot similarity.
- Baseball caps mean baseball caps specifically; both adult avatars may equip all catalog items and pets.
- No pose/outfit expansion before the Clara master sheet is approved.
- Do not attribute invented humor to Joel before Joel approves it.
- Store currency is virtual and earned only through learning.

---

### Task 1: Character design system and manifest

**Files:**
- Create: `CHARACTER_DESIGN_SYSTEM.md`
- Modify: `lib/character.ts`
- Create: `lib/character-manifest.test.mjs`
- Modify: `scripts/test.mjs`

**Interfaces:**
- Produces: `CharacterState`, `CharacterFrame`, `CLARA_ASSETS`, safe-area metadata, focal anchors, alt-text rules, and reduced-motion mappings.

- [ ] **Step 1: Write failing manifest tests**

```js
for (const state of ["welcome","teaching","listening","encouraging","thinking","celebrating","store"]) {
  test(`${state} has all required frames`, () => {
    assert.deepEqual(Object.keys(CLARA_ASSETS[state].frames).sort(), ["avatar","bust","full","threeQuarter"].sort());
    assert.ok(CLARA_ASSETS[state].safeArea);
    assert.ok(CLARA_ASSETS[state].reducedMotion);
  });
}
```

- [ ] **Step 2: Write `CHARACTER_DESIGN_SYSTEM.md`**

Document locked face, hair, skin, adult anatomy, wardrobe, palette, illustration
technique, light, texture, expression rules, seven states, frame definitions,
transparent safe areas, anchors, motion, reduced motion, accessibility, naming,
and future asset-generation prompt rules exactly as approved in the spec.

- [ ] **Step 3: Implement typed manifest**

Use paths shaped as `/character/clara/<state>-<frame>.webp`; safe areas use
normalized `{top,right,bottom,left}` numbers and anchors use `{x,y}` in `0..1`.

- [ ] **Step 4: Run tests and commit**

Run: `node lib/character-manifest.test.mjs && npm test`  
Expected: PASS.

```bash
git add CHARACTER_DESIGN_SYSTEM.md lib/character.ts lib/character-manifest.test.mjs scripts/test.mjs
git commit -m "Define Clara premium character system"
```

### Task 2: Master sheet and seven approved states

**Files:**
- Create: `public/character/clara/master-sheet.png`
- Create: `public/character/clara/welcome-{full,three-quarter,bust,avatar}.webp`
- Create: `public/character/clara/teaching-{full,three-quarter,bust,avatar}.webp`
- Create: `public/character/clara/listening-{full,three-quarter,bust,avatar}.webp`
- Create: `public/character/clara/encouraging-{full,three-quarter,bust,avatar}.webp`
- Create: `public/character/clara/thinking-{full,three-quarter,bust,avatar}.webp`
- Create: `public/character/clara/celebrating-{full,three-quarter,bust,avatar}.webp`
- Create: `public/character/clara/store-{full,three-quarter,bust,avatar}.webp`

**Interfaces:**
- Consumes: locked specification and manifest from Task 1.
- Produces: final transparent assets only after master-sheet visual approval.

- [ ] **Step 1: Generate one master sheet**

Use the image-generation skill with the locked identity. Require front,
three-quarter, profile, facial construction, hands, adult proportions, palette,
materials, and seven expressions on one neutral sheet.

- [ ] **Step 2: Inspect the master at full and avatar scale**

Reject if face, anatomy, age, skin tone, hair, lighting, or rendering style
changes between views, or if the result reads childlike or sexualized.

- [ ] **Step 3: Obtain formal master-sheet approval**

Do not create the seven-state production library until Joel approves the sheet.

- [ ] **Step 4: Generate seven transparent canonical states**

Use the approved sheet as the only identity reference. Generate one canonical
full/three-quarter source per state, then derive bust/avatar crops from approved
focal anchors rather than independently regenerating faces.

- [ ] **Step 5: Validate assets**

Run: `file public/character/clara/* && node lib/character-manifest.test.mjs`  
Expected: every manifest path exists, transparency is preserved, and dimensions
meet the documented minimums.

- [ ] **Step 6: Commit assets**

```bash
git add public/character/clara CHARACTER_DESIGN_SYSTEM.md
git commit -m "Add approved Clara character artwork"
```

### Task 3: Clara rendering components and Lumi retirement

**Files:**
- Modify: `components/character/character-illustration.tsx`
- Modify: `components/character/character-reaction.tsx`
- Modify: `components/character/character-avatar.tsx`
- Modify: `components/character/character-preview.tsx`
- Modify: all learner-facing imports returned by `rg -l 'Lumi|lumi' app components`
- Retain: legacy assets only where required for migration safety

**Interfaces:**
- Produces: `CharacterIllustration({state, frame, meaningful, ...})` using Clara’s manifest; no learner-facing `Lumi` labels.

- [ ] **Step 1: Add failing source and manifest tests**

Assert learner-facing files contain no `Lumi`, `lumi`, or “amiga de estudio”
references and every frame renders with `object-contain` unless the manifest
explicitly approves a crop.

- [ ] **Step 2: Implement manifest-driven rendering**

Meaningful states receive localized alt text; decorative reactions use `alt=""`.
Reduced motion selects the documented still and disables floating transforms.

- [ ] **Step 3: Replace learner-facing call sites**

Map welcome, teaching, listening, encouraging, thinking, celebrating, and store
contexts intentionally. Do not add Clara to screens where she adds no meaning.

- [ ] **Step 4: Run verification and commit**

Run: `npm run typecheck && npm run lint:ratchet && npm test`  
Expected: PASS and no learner-facing Lumi references.

```bash
git add app components lib
git commit -m "Make Clara the sole daily guide"
```

### Task 4: Adult learner-avatar model and store slots

**Files:**
- Create: `lib/avatar.ts`
- Create: `lib/avatar.test.mjs`
- Modify: `lib/db/types.ts`
- Modify: `lib/store.ts`
- Modify: `lib/cosmetics.ts`
- Modify: `lib/store.test.mjs`
- Modify: `supabase/player_stats_economy.sql`

**Interfaces:**
- Produces: `AvatarBase`, `AvatarCap`, `AvatarPet`, `AvatarLoadout`, `composeAvatarLayers(loadout)`, and compatible store slots.

- [ ] **Step 1: Write failing slot and compatibility tests**

```js
test("both adult bases can equip a baseball cap and dog", () => {
  for (const base of ["adult-woman-01", "adult-man-01"]) {
    const layers = composeAvatarLayers({ base, outfit: "street-default", cap: "cap-ink", pet: "pet-golden" });
    assert.deepEqual(layers.map(x => x.slot), ["base", "outfit", "cap", "pet"]);
  }
});
test("store changes never affect assessment", () => {
  assert.equal(Object.keys(defaultLoadout()).some(k => ["level","difficulty","score","hints"].includes(k)), false);
});
```

- [ ] **Step 2: Add player fields and migration defaults**

Add `avatarBase`, `equippedAvatarOutfit`, and `equippedCap`. Keep existing pet
ownership/equipment compatible. Existing players receive non-destructive
defaults.

- [ ] **Step 3: Add original baseball-cap items**

Add solid, two-tone, curved-brim streetwear, minimal original graphic, and
Medellín-inspired colorways. Add no team or fashion-brand logos.

- [ ] **Step 4: Run tests and commit**

Run: `node lib/avatar.test.mjs && node lib/store.test.mjs && npm test`  
Expected: PASS.

```bash
git add lib/avatar.ts lib/avatar.test.mjs lib/db/types.ts lib/store.ts lib/cosmetics.ts lib/store.test.mjs supabase/player_stats_economy.sql
git commit -m "Add adult avatar customization slots"
```

### Task 5: Avatar artwork, compositor, and store preview

**Files:**
- Create: `public/avatars/adult-woman-01/*`
- Create: `public/avatars/adult-man-01/*`
- Create: `public/avatars/caps/*`
- Create: `components/avatar/avatar-preview.tsx`
- Modify: `app/shop/page.tsx`
- Modify: `components/lumi-scene.tsx` or replace with `components/avatar/avatar-stage.tsx`

**Interfaces:**
- Consumes: loadout layers from Task 4.
- Produces: a full-body responsive preview with base, outfit, baseball cap, and pet.

- [ ] **Step 1: Produce consistent adult avatar bases**

Create the adult woman and young man from a locked shared rendering standard.
The man’s initial looks are everyday nea, urban night, football-day original
colorway, and job-ready. Both remain visibly in their 20s.

- [ ] **Step 2: Produce layer-compatible baseball caps**

Use matching canvas, anchor, and safe-area metadata for every cap and hairstyle.

- [ ] **Step 3: Implement compositor**

Render layers in deterministic z-order. Keep teaching assets entirely separate
from learner-avatar equipment.

- [ ] **Step 4: Update store copy and preview**

Display **No real money · Earned through learning.** Show the selected avatar,
outfit, cap, and pet together at mobile and desktop sizes.

- [ ] **Step 5: Verify and commit**

Run: `npm run typecheck && npm run lint:ratchet && npm test && npm run build`  
Expected: PASS.

```bash
git add public/avatars components/avatar app/shop components
git commit -m "Add adult avatar and pet store preview"
```

### Task 6: Medellín humor selector and approved reaction bank

**Files:**
- Create: `lib/content/humor.ts`
- Create: `lib/humor.ts`
- Create: `lib/humor.test.mjs`
- Modify: `scripts/test.mjs`
- Modify: completion and success surfaces from the daily-loop plan

**Interfaces:**
- Produces: `selectHumorReaction({speaker, context, day, sessionId, lastStrongReactionAt})` and reaction records with `approval: "draft" | "joel-approved"`.

- [ ] **Step 1: Write failing restrictions tests**

```js
for (const context of ["consent","microphone-error","sync-error","correction","account-error"]) {
  test(`no humor during ${context}`, () => {
    assert.equal(selectHumorReaction(input({ context })), null);
  });
}
test("unapproved Joel copy is never returned", () => {
  const reaction = selectHumorReaction(input({ speaker: "joel", context: "mastery" }));
  assert.ok(reaction === null || reaction.approval === "joel-approved");
});
```

- [ ] **Step 2: Implement deterministic frequency cap**

Allow at most one strong reaction per session, use deterministic low-probability
selection, and enforce a stored cooldown. Plain-Spanish meaning and register
notes are required for slang.

- [ ] **Step 3: Draft candidate bank**

Store Clara lines as releasable reviewed copy. Store Joel candidates as `draft`
until Joel explicitly approves each line; draft lines are excluded at runtime.

- [ ] **Step 4: Integrate and commit**

Run: `node lib/humor.test.mjs && npm test`  
Expected: PASS.

```bash
git add lib/content/humor.ts lib/humor.ts lib/humor.test.mjs scripts/test.mjs app components
git commit -m "Add safe Medellin humor reactions"
```

