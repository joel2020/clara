# Clara Typography System

Date: 2026-07-28 · Branch: `phase1/game-redesign`
Executable gate: `lib/ui/typography.test.mjs` (runs in the stock suite).

## 1. The production distorted-letter defect: exact root cause

**Symptom:** on the deployed app, some letters rendered distorted, oversized,
skewed-looking, or mismatched mid-word — most visibly in pronunciation
transcriptions (the broken-looking `Ɔ` in `/ˈdɔːtər/`).

**Root cause (confirmed against the live production build, commit `1cbdb31`,
2026-07-28):** all three app fonts load through `next/font` with
`subsets: ["latin"]`, and the served latin subsets contain **no IPA glyphs**
(`ɔ ə ɪ ɛ ɜ ʃ ʊ ʌ ʒ ŋ ɹ ɾ ɑ ɒ ː`). Every IPA string was styled `font-mono`, so
each missing character fell back **per character** to the first system font that
had it — a different typeface with different x-height, width, and weight,
spliced into the middle of a word. That per-character font splice is the entire
distortion. Evidence captured in the session scratchpad (`typo/`):

- `document.fonts.check` probe on production listing the missing glyphs per family.
- An injected specimen on the production page showing IPA characters rendering
  oversized in a foreign face inside mono strings, while all other text is clean.
- Network report: all three woff2 files load (HTTP 200) as variable fonts
  (weight 100–900) with correct types — ruling out failed loads, wrong paths,
  CORS, missing weights, and synthetic bold.

**Explicitly ruled out (do not re-litigate without new evidence):** Spanish
accents and punctuation (`á é í ó ú ü ñ ¿ ¡` render correctly in Fraunces and
Geist at weights 500/600/700 — verified in the production specimen); CSS
transform/skew distortion (every skewed or scaled element is a non-text overlay
or particle, and no keyframe leaves a visible transform on a final frame — now
pinned by the test's rule 3); hydration/font-path/MIME issues; the earlier
optical-sizing "thin letterforms" defect (fixed in `1290882`, already live).
No transform correction was needed; the audit rule exists to keep it that way.

## 2. Font roles

| Role | Family | Loading | Use |
|---|---|---|---|
| Display | Fraunces (`--font-display`) | next/font, latin subset, `opsz`+`SOFT` axes, variable weight | Headings, hero numbers, the practice word. `font-optical-sizing: none` is load-bearing (see globals.css comment) — never remove. |
| Interface | Geist (`--font-sans`) | next/font, latin subset, variable | Body, buttons, labels. Body sets `font-feature-settings: "cv01","cv03","ss03"` (Geist-specific). |
| Data | Geist Mono (`--font-mono`) | next/font, latin subset, variable | Counts, scores, timers, sync codes — **ASCII/Latin data only**. |
| **IPA** | **`.font-ipa`** → `system-ui` stack | No webfont — platform UI font (SF Pro / Roboto / Segoe UI), which has complete IPA coverage | **Every IPA transcription, no exceptions.** Resets `font-feature-settings: normal`. |

Named size roles (`.type-display` … `.type-data-big`) are defined in
`CLARA-DESIGN-SYSTEM.md` §1.2 and globals.css.

## 3. Language support rules

- **Spanish** (`á é í ó ú ü ñ ¿ ¡`): fully covered by the latin subsets of all
  three app fonts — safe everywhere, verified in production.
- **English contractions/quotes** (`' ’ “ ”`): covered; no special handling.
- **IPA**: only inside `.font-ipa`. New IPA-bearing surfaces must either bind a
  field named `ipa` (auto-caught by the test) or be pinned in the test like
  `/play`'s `subtitle`.
- Fallback chains: next/font's size-adjusted fallback faces remain configured,
  so text stays readable if a webfont fails.

## 4. Motion rules for text

- A transform animation on a text-bearing element must end at the identity
  transform (translate 0 / scale 1 / rotate 0). A retained transform is allowed
  only on a frame that is already invisible (`opacity: 0`).
- Infinite decorative loops with non-identity waypoints are allowed only on
  non-text elements, and each must be allowlisted with justification in
  `typography.test.mjs` (`INFINITE_NON_TEXT_LOOPS`).
- Never animate individual glyphs; animate the container, per the design
  system's motion tokens (`--dur-*`, `--ease-out`).

## 5. Production verification requirements

A typography change is not "verified" until:

1. `node lib/ui/typography.test.mjs` passes (included in `npm test`/`verify`).
2. The **production build** (`next build` + `next start`, not the dev server) is
   screenshotted at 390 and 1440 on an IPA-bearing surface (`/play`) and a
   Spanish-accent surface, and inspected.
3. For deployed claims: the check runs against the deployed URL itself
   (specimen-injection procedure in the scratchpad scripts) — a local pass is
   necessary but not sufficient to claim production is fixed.

Status at this commit: rules 1–2 verified locally. The deployed production
build still carries the defect until this branch ships; no deployed-fix claim
is made.
