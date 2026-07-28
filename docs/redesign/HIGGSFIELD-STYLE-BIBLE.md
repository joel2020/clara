# Clara — Higgsfield Style Bible

Date: 2026-07-28 · Branch: `redesign/premium-ui`
Status: **direction document — no assets are generated until the design direction is
approved and each asset passes the pre-generation checklist (§10).**

Clara already ships a small set of motion assets (`public/character/joel-*.{mp4,webm}`
with poster frames, `public/scenes/bg-home-medellin-*`), so a pipeline exists. This
bible exists so every future asset looks like it came from the same product, serves a
learning objective, and never puts Joel's likeness at risk.

---

## 1. Visual world

One world: **the learner's journey from Medellín to an English-speaking workplace.**
Warm, real, aspirational-but-reachable. Golden-hour Andean light, brick-and-greenery
Medellín textures (El Poblado balconies, Laureles streets), transitioning to clean,
bright U.S. office/service interiors (call floor, café counter, reception desk). The
world is *documentary-warm*, not cinematic-epic: it should feel like footage from a
well-shot recruitment film for a company you'd actually want to join.

## 2. Character treatment

- **Joel (real person, photographic).** Always photographic/filmed treatment — never
  stylized, cartoonified, avatarized, or re-rendered as a synthetic character. Motion
  assets of Joel are generated *from his own approved reference footage/stills only*
  (Higgsfield `media_import_url` reference workflow), and every output must be visually
  checkable against the reference set before use.
- **No other recurring humans.** Scenario extras (a barista, a customer) appear
  anonymous, framed away from identity (hands, over-shoulder, silhouette, defocus) so
  no synthetic face becomes a second "character" users bond with or mistake for real.
- **Lumi (drawn companion)** is out of Higgsfield's scope: she is illustration, not
  video. If she ever animates, it is 2D drawn animation in her own style — Higgsfield
  photorealism never renders her.

## 3. Joel's role

Joel appears in motion only where his presence teaches or anchors trust:
welcome/onboarding moment, unit-opening context (why this unit matters for the job),
milestone congratulations (exam passed, report earned), and instructional beats where
seeing articulation helps (mouth-position closeups for the sound track). He is the
teacher, not a mascot: no dancing, no reaction-meme loops, no green-screen pointing.

## 4. Colombian environmental references

Sanctioned: Medellín streetscapes (brick, bougainvillea, metro cable in far
background), Andean morning light, a tinto on a café table, BPO office exteriors of
the El Poblado/Ciudad del Río type. Always as *lived environment*, never postcard
montage. Prohibited: flags as set dressing, sombrero vueltiao/poncho costuming,
coffee-farm clichés, toucans/macaws, drug-culture references of any kind, poverty
tourism framing.

## 5. Color & lighting

Grade to the app: warm paper whites, soft ink shadows, one blue anchor. Golden-hour
warmth for Medellín scenes (aligns with `--co-yellow` without saturating to orange);
neutral bright daylight for workplace scenes with the app's blue (`--primary`) present
as an environmental accent (screens, uniforms, signage). No teal-orange blockbuster
grade, no neon, no purple-AI wash. Skin tones accurate and consistent — verify Joel's
against reference in every output.

## 6. Camera behavior

Locked-off or slow push-in (≤ 5% scale over the loop). Eye-level, 35–50mm equivalent,
shallow-but-honest depth. No drone swoops, no whip pans, no speed ramps, no handheld
shake. Motion inside the frame (steam, traffic bokeh, a nod) rather than camera
gymnastics — these assets sit behind or beside UI text; the camera must never compete
with reading.

## 7. Motion language

Ambient life, not spectacle: breathing-pace loops where the scene is ~90% still.
One subject motion per asset (steam rising, a smile arriving, headset going on).
Nothing loops visibly: A→B→A loops with ≥ 3s period, cut on stillness. Motion never
exceeds what `prefers-reduced-motion: no-preference` users would call calm.

## 8. Realism level

Photoreal-documentary for environments and Joel (from reference). It must read as
*plausible footage*, never uncanny: if a generation shows morphing hands, drifting
text, warped logos, or face inconsistency, it is rejected — no "close enough" ships.
Text in-scene is prohibited (AI text artifacts) except real UI screenshots composited
in post.

## 9. Production specs

| Spec | Value |
|---|---|
| Aspect ratios | 9:16 (mobile hero/milestone), 16:9 (scene establishing, ≥ md surfaces), 1:1 (avatar/inline) |
| Safe areas | Keep subject center-weighted; nothing meaningful in outer 12% (UI overlays, notches). Text overlays are app-side, never baked in. |
| Duration | Ambient loops 4–8s; instructional Joel clips ≤ 20s; milestone moments ≤ 3s |
| Loop behavior | Seamless A→B→A; first frame == poster frame == reduced-motion fallback |
| Delivery | WebM (VP9/AV1) + MP4 (H.264) pair, like existing assets |
| Budgets | Ambient loop ≤ 1.5 MB (9:16 ≤ 1080×1920 @ 24fps); instructional ≤ 4 MB; poster JPEG ≤ 120 KB |
| Poster frames | Mandatory for every video; color-graded identically; used as `poster` and as the reduced-motion/data-saver render |
| Reduced motion | Video never autoplays under `prefers-reduced-motion: reduce` — the poster renders instead (pattern already in `scene-video.tsx`; keep) |
| Routine screens | No video on drills/lists/settings — motion assets live on: onboarding welcome, unit openers, call-sim scene set, milestone moments only |

## 10. Pre-generation checklist (every asset, no exceptions)

1. **Purpose** — one sentence naming the learning/trust objective it serves.
2. **Target screen** — the exact surface and state it renders in.
3. **Why not static** — what motion communicates that a still cannot; if the answer is
   "it looks nicer", generate a still instead.
4. **2–3 direction options** — described or thumbnailed before committing spend.
5. **Reproducible prompt** — final prompt + model + settings recorded in
   `docs/redesign/assets/PROMPTS.md` (create on first generation).
6. **Specs** — dimensions, duration, codec pair, file-size target, poster frame.
7. **Likeness & consistency** — Joel assets: generated from his approved references,
   output visually verified against them; non-Joel assets: verified free of
   recognizable real-person likeness.
8. **Approval** — Joel signs off before any bulk generation; single exploratory drafts
   are fine, batches are not.

Credentials/API details never enter the repository; generation runs through the
authorized Higgsfield account outside the codebase.

## 11. Sanctioned asset shortlist (post-approval order)

1. Onboarding welcome: Joel, 9:16, warm Medellín backdrop, one nod + "bienvenida"
   energy, ≤ 8s loopable (replaces static-only first impression).
2. Call-sim scene set: three 16:9 establishing loops (call floor day, café counter,
   reception) behind the persona cards — context, not decoration.
3. Unit openers for the job track: 2–4s scene stingers (headset on, screen glow).
4. Milestone stamp moment: a 2–3s Joel congratulations for exam-pass only.
5. Interview-room establishing shot for interview prep.

## 12. Prohibited uses (restating the hard lines)

Decorative video behind reading text · motion that harms readability or battery ·
large files on routine screens · generic AI avatars or a synthetic "second Joel" ·
inconsistent character appearance across assets · spectacle replacing unclear UX ·
video in every lesson · visuals unrelated to the learning objective · any generation
before direction approval · any asset that fails the likeness check.
