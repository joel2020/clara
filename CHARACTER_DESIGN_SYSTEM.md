# Clara Character Design System

Authoritative production guide for Clara, the illustrated guide of the Clara
app. Every future Clara asset — master sheet, production states, responsive
derivatives, motion — is produced against this document. The typed runtime
contract lives in `lib/character.ts` (`CharacterState`, `CharacterFrame`,
`CLARA_ASSETS`) and is pinned by `lib/character-manifest.test.mjs`; if this
document and the manifest ever disagree, fix the disagreement before shipping
assets.

Role boundary, locked: **Clara is the sole learner-facing daily guide. Joel
remains the real human instructor** — his photo, voice, and video are the
teaching authority. Clara guides, accompanies, and reacts; she never replaces
or competes with Joel.

## 1. Locked identity

These traits are fixed. No asset may drift from them.

- Clearly adult, presenting approximately 25–29.
- Colombian or broadly Latin American, expressed through natural features and
  contemporary styling — never through costume shorthand, folkloric dress, or
  national symbols.
- Medium warm skin.
- Brown eyes.
- Warm dark-brown hair.
- Natural adult body proportions; expressive hands and posture.
- Contemporary, capable, conversational presence.
- Base wardrobe uses teal, ink, coral, and warm-gold accents.

## 2. Personality boundaries

Clara is **observant, encouraging, warm, and competent**.

She is never:

- childish
- maternal
- flirtatious
- performatively cheerful
- a copy of another language-learning mascot

These boundaries govern expressions, poses, motion, and any copy written in
her voice.

## 3. Illustration technique

Premium editorial 2.5D illustration:

- Clean hand-drawn contours with selective line weight.
- Natural facial anatomy.
- Softly modeled upper-left key light with warm bounce.
- Restrained paper-like texture.
- Readable silhouettes at every frame size.
- Consistent face, anatomy, materials, palette, and lighting across every
  state — cross-state consistency is a release criterion, not a preference.

Forbidden in any asset:

- stock-vector aesthetics
- cheap 3D gloss
- chibi or anime proportions
- excessive cuteness
- sexualization
- rendering-style drift between states or frames

## 4. Master-sheet gate

Before any production pose library exists, one transparent master sheet is
created and formally approved. It must show:

- Front, three-quarter, and profile construction.
- Facial landmarks and defining features.
- Adult proportion guide.
- Hands and gesture language.
- Base wardrobe and materials.
- Palette and lighting.
- The seven expressions.
- Full-body, three-quarter, bust, and 48px avatar checks.

**No pose or outfit expansion occurs before master-sheet approval.** Temporary
or inconsistent AI images are never final assets. Production states derive
from the approved sheet (and its safe areas and focal anchors) rather than
independently regenerating the face.

## 5. The seven states

The complete approved state set. Preferred framing follows the spec; every
state ships all four frames regardless.

### welcome
- Pose: open stance, direct eye contact.
- Preferred framing: full (three-quarter acceptable).
- Intended screens: dashboard hero, onboarding, daily session start.
- Emotional purpose: arrival feels expected and personal.
- Accessible meaning: Clara welcomes the learner.
- Motion opportunity: subtle breath, small hand lift.
- Reduced-motion still: `welcome-full.webp`.

### teaching
- Pose: focused expression, open-palm gesture.
- Preferred framing: three-quarter (bust acceptable).
- Intended screens: lesson intro, daily session teach step, technique tips.
- Emotional purpose: instruction feels guided and confident.
- Accessible meaning: Clara explains the exercise.
- Motion opportunity: gentle palm turn toward the content.
- Reduced-motion still: `teaching-three-quarter.webp`.

### listening
- Pose: attentive head tilt, calm face.
- Preferred framing: bust.
- Intended screens: pronunciation recording, conversation practice.
- Emotional purpose: the learner feels heard while speaking.
- Accessible meaning: Clara is listening to the learner.
- Motion opportunity: slow blink, slight tilt settle.
- Reduced-motion still: `listening-bust.webp`.

### encouraging
- Pose: small nod, supportive expression.
- Preferred framing: bust.
- Intended screens: practice feedback, retry prompt, near-miss result.
- Emotional purpose: a miss feels safe and worth retrying.
- Accessible meaning: Clara encourages another attempt.
- Motion opportunity: single small nod.
- Reduced-motion still: `encouraging-bust.webp`.

### thinking
- Pose: reflective gaze.
- Preferred framing: three-quarter.
- Intended screens: grading wait, loading states.
- Emotional purpose: waiting reads as consideration, not failure.
- Accessible meaning: Clara is thinking.
- Motion opportunity: gaze drift, faint brow shift.
- Reduced-motion still: `thinking-three-quarter.webp`.

### celebrating
- Pose: grounded joy — genuine, adult, never manic.
- Preferred framing: full (three-quarter acceptable).
- Intended screens: session completion, milestone unlock, streak celebration.
- Emotional purpose: achievement lands warmly without mascot theatrics.
- Accessible meaning: Clara celebrates the learner's achievement.
- Motion opportunity: settle-in of raised hands, soft bounce once.
- Reduced-motion still: `celebrating-full.webp`.

### store
- Pose: neutral stance.
- Preferred framing: full body.
- Intended screens: store preview.
- Emotional purpose: neutral presence; store items read clearly against her.
- Accessible meaning: Clara in the store.
- Motion opportunity: none beyond idle breath.
- Reduced-motion still: `store-full.webp`.

## 6. Frames

Every state ships four responsive derivatives:

- `full` — whole standing figure, feet included. Heroes and store preview.
- `threeQuarter` — mid-thigh up. Side-by-side layouts and tight heights.
- `bust` — shoulders up. The only frame family that crops the body; reactions
  and inline feedback.
- `avatar` — head-focused circle-safe crop that must stay readable at
  **48px** — the master sheet includes an explicit 48px avatar check. Lists,
  toasts, headers.

Default to containment. Layouts never crop `full` or `threeQuarter` art; only
approved `bust`/`avatar` assets crop the body. Preserve head, hair, face,
gesture hands, feet, and meaningful clothing details inside every frame.

## 7. Safe areas and focal anchors

Every transparent asset defines an intrinsic safe area and a focal anchor,
recorded in `CLARA_ASSETS` as normalized 0..1 numbers:

- `safeArea {top,right,bottom,left}` — transparent inset from each canvas edge
  to the figure. Production art is drawn inside it; layouts must not intrude
  into it. Gesture states widen the inset on the gesture side (teaching) or
  reserve headroom (celebrating).
- `anchor {x,y}` — the face's focal point on the full-figure canvas. Bust and
  avatar derivatives, and any sanctioned focal crop, center on this point.

The manifest's numbers are the rendering contract: assets are produced to
match them, and tests verify the manifest stays well-formed.

## 8. Motion and reduced motion

- Motion is optional micro-movement only (breath, blink, nod, gaze). No
  ambient infinite loops, no bouncing mascot energy.
- Under `prefers-reduced-motion`, render the **exact matching still** for the
  state — the `reducedMotion` path in the manifest, which is always one of the
  state's own frames, never a substitute pose or a frozen mid-animation frame.

## 9. Accessibility

- Meaningful alt text **only when Clara communicates information** (state
  changes that carry meaning: listening started, answer encouraged, session
  celebrated). Bilingual alt lives in the manifest (`alt.es`, `alt.en`).
- Empty alt (`alt=""` / `aria-hidden`) when she is decorative — the default.
- Never duplicate adjacent visible text into her alt.

## 10. File naming

All production assets are transparent WebP under `public/character/clara/`:

```
/character/clara/<state>-<frame>.webp
```

- `<state>` is one of: `welcome`, `teaching`, `listening`, `encouraging`,
  `thinking`, `celebrating`, `store`.
- `<frame>` is the kebab-case frame slug: `full`, `three-quarter`, `bust`,
  `avatar`. The TypeScript key `threeQuarter` maps to the `three-quarter`
  filename via `FRAME_SLUG` in `lib/character.ts` — that map is the single
  place the spelling difference lives.
- The master sheet is `public/character/clara/master-sheet.png`.

## 11. Future asset-generation prompt rules

When generating source artwork (OpenAI image generation or any successor):

1. Always anchor prompts to this document: locked identity traits (section
   1), technique (section 3), and the specific state's pose and framing
   (section 5) — never freestyle a new look.
2. Generate against the approved master sheet as reference; derive states
   from it instead of regenerating the face per state.
3. Name the forbidden list explicitly in negative guidance: stock-vector,
   cheap 3D gloss, chibi/anime, excessive cuteness, sexualization, costume
   shorthand, logos.
4. Request transparent backgrounds sized to the safe-area contract of the
   target state.
5. Render all derivatives of a state from one source image; verify the 48px
   avatar check before accepting any state.
6. Reject any candidate with style drift against previously approved states,
   even if individually attractive.
7. Nothing generated is final until it passes the master-sheet gate and
   human approval; interim images never ship.
