# Clara Character Design System

Date: 2026-07-28 · Branch: `phase1/game-redesign`
Executable gate: `lib/character.test.mjs` (201 checks, runs in the stock suite).

## 1. Roles (the factual identity split, from product history)

| Figure | Is | Is not |
|---|---|---|
| **Clara** | The product and its editorial voice (copy, honesty architecture). | A rendered character. |
| **Joel** | The human teacher and **primary guide**: his photo, his ElevenLabs voice, his video moments. Teaches, corrects, hosts the call. | Replaceable by an avatar. |
| **Lumi** | The recurring illustrated **companion and store model** — drawn to mirror the learner (history: her skin tone was tuned "to match the student she was made for"), dressed by the learner with speaking-earned stars, reacting to wins and misses. | A teacher, a coach, or a competing guide. She never explains content or gives corrections. |

One guide, one companion: every placement decision follows from this. Where
instruction happens, Joel is present; where feeling happens (effort, reward,
identity), Lumi is.

## 2. Asset inventory (existing, approved — no art generated on this branch)

- **Base pose set** `public/character/lumi{,-cheer,-think,-encourage,-clap,-point,-love}.png` (idle/wave share the base; 8 moods → 7 files) + `lumi-depth.png` (shared depth map).
- **Outfit sets** `public/character/outfits/<name>{,-cheer,…}.png` × 9 outfits (`rosa, sport, verano, elegante, invierno, jean, cargo, noche, feria`), 7 files each — same girl, same silhouette, one illustration style (OpenAI-set, unified 2026-07-10; skin-tone pass 2026-07-27).
- **Joel media** `public/character/joel-*.{mp4,webm,jpg}` — separate system (photo/video, not illustration); never mixed into Lumi components.
- Integrity is executable: the test resolves every mood × every catalog outfit base to a real file and flags orphaned pose files.

## 3. Central config and naming

`lib/character.ts` is the single source: `MOODS` (8), `MOOD_SUFFIX` (file
naming contract: `<base><suffix>.png`), `artFor(base, mood)`, `MODES`,
`BUST_FOCAL`, `CHARACTER` (id, role, bilingual meaningful alt). The legacy
`components/lumi.tsx` re-exports mood types from here — no second definition
exists. New outfits must ship the full 7-file pose set under
`/character/outfits/<name>` and a catalog `outfit` base; the test then covers
them automatically.

## 4. Display modes and safe areas

`components/character/` — `CharacterIllustration` (modes), `CharacterAvatar`,
`CharacterReaction`, `CharacterPreview`:

| Mode | Fit | Use | Safe-area rule |
|---|---|---|---|
| `full` | contain | Hero/celebration moments | Whole figure always visible; container sets height, art never stretches |
| `three-quarter` | contain | Tight side-by-side cards | 3:4 aspect, contain — no clipping |
| `bust` | **focal** (cover + central focal table) | Reactions, headers | The only deliberate crop: `BUST_FOCAL[mood]` (scale + focal-y) centralizes per-pose face framing — call sites never hand-tune crops |
| `avatar` | focal | Identity dots ≥ 44px | Same focal table, circular ring |
| `scene` | contain | Store preview / stage (`CharacterPreview` → `LumiScene`) | Figure contain-fit on stage; height steps 224→256→288px at 320/400/640 so head, hands, and hem survive every width |

`object-cover` is banned in character components except the single focal
branch of `CharacterIllustration`, which must be driven by `BUST_FOCAL`
(test-enforced: exactly one occurrence, and only alongside the central table).

## 5. Outfit compatibility

Every render resolves art via `equippedOutfitBase(player)` (or an explicit
`outfit` prop for previews), so all modes work for all outfits by
construction; the shared silhouette means `BUST_FOCAL` and the depth map hold
across outfits. The store preview shows the *equipped* stage; card taps
preview via the confirmation flow.

## 6. Animation & reduced motion

Reactions may use the finite `animate-cheer` (0.75s, both). Ambient infinite
motion (`animate-float`) is banned in the new components (test-enforced);
`lumi-sway` remains only in the legacy depth stage and is allowlisted in the
typography gate as infinite-non-text. All motion dies under
`prefers-reduced-motion` via the global kill switch; every state is designed
to read correctly as a still.

## 7. Alt-text rules

Decorative by default: `CharacterIllustration` renders `aria-hidden` with
empty alt unless a meaningful `alt` is passed. Pass the central
`CHARACTER.alt[lang]` (or a more specific description) ONLY where she carries
information a sighted user gets (e.g. an outfit preview). In
`CharacterReaction`, the *line* carries meaning; the art stays hidden.

## 8. Migrated placements (this branch)

Store preview (`CharacterPreview`), onboarding placement result, `/mundo`
header, practice produce-panel (companion during attempt + result reaction).
Unmigrated surfaces keep working through the legacy `Lumi` component and
migrate opportunistically — she is deliberately NOT added to any screen she
wasn't already on.

## 9. Future final-asset requirements (for the approved adult-restyle, when commissioned)

Per the premium direction (adult 18–35, one illustrated world beside Joel's
photography): a single commissioned character system replacing the current
anime-adjacent set — same girl, aged into a young professional; **deliverables
per outfit:** 7 poses (the existing mood contract), transparent PNG ≥ 896×1200,
consistent face/hair/proportions across all poses and outfits, one light
source, silhouette-compatible with a shared depth map; **initial set:** base +
the 9 existing outfit concepts re-rendered; **style:** drawn/editorial warmth
(not anime, not photoreal — never uncanny next to Joel's photos), Clara
palette; **process:** style bible approval → one-pose test across 3 outfits →
full set; file naming exactly as §3 so the entire system swaps by replacing
files. No generation happens without explicit approval (HIGGSFIELD-STYLE-BIBLE
§10 checklist applies to any AI-assisted route).
