# Clara — Higgsfield Asset Prompt Pack

Original assets only. No copyrighted characters, celebrity likenesses, trademarked
brands, or copyrighted footage. Art direction: a premium animated language app for
a 22-year-old woman from Medellín — warm, stylish, playful, cinematic, aspirational,
culturally familiar **without** stereotype (no sombreros, no clichés). One coherent
visual world across every screen. Matches Lumi's existing OpenAI chibi/anime style:
soft shapes, warm golden-hour palette, Colombian tricolor accents (yellow/blue/red)
used sparingly.

Shared palette: warm cream `#faf7f1`, golden `#f2c94c`, deep blue `#123a93`, coral
`#e06a5a`, sage `#7fb08a`. Soft grain, gentle depth, glass only where it aids clarity.

Delivery rules for every asset:
- **Video**: H.264 MP4 **and** VP9/AV1 WebM, ≤1.5 MB per 6–8 s loop, ≤720p on the
  long edge, 24 fps, no audio track. Always ship a matching WebP/JPEG **poster**.
- **Stills**: WebP (AVIF optional), transparent PNG only when alpha is required.
- Respect `prefers-reduced-motion`: swap every loop for its poster still.
- Respect Data Saver / slow connections: load poster first, lazy-load the loop on
  viewport + fast-connection only (`navigator.connection.saveData`, `effectiveType`).

Naming: `bg-<scene>-<ratio>.<ext>`, `loop-<scene>-9x16.<ext>`, `fx-<name>.<ext>`,
`ill-<name>.<ext>`; posters share the basename with `-poster.webp`.

---

## 1. Home landscape — Medellín golden hour (subtle, ambient)

**Corrected 2026-07-31.** The original prompt asked for a scene "inspired by the
*feeling* of Medellín" with "terracotta rooftops", and got exactly what that
describes: a Mediterranean hill town — white stucco villas, tiled roofs, gentle
Tuscan farmland. That is not Medellín, and a learner from there notices
immediately. Medellín is specific and must be prompted specifically: a narrow
valley (the Aburrá), steep Andean slopes rising on BOTH sides, dense
**unpainted red-orange brick** houses with flat roofs stacked up the hillsides,
a cluster of high-rise towers on the flat valley floor, tropical greenery and
palms, and window lights spreading across the barrios at dusk.

**Prompt:**
> Soft painterly anime-style illustrated background, Studio Ghibli inspired,
> warm and calm, wide cinematic 16:9. The real city of MEDELLÍN, COLOMBIA at
> golden-hour sunset from a hillside lookout in the Aburrá Valley: a long narrow
> valley with steep green Andean mountains rising sharply on both the left and
> right and closing the distance; the valley floor and lower slopes densely
> packed with characteristic unpainted red-orange brick buildings, small
> flat-roofed houses stacked tightly and climbing high up the steep hillsides in
> irregular rows; a cluster of modern white and glass high-rise apartment towers
> on the flat valley floor in the middle distance; lush tropical vegetation and
> palms between the buildings; warm amber and rose sunset sky with soft tropical
> cumulus catching gold light over the ridges; the first tiny warm window lights
> beginning to twinkle across the brick hillsides. No terracotta tile roofs, no
> white Mediterranean stucco villas, no Tuscan rolling farmland, no European
> village. Gentle hand-painted texture, no text, no people, no logos.

- **Use:** Home hero backdrop behind Lumi + the greeting/HUD.
- **Ratio / format:** 16:9 master, also export 3:2 crop for the hero card. MP4 + WebM loop, WebP poster.
- **File:** `bg-home-medellin-16x9.mp4` / `.webm` / `bg-home-medellin-16x9-poster.webp`
- **Fallback:** poster still (already the app's SVG scene layer as ultimate fallback).
- **Motion:** autoplay, muted, loop; reduced-motion → poster.

---

## 2. Vertical cinematic learning-mode loops (6)

Shared spec: 9:16, 6–8 s seamless loop, shallow depth of field, warm cinematic
grade, background-blurred so foreground UI/captions stay legible, **no readable
text/logos**, diverse everyday people seen loosely (not hero portraits, no
celebrity likeness). Autoplay muted + loop behind the exercise; reduced-motion →
poster; low-priority lazy-load after the lesson content.

| Scene | Prompt seed (prefix all with the shared spec) | File |
|---|---|---|
| Café | "Cozy sunny specialty café, warm wood + plants, out-of-focus barista and patrons chatting, steam rising from a cup in soft foreground bokeh, golden window light." | `loop-cafe-9x16` |
| Airport / travel | "Bright modern airport departures hall, soft-focus travelers with rolling bags, big windows, a plane visible on the tarmac in warm haze, hopeful morning light." | `loop-travel-9x16` |
| Restaurant | "Warm evening restaurant table setting, candle glow, blurred diners and a server approaching, inviting and relaxed, rich shallow depth of field." | `loop-restaurant-9x16` |
| Work / laptop | "Bright creative co-working space, an open laptop and coffee on a desk in soft foreground focus, blurred colleagues collaborating, big windows, optimistic daylight." | `loop-work-9x16` |
| Social meetup | "Golden-hour rooftop or park hangout, small group of young friends laughing softly out of focus, string lights, warm relaxed social energy." | `loop-social-9x16` |
| City walk | "First-person gentle walk down a leafy sunlit city street, warm storefronts and greenery drifting past in soft bokeh, calm and cinematic." | `loop-citywalk-9x16` |

Each also exports `<file>-poster.webp`.

---

## 3. Reward animations (transparent, short, punchy)

Spec: transparent background (PNG sequence → WebM with alpha, or Lottie if
authored), 0.8–1.5 s, tuned to fire on a correct answer / streak / level-up.
Play once (not loop). Reduced-motion → a single static frame or skip.

| Name | Prompt / direction | File | Trigger |
|---|---|---|---|
| Star burst | "Golden five-point star bursting into shimmering sparkle particles and light rays, tricolor flecks, transparent background, quick satisfying pop." | `fx-starburst` | correct answer |
| Confetti | "Celebratory confetti in warm gold, blue, coral, and cream falling and drifting, transparent background, joyful but tasteful, ~1.2 s." | `fx-confetti` | lesson complete |
| Level-up aura | "A soft radiant golden aura ring expanding outward with gentle light bloom and rising sparks, transparent, triumphant and premium." | `fx-levelup` | level up |
| Lumi celebrates | "The existing Lumi character (warm Colombian anime girl, yellow hoodie, denim skirt, star hair-clip) doing a happy little cheer-and-jump with sparkles, consistent with her reference sheet, transparent background, loopable 1 s." | `fx-lumi-celebrate` | streak / big win |

> For Lumi-consistent motion, seed with the existing `public/character/lumi*.png`
> as reference so the celebration matches her established design.

---

## 4. Ambient lesson illustrations (lightweight, non-distracting)

Spec: still WebP, flat/soft storybook shapes, low visual weight, sit at the edges
of an exercise (corner vignettes, small props) — never behind the answer area.
Static only.

Prompts (each): "Simple, soft storybook illustration of {a steaming coffee cup / a
little suitcase and passport / a speech bubble with a heart / a city skyline strip
/ a musical note cluster / a sun over hills}, warm cream-and-gold palette with a
tricolor accent, minimal, lots of negative space, no text." Files: `ill-coffee`,
`ill-travel`, `ill-chat`, `ill-city`, `ill-music`, `ill-sun`.

---

## 5. Performance / integration notes

- A shared `<SceneVideo>` component: renders `<video autoplay muted loop playsinline
  poster=...>` with `<source>` WebM then MP4; forces the poster under reduced-motion
  or `saveData`; `preload="none"` and IntersectionObserver to start only in view.
- Keep the existing hand-built SVG scenes (`components/scene-art.tsx`) as the
  guaranteed-instant fallback layer beneath any video.
- Budget: total added media on first paint ≤ the home poster (~60–120 KB WebP);
  every loop lazy-loads. Never block a lesson on a video.
- Generation cost: Higgsfield/nano-banana ~2 credits/image, video higher; batch and
  review before committing. Get budget sign-off before generating the video loops.

---

## Asset production procedure (2026-07-31)

How the pets and the Medellín loop were actually produced, so this is repeatable.

**Style-matching a new sticker to the existing set.** Do not describe the style
from scratch — import an existing asset as a visual reference and change only the
subject. The production files are public, so they can be imported directly by
URL (e.g. `https://<prod-host>/pets/tabby.png`) and passed as an `image` role.
`pets/cloe.png` was drawn against `tabby.png`, `pets/pandora.png` against
`golden.png`; both match the cream sticker outline, pose and shading without a
single style adjective in the prompt.

**Pet sizing.** Background-remove, then trim to the content box and resize to
**420 px tall**, PNG compression level 9. That lands each pet at 50–70 KB, in
line with the originals.

**Video loops.** `ffmpeg` is NOT a project dependency — an 80 MB binary should
not sit in every install for a job run once a year. Install it only for the
encode and remove it afterwards:

```bash
npm i -D ffmpeg-static
FF=node_modules/ffmpeg-static/ffmpeg
S=public/scenes/bg-home-medellin-16x9
$FF -y -i raw.mp4 -vf "scale=1280:720:flags=lanczos" -an \
  -c:v libx264 -profile:v high -crf 30 -preset slow -pix_fmt yuv420p \
  -movflags +faststart $S.mp4
$FF -y -i raw.mp4 -vf "scale=1280:720:flags=lanczos" -an \
  -c:v libvpx-vp9 -crf 40 -b:v 0 -row-mt 1 -deadline good $S.webm
$FF -y -i raw.mp4 -vf "scale=1280:720:flags=lanczos" -frames:v 1 -q:v 9 $S-poster.jpg
npm uninstall ffmpeg-static   # leave package.json exactly as you found it
```

Check `git status package.json package-lock.json` is clean before committing.

**Catalog wiring.** Add the entry to `lib/cosmetics.ts`. `lib/store.test.mjs`
asserts every `image:` and `video:` in the catalog resolves on disk — a cosmetic
pointing at a missing file renders as a blank tile and nothing else fails, so a
learner could buy something invisible.
