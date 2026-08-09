# Café context scene production sheet

Status: **complete — environment pair and all ten café objects accepted**

Higgsfield is an offline production tool for this pack. Do not put credentials, provider
payloads, learner data, generated text, or runtime generation calls in the repository.
The initial GPT Image 2 test batch used the inspected 7-credit image price and Joel's
explicit 28-credit maximum for exactly four jobs. Both environment attempts were rejected
for realism drift; both coffee attempts were rejected because their downloaded RGB PNGs
baked in a checkerboard instead of carrying alpha. That history remains in the manifest.

Joel separately approved a second test batch using Recraft V4.1: up to two 8-credit
environment jobs and up to two 10-credit coffee jobs, maximum 36 additional credits. If a
class passes on its first attempt, do not spend its retry allowance.

The Recraft coffee passed on its first attempt, so its retry was not spent. Both Recraft
environment masters initially failed a center-derived portrait crop. A later no-generation
review proved that center cropping was the failure: generation
`6ae76ed3-158e-41a2-9eeb-44b39fb52196` has a safe deterministic mobile focal crop at
`x=0.28`, `y=0.5`. That crop preserves the menu board, register, and ordering counter at
320×568 and 390×844; the same master passes at 1440×900. Its mobile and desktop files are
accepted without adding generation cost. The test pair now passes.

At that historical checkpoint, the read-only Recraft estimate was 10 credits per remaining
object, or **90 credits maximum** for nine candidates. The earlier test-batch retry allowance
did not authorize those jobs. Joel subsequently approved that separate 90-credit batch, as
recorded below and in the immutable approval history in the manifest.

## Recraft V4.1 environment revision

Use this model-specific prompt verbatim with `resolution=2k`, `model_type=standard`,
`aspect_ratio=16:9`, `count=1`, and colors `#F3B68C`, `#2A9D8F`, `#8D6E63`, `#F7F1E8`.

```text
Illustrated 2.5D editorial background, not a photograph and not an architectural render: a contemporary independent café in Medellín for an adult English-learning app. Clean anime-influenced contours, simplified shapes, cel-shaded modeled light, warm daylight, polished wood, restrained coral and teal palette, ordering counter, menu area, tables, payment terminal, takeaway station. Human-free. Generous central and lower safe areas for live UI. Sophisticated adult visual novel background. No text, letters, numbers, logos, brands, speech bubbles, mascots, chibi proportions, children's clip art, photorealism, lens effects, or imitation of another language-learning product.
```

## Recraft V4.1 coffee revision

Use this model-specific prompt verbatim with `resolution=2k`,
`model_type=utility_vector`, `aspect_ratio=1:1`, `count=1`,
`background_color=null`, and the same four-color palette.

```text
One coffee cup and saucer as a clean vector-like 2.5D editorial illustration for an adult English-learning app. Warm ceramic cup filled with coffee, three-quarter view, simple anime-influenced contour, restrained cel shading from upper left, centered, recognizable at 96 CSS pixels. Isolated subject only. No person, hand, face, text, letters, numbers, logo, brand, watermark, second object, drop-shadow background, checkerboard, colored rectangle, frame, chibi style, or photorealism. Output should contain only the object with empty transparent surroundings.
```

## Environment master

Use this prompt verbatim for the shared environment master. The mobile and desktop files
must be crops of the same accepted master.

```text
Premium anime-influenced 2.5D editorial illustration of a contemporary independent café
in Medellín for an adult English-learning app. Warm daylight, polished wood, restrained
coral and teal accents, clear ordering counter, menu area, tables, payment terminal, and
takeaway station. Clean contours, readable silhouettes, sophisticated adult atmosphere,
generous central and lower safe areas for live UI overlays. Empty of recurring characters.
No text, letters, numbers, logos, brands, speech bubbles, mascots, chibi proportions,
children's clip art, photorealism, or imitation of another language-learning product.
```

## Object master

Substitute only `[OBJECT]` in Higgsfield. Use these exact nouns: `table`; `menu`;
`plated chicken meal`; `whole and sliced onion`; `plated café meal`;
`restaurant check/bill slip`; `payment card`; `takeaway paper bag`; and
`coins and small bills`. Save the resulting prompt and its SHA-256 in candidate provenance.

```text
Single isolated [OBJECT] for a premium adult English-learning app, matching a warm
anime-influenced 2.5D editorial café scene. Three-quarter view, clean contour, recognizable
at 96 CSS pixels, restrained modeled light from upper left, centered with safe padding,
transparent background. No person, hand, face, text, letters, numbers, logo, brand,
watermark, extra object, cast-off frame, chibi style, or photorealism.
```

The exact object IDs are `table`, `menu`, `coffee`, `chicken`, `onion`, `meal`, `check`,
`card`, `takeaway-bag`, and `change`.

## Accepted environment crop contract

Both environment runtime files come from Recraft generation
`6ae76ed3-158e-41a2-9eeb-44b39fb52196`. Desktop uses the normal centered 16:10 cover
crop. Mobile uses a deterministic normalized focal point of `{ "x": 0.28, "y": 0.5 }`.
For the 2688×1536 master, that resolves to source region
`{ "left": 398, "top": 0, "width": 710, "height": 1536 }` before resizing to
780×1688. The crop metadata is part of accepted provenance and is validated by the CLI.

## Remaining-nine cost checkpoint

The remaining IDs are `table`, `menu`, `chicken`, `onion`, `meal`, `check`, `card`,
`takeaway-bag`, and `change`. A fresh read-only estimate using `recraft_v4_1`,
`resolution=2k`, `model_type=utility_vector`, `aspect_ratio=1:1`, `count=1`,
`background_color=null`, and the locked four-color palette is **10 credits per object**.
One candidate for each remaining ID is **90 credits total and maximum**.

After explicit approval, record this as a new approval rather than reusing the test batch:

```bash
node scripts/context-assets.mjs estimate --credits 90 --maximum 90 \
  --approval-id recraft-v4-1-remaining-objects-1 --model recraft_v4_1 \
  --settings '{"object":{"resolution":"2k","model_type":"utility_vector","aspect_ratio":"1:1","count":1,"background_color":null,"colors":["#F3B68C","#2A9D8F","#8D6E63","#F7F1E8"],"creditsPerJob":10,"jobLimit":9,"assetIds":["table","menu","chicken","onion","meal","check","card","takeaway-bag","change"]}}'
```

Joel explicitly approved this separate 90-credit maximum. The command was run and exactly
nine generation jobs were completed at 10 credits each. Eight objects passed full-size and
96 CSS pixel review and were accepted. The `menu` output combined an app-style control
panel with furniture/background forms and did not read as an isolated restaurant menu; it
was rejected as `unreadable-object-shape`. No retry is authorized. Do not generate a menu
replacement without a new explicit decision and cost approval.

## Approved menu retry

Joel later approved one separate 10-credit menu retry with `recraft_v4_1`,
`resolution=2k`, `model_type=utility_vector`, `aspect_ratio=1:1`, `count=1`,
`background_color=null`, and the locked four-color palette. The fourth approval ID is
`recraft-v4-1-menu-retry-1`; no other object was authorized.

The exact revised prompt was:

```text
One single analog restaurant menu booklet, standing slightly open in three-quarter view, as a clean vector-like 2.5D editorial illustration for an adult English-learning app. Dark coral bound cover, visible center spine, two cream paper pages with only a few simple horizontal line groupings and small blank image rectangles that suggest a printed food menu without forming any readable characters. Clearly a physical handheld menu booklet, not a phone, tablet, app screen, control panel, sign, table, chair, or furniture. Centered and recognizable at 96 CSS pixels, restrained cel shading from upper left, isolated subject only, true transparent surroundings. No person, hand, food, text, letters, numbers, prices, logo, brand, watermark, button grid, checkerboard, colored background, frame, chibi style, or photorealism.
```

Generation `9e27a75f-2e07-4487-92a5-ce86d71970e7` passed full-size and 96 CSS
pixel review as a clearly physical, slightly open menu booklet. It was accepted with true
alpha, and the first menu rejection remains in manifest history. All 12 runtime assets are
now accepted.

## Workflow gate

1. In the approved Higgsfield workflow, inspect the current credit cost for the selected
   still-image model and settings. Do not infer it from an old document.
2. Price four generations: one environment, one coffee object, and one retry for each.
3. Ask Joel to approve a maximum, then record the live values with:

   ```bash
   node scripts/context-assets.mjs estimate --credits <live-total> --maximum <approved-maximum>
   ```

   This short form records a deterministic **unbound** estimate and locks processing and
   acceptance. After approval, bind that same estimate with the extended form by supplying
   its generated approval ID, exact model, class-scoped asset IDs, generation settings,
   per-job cost, and job limit. Historical prompts remain attached to their own approval;
   changing the active approval never rewrites earlier provenance.

4. Generate only the environment/coffee test pair. Record the provider's exact model,
   settings, generation timestamp, generation ID, and actual credit cost. Nothing in this
   sheet pre-approves or guesses those values.
5. Process a downloaded candidate outside `public`:

   ```bash
   node scripts/context-assets.mjs process --source /absolute/path/to/candidate.png --id environment-mobile --approval-id '<active-approval-id>' --generation-id '<provider-id>' --model '<provider-model>' --settings '<json>' --generated-at '<ISO-8601>' --credit-cost '<actual-credits>'
   ```

6. Review environment and object candidates at 320×568, 390×844, and 1440×900 with the
   live UI safe areas overlaid. Reject character presence, text, logos, childish
   treatment, cultural cliché, unreadable shape, lighting mismatch, or an unsafe crop.
7. Accept only after review:

   ```bash
   node scripts/context-assets.mjs accept --id environment-mobile --generation-id <provider-id> --reviewer Joel
   ```

   Or reject outside runtime directories:

   ```bash
   node scripts/context-assets.mjs reject --id environment-mobile --reason character-present --reviewer Joel
   ```

8. Run `node scripts/context-assets.mjs verify`. Only after the environment/coffee pair
   passes review may the remaining café pack be produced.

## Delivery limits

- Mobile environment: 780×1688 WebP, opaque, at most 180,000 bytes.
- Desktop environment: 2880×1800 WebP, opaque, at most 450,000 bytes.
- Objects: 512×512 WebP on a transparent canvas without stretching, at most 60,000 bytes.
- The initial story payload is the active environment plus `coffee`, `menu`, `table`, and
  `card`; both mobile and desktop variants must total at most 450,000 bytes.
- Accepted object alpha must have meaningful transparent background coverage and transparent
  corners; one transparent pixel is not sufficient.
- Accepted environment variants must share the same generation ID, source SHA-256, and source
  dimensions; the mobile crop is recalculated from those recorded source dimensions.
- Metadata is stripped during processing. Only `accept` writes an exact runtime path.

## Fix Round 1 verification report

- Approval bypasses are closed at both processing and acceptance: active approval ID, model,
  generation settings, class and asset scope, per-job cost, job limit, prompt, and cumulative
  approval maximum must all match.
- Historical accepted and rejected attempts validate against their own immutable approval-bound
  prompts. All seven recorded rejections name Joel as reviewer.
- The accepted shared environment master is 2688×1536 with one generation ID and source hash;
  the focal crop is deterministically reproduced from those dimensions.
- Initial story payload is 140,926 bytes on mobile and 285,946 bytes on desktop, including the
  active environment plus coffee, menu, table, and card.
- Regression coverage includes stale approvals, mismatched model/settings/class/cost, exhausted
  job limits, source-master mismatch, aggregate payload overflow, opaque objects, a one-pixel
  alpha counterfeit, the exact short estimate form, the pending lock, and extended binding.
