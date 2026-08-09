# Clara Contextual Visual Learning Design

**Date:** 2026-08-08  
**Status:** Approved design  
**Audience:** Adult English learners from LATAM  
**Related specifications:**

- `2026-08-07-clara-best-in-class-production-design.md`
- `2026-07-29-daily-classroom-and-character-system-design.md`
- `../plans/2026-08-08-lumi-experience-closet.md`
- `../plans/2026-08-08-latam-pronunciation.md`

## 1. Summary

Clara will add a contextual visual-learning layer inspired by the clarity and momentum
of leading language-learning apps without copying their characters, brand, path, or
reward choreography. Images must teach, not decorate.

The approved interaction is:

1. **Enter a Lumi-led real-life story.**
2. **Tap a relevant object, hear its English pronunciation, and see its Spanish
   meaning.**
3. **Use that object inside a useful phrase and speak it.**
4. **Receive evidence-based pronunciation feedback and a matching Lumi reaction.**

The first vertical slice is **Café & restaurant**. After it passes visual, usability,
accessibility, performance, and learner review, the same curated scene-kit system rolls
out to nine additional adult real-life topics.

Higgsfield is an offline asset-production tool only. Clara never generates lesson art at
runtime and never sends learner data, recordings, transcripts, names, or generated lesson
content to Higgsfield.

## 2. Goals

- Make meaning immediately visible for concrete words and real-life phrases.
- Turn visual recognition into listening and regular speaking practice.
- Preserve Lumi as the only recurring student-facing character.
- Show Lumi in the learner's currently equipped City Remix outfit throughout lessons.
- Give daily practice the clarity, delight, and forward momentum expected from a leading
  learning app while keeping Clara adult, culturally grounded, and distinct.
- Reuse approved assets safely across lessons instead of generating hundreds of nearly
  identical frames.
- Keep lessons fast, offline-tolerant, accessible, and functional when an asset is missing.
- Create a scalable content contract that can eventually cover the wider curriculum.

## 3. Non-goals

- Copying Duolingo's mascot, illustration style, interface, sounds, path, or animations.
- Generating an image during a student's lesson.
- Adding another recurring guide, mascot, teacher, pet, or named character.
- Giving every abstract word an arbitrary decorative picture.
- Replacing Clara's pronunciation assessment or three-attempt coaching system.
- Generating the entire curriculum before the coffee vertical slice is validated.
- Baking a fixed Lumi outfit into a scene background.
- Retaining learner audio or expanding analytics to unrestricted text.

## 4. Experience principles

### 4.1 Images carry instructional meaning

Every visual must do at least one of these jobs:

- establish the real-world context;
- make a concrete object recognizable;
- disambiguate a minimal pair or phrase meaning;
- focus attention on the word being pronounced;
- communicate Lumi's current teaching or feedback state.

If an image does none of those jobs, it does not ship.

### 4.2 Context-aware coverage

Visual treatment depends on the content:

- **Concrete objects:** a clear isolated illustration plus its use in a scene.
- **Situation phrases:** a Lumi-led scene with the relevant object or location emphasized.
- **Minimal pairs with drawable meanings:** two distinct object illustrations presented
  with equal visual weight.
- **Abstract language, grammar, and sounds:** an approved Lumi gesture, mouth-position
  diagram, rhythm treatment, or existing text/icon experience. Clara does not force a
  literal image where one would confuse the learner.

### 4.3 One focal task

Speaking cards show one focal illustration or one highlighted phrase. Discovery rounds
show at most four tappable objects at once. A topic pack may contain more objects, but the
interface reveals them in small, learnable groups.

### 4.4 Adult tone

The experience may be playful, expressive, and rewarding, but it is not preschool-like.
Copy, object choices, outfits, scenarios, and feedback target adult travel, work, health,
social, and daily-life needs.

## 5. Approved coffee learning loop

### 5.1 Story entry

The lesson opens inside the café environment. Lumi appears in the currently equipped
outfit and explains the immediate goal: order a drink. The primary action is **Start the
scene**.

### 5.2 Tap and listen

The learner sees up to four useful café objects. Tapping **coffee**:

- selects the object visibly;
- plays the approved English pronunciation;
- shows `coffee`, `/ˈkɔːfi/`, and `café`;
- exposes a replay control that remains keyboard and screen-reader accessible.

The tap is not scored. It prepares the learner to speak.

### 5.3 Use the phrase

The selected object appears in:

> Can I have a **coffee**, please?  
> ¿Me das un café, por favor?

The learner listens if desired, then starts the existing consent-protected recording
flow. The illustration remains supportive and never covers the microphone, phrase,
translation, or feedback controls.

### 5.4 Pronunciation feedback

The existing pronunciation evidence determines the outcome. Lumi may celebrate,
encourage, listen, or point, but she never invents success. The primary result remains
Clear, Almost, or Try again, with the stricter LATAM pronunciation policy and a concrete
next cue. Raw provider scores remain secondary.

## 6. Initial topic packs

The first release covers these topics in order:

1. Café and restaurant
2. Airport and travel
3. Hotel
4. Directions and transportation
5. Work and meetings
6. Shopping and payments
7. Doctor and pharmacy
8. Introductions
9. Social plans
10. Everyday home routines

Each pack contains:

- one approved environment background and mobile crop;
- six to ten approved object illustrations;
- English and Spanish object labels;
- IPA or the curriculum's approved pronunciation notation;
- a link to an existing static audio item or the approved TTS path;
- three to five Lumi story/feedback moments selected from the existing pose contract;
- phrase-to-object focus mappings;
- accessible labels and decorative/informative image rules;
- generation provenance and review status for every produced asset.

## 7. Visual and character direction

### 7.1 Lumi identity lock

Lumi remains the existing adult anime character. Higgsfield generation must preserve her
face, hair, skin tone, body proportions, line treatment, lighting, and personality. The
approved `lumi-clara-app` reference element and matching pose reference are required for
every new Lumi generation.

Lumi is the only recurring guide. Scenario extras may appear as anonymous background
figures or partial service interactions, but they do not become named or recurring
characters.

### 7.2 Art technique

Use the existing premium anime-influenced 2.5D editorial treatment:

- clean contours and readable silhouettes;
- restrained modeled light consistent with the current Lumi set;
- recognizable objects at small mobile sizes;
- contemporary adult environments;
- no baked labels, logos, UI, speech bubbles, or generated text;
- no chibi proportions, childish classroom clip art, realism drift, sexualization, or
  imitation of another learning product.

### 7.3 City Remix integration

Scene packs are layered rather than flattened:

1. the environment background;
2. optional object illustration or highlight treatment;
3. a transparent Lumi pose resolved from the character manifest and the currently
   equipped City Remix outfit;
4. live HTML text and controls.

The six approved outfits remain:

- Cancha Chic
- Club de Lectura
- Nuevo Romance
- Moto Rosa
- Retro 86
- La Jefa

The lesson does not assign a fixed outfit by topic. The learner's equipped choice carries
through every scene. If the selected outfit/pose asset is unavailable, Clara uses the
same pose in base Lumi. It never displays a broken image or silently switches the owned
outfit record.

This composition prevents a ten-topics by six-outfits by multiple-poses asset explosion.

## 8. Content and component architecture

### 8.1 Stable identifiers

The curriculum stores stable visual identifiers, never ad hoc file paths. The intended
shape is:

```ts
type VisualTopicId =
  | "cafe-restaurant"
  | "airport-travel"
  | "hotel"
  | "directions-transport"
  | "work-meetings"
  | "shopping-payments"
  | "doctor-pharmacy"
  | "introductions"
  | "social-plans"
  | "home-routines";

interface VisualObject {
  id: string;
  label: { en: string; es: string };
  pronunciation: string;
  image: string;
  audioItemId?: string;
  alt: { en: string; es: string };
}

interface VisualTopicPack {
  id: VisualTopicId;
  environment: { desktop: string; mobile: string; reducedMotion?: string };
  objects: VisualObject[];
  moments: Record<string, {
    pose: "idle" | "cheer" | "think" | "encourage" | "clap" | "point" | "love";
    focusObjectIds: string[];
  }>;
}
```

`Lesson` receives an optional topic-pack identifier. `PracticeItem` receives an optional
object/focus identifier. Existing lessons with neither field keep their current behavior.

### 8.2 Manifest ownership

One reviewed visual manifest owns topic, object, phrase, asset, accessibility, and
provenance relationships. Runtime components consume a typed, validated projection of
that manifest. The character manifest remains the sole owner of Lumi poses and outfits;
the visual manifest references pose IDs rather than duplicating character paths.

### 8.3 UI boundaries

- `ContextStoryIntro`: environment, Lumi layer, story copy, and one start action.
- `ObjectDiscoveryGrid`: up to four labeled object buttons with selection and replay.
- `ContextPhraseScene`: the focused object, live phrase text, translation, and Lumi pose.
- `ContextVisual`: shared resolver and safe fallback boundary.

The existing `PracticeSession`, `LearnIntro`, `ProducePanel`, and pronunciation modules
remain responsible for sequencing, capture, grading, rewards, and persistence. Visual
components do not recalculate scores or grant rewards.

## 9. Asset production workflow

### 9.1 Cost gate

Higgsfield spends credits. Before any generation batch, record the current per-image
estimate, the planned candidate count, and the maximum approved batch cost. Generate one
coffee test per asset class before authorizing the remaining pack.

### 9.2 Production order

1. Confirm the existing Lumi reference element and locked generation settings.
2. Generate one café environment without Lumi or text.
3. Generate one isolated coffee object with the approved object style.
4. Generate or validate one transparent City Remix Lumi pose.
5. Compose the three layers in a local preview at 320×568, 390×844, and desktop sizes.
6. Review character identity, object recognition, contrast, safe areas, and stage fit.
7. Record generation ID, prompt hash, model/settings, cost, reviewer, and outcome.
8. Only after the coffee test is accepted, generate the remaining coffee objects.
9. Do not begin the remaining nine topic packs until the coffee lesson passes the learner
   and performance gates.

### 9.3 Rejection rules

Reject face or hair drift, skin-tone change, anatomy/hand defects, pose mismatch, missing
limbs, unreadable objects, inconsistent light, baked text, logos, opaque character
backgrounds, cultural cliché, childish treatment, or incorrect clothing. Rejected files
remain outside runtime asset directories and record a rejection reason.

## 10. Audio and interaction behavior

- Object buttons use existing approved static audio where available.
- When static audio is unavailable, the existing authenticated TTS route may be used;
  visual code does not introduce a second speech provider.
- Rapid repeated taps cancel or replace the prior playback rather than overlapping audio.
- Selected, playing, loading, and failed states have text/icon treatment, not color alone.
- A failed object-audio request leaves the word and translation available and offers
  retry; it never blocks the speaking exercise.
- The object discovery step is preparation and does not spend mastery rewards.

## 11. Error handling and fallbacks

The lesson always remains usable:

- missing topic pack → current lesson UI;
- missing environment → current scenario glyph or neutral surface;
- missing object image → labeled text/icon object button;
- missing equipped outfit/pose → base Lumi in the requested pose;
- image decode/network failure → same safe fallback without layout collapse;
- audio failure → visible retry plus phrase/speaking continuation;
- reduced motion → approved still composition;
- offline after assets are cached → the current pack continues without generation or
  external image calls.

Fallback events use bounded identifiers only. No raw lesson text or learner data enters
logs or analytics.

## 12. Accessibility

- Every tappable object is a real button with a visible bilingual label and accessible
  name.
- Object images inside labeled buttons are decorative unless they convey information not
  present in text.
- Informative scene art receives concise localized alt text; decorative environment and
  Lumi layers use empty alt text when adjacent live copy communicates the same meaning.
- Keyboard, switch, screen reader, 200% zoom, and reduced-motion users complete the same
  flow.
- Focus remains visible over light and dark artwork.
- No instruction relies on position, color, animation, or image recognition alone.
- The layout supports 320×568, 390×844, 768×1024, and 1440×900 without hiding the phrase,
  microphone, translation, or feedback.

## 13. Performance and delivery

- Prefer AVIF/WebP for backgrounds and WebP/PNG with alpha for transparent objects and
  Lumi poses according to browser support and the existing character contract.
- A mobile environment still targets at most 180 KB.
- An isolated object targets at most 60 KB.
- The initial above-the-fold visual payload for a lesson targets at most 450 KB, excluding
  assets already cached from the shell or Closet.
- Load only the active topic pack. Lazy-load later objects and feedback poses.
- Do not autoplay background video beside reading or recording controls. Existing scene
  video may appear at story entry, with a still for reduced motion and constrained data.
- Preserve intrinsic dimensions/aspect ratio to prevent layout shift.
- The release performance gate uses real mid-tier mobile throttling and p75 field data
  when available; the coffee pilot may not regress the approved route budget.

## 14. Privacy and analytics

Allowed bounded events include:

- topic pack shown;
- object selected;
- pronunciation replay requested;
- object discovery completed;
- transition from visual discovery to speaking;
- safe fallback class;
- asset load timing category.

Event properties use stable lesson/topic/object IDs and bounded numeric/category fields.
They never contain email, name, access token, cookies, raw audio, unrestricted transcript,
free-form learner speech, or provider payloads.

## 15. Testing

### 15.1 Contract tests

- every visual ID is unique and bounded;
- every referenced asset exists in an accepted manifest entry;
- every object has English, Spanish, pronunciation, and accessibility metadata;
- every moment uses an allowed Lumi pose;
- every approved outfit resolves the requested pose or the documented base fallback;
- no runtime module contains Higgsfield credentials or generation calls;
- asset dimensions, alpha requirements, formats, and file-size ceilings pass;
- rejected candidates cannot appear in the runtime manifest.

### 15.2 Behavior tests

- tap selects one object, exposes meaning, and triggers one audio request;
- a later tap stops/replaces earlier playback;
- keyboard and accessible-name interactions match pointer behavior;
- discovery advances to the correct phrase and existing speaking flow;
- pronunciation feedback continues to use provider evidence and policy thresholds;
- every missing-image/audio/outfit state produces the intended fallback;
- reduced motion never receives an essential animation-only state.

### 15.3 Visual and device evidence

Capture the coffee flow at 320×568, 390×844, 768×1024, and 1440×900. Release evidence
includes iPhone Safari, Android Chrome, and desktop Chromium/WebKit coverage, plus a real
screen-reader pass. Automated screenshots support but do not replace real-device review.

## 16. Rollout and success gates

### Gate 1: Coffee content and static prototype

- approved environment, initial objects, and relevant Lumi layering;
- complete tap/listen/speak/feedback sequence;
- no character, object, accessibility, or performance blocker.

### Gate 2: LATAM adult learner pilot

At least six representative adult LATAM learners attempt the coffee lesson. At least five
must complete the visual-to-speaking loop without facilitator explanation. Record
confusion, object-recognition failures, copy problems, pronunciation transition failures,
and accessibility/device issues. A failure prompts revision before batch expansion.

### Gate 3: Remaining topic production

Generate and integrate one topic at a time. Each pack passes the same manifest, visual,
device, accessibility, and performance gates. Credit approval is batch-specific.

### Gate 4: Production release

- all ten intended packs are either accepted or explicitly held back; incomplete packs
  never appear as broken options;
- the coffee and representative non-coffee flows pass the production build and real-device
  matrix;
- fallback and asset-load error rates are healthy in Preview;
- the deployed application reports the expected City Remix outfit inside scenes;
- no raw learner content appears in asset, logging, or analytics systems.

## 17. Definition of done

- The approved Lumi-led loop is live for the accepted topic packs.
- Coffee was validated before the remaining batch was produced.
- Concrete targets use functional illustrations; abstract targets use an appropriate
  diagram/gesture or the existing non-visual experience.
- Tap/listen transitions into regular speaking and stricter pronunciation feedback.
- The equipped City Remix outfit appears dynamically with safe base-Lumi fallback.
- Higgsfield generation is offline, provenance-tracked, cost-gated, and character-reviewed.
- All manifest, behavior, accessibility, typecheck, lint, test, audit, and production-build
  gates pass.
- iPhone, Android, desktop, screen-reader, reduced-motion, and responsive evidence is
  recorded.
- Production metrics show no blocking asset failures or unacceptable performance
  regression.

