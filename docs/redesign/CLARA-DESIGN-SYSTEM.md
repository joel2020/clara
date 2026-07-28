# Clara Design System

Date: 2026-07-28 · Branch: `redesign/premium-ui`
Serves: `CLARA-PREMIUM-DESIGN-DIRECTION.md` · Grounded in the inventory in
`CLARA-UI-UX-DIAGNOSIS.md` §10–13.

Philosophy: **keep the editorial foundation, delete the other two registers, tokenize
what already works, add only what the seven loop moments need.** This is a *reduction*
system: fewer type sizes, fewer shadows, fewer motions, one icon family, one button
family.

---

## 1. Foundations

### 1.1 Color (semantic tokens — existing OKLCH set, corrected)

The existing token architecture in `globals.css` is right and stays. Corrections only:

| Token | Value | Use |
|---|---|---|
| `--background` | `oklch(0.992 0.0015 100)` | Warm paper. The app's ground. |
| `--foreground` | `oklch(0.18 0.006 270)` | Ink. Body text, headings. |
| `--card` | white | Elevated surfaces. |
| `--primary` | `oklch(0.42 0.13 262)` | Colombian-flag blue. THE accent. CTAs, active nav, links. |
| `--co-yellow / --co-blue / --co-red` | (existing) | Tricolor signature only: flag bar, dots, stamp celebration. Never large fills. |
| `--muted / --muted-foreground` | (existing) | Support text ≥ 14px only (see contrast rules). |
| `--success` | `oklch(0.55 0.082 168)` | "Landed" feedback, earned states. |
| `--warn` | (existing) | Streak-at-risk, gentle cautions. |
| `--destructive` | (existing) | Errors. Never used for learner mistakes in drills (mistakes get `--warn` + guidance — calm during failure). |
| `--border / --hairline` | (existing) | The editorial workhorse. Default separation is a hairline, not a shadow. |
| `--ring` | **change to co-blue** `oklch(0.42 0.13 262)` | Was leftover shadcn teal; focus must match the accent. |

**New semantic aliases** (added, not replacing):
- `--estimated`: muted-foreground at 70% — for provisional/ghost numbers.
- `--earned`: `--foreground` — earned numbers are inked.
- `--surface-wash`: `color-mix(primary 4%, card)` — the only allowed tinted card wash.

**Rules.** No literal colors in components (`bg-[#...]`, ad-hoc oklch) — tokens only.
Tricolor never exceeds hairline/dot/stamp scale. One accent: if something must stand
out, it is `--primary` or it is typography. Gradients: only the two documented washes
(`.hero-calm`, `--surface-wash`); the candy/game gradients are prohibited.

**Theme policy.** Light is the supported premium theme. The shipped `.dark` palette is
unreachable (no toggle) and unmaintained; it stays in CSS as inert scaffolding but is
**not** a supported theme and gets no new work until it can be executed at the same
level. (Direction doc, brief §5: don't preserve a weak theme because it exists.)

### 1.2 Typography

Families stay: **Fraunces** (display, `font-optical-sizing: none`), **Geist** (UI),
**Geist Mono** (data). What changes: ad-hoc sizes collapse into named roles.

| Role | Class | Spec | Use |
|---|---|---|---|
| Display | `.type-display` | Fraunces 600, `clamp(28px, 7vw, 40px)`, lh 1.05, ls −0.02em | One per screen: the greeting, the screen's name. |
| Title | `.type-title` | Fraunces 600, 22px, lh 1.15 | Card/scenario titles. |
| Heading | `.type-heading` | Geist 600, 17px, lh 1.3 | Step names, list headers. |
| Body | `.type-body` | Geist 400, 16px, lh 1.55 | Default reading text. |
| Support | `.type-support` | Geist 400, 14px, lh 1.5, muted | Glosses, helper copy. |
| Label | `.type-label` | Geist 600, 11px, uppercase, tracking 0.14em, muted | Section labels (replaces hand-rolled variants). |
| Data | `.type-data` | Geist Mono 500, 13px, tabular-nums | Counts, scores, IPA, times. |
| Data-big | `.type-data-big` | Fraunces 600, 34px, tabular-nums | The one hero number a screen has earned. |

**Rules.** No `text-[10px]`/`text-[11px]`/`text-[0.8rem]` outside these roles. Mono is
for data, never sentences. English-learning content (the phrase to say) always ≥ 18px.
**Bilingual presentation rule:** the leading language per the user's setting renders in
Body/Title ink; the gloss renders `.type-support` muted, never uppercase, never doubled
in the same string ("CORREO · EMAIL" is prohibited — one label, gloss beneath if needed).
IPA renders in Geist Mono with `font-feature-settings` default (fixes the mangled Ɔ:
verified the glyph issue is the mono font's alternate — use `/ɔ/` via `.type-data` with
`font-family: var(--font-mono)` and no `cv` feature overrides).

### 1.3 Spacing & layout

4px grid. Page gutter: 20px mobile / 24px ≥ md. Content measure: `max-w-3xl` (existing)
centered; reading measure inside sessions `max-w-[62ch]`. Section rhythm: 32px between
sections, 12px label→content, 8px intra-list. Card padding: 20px (compact 16px).
**Nesting rule:** maximum one card inside a page section; stat chips inside a card
render as borderless rows/columns with hairline dividers, not cards-in-cards.

### 1.4 Radii

From `--radius: 1rem`: `sm 8 / md 11 / lg 16 / xl 21 / 2xl 27`. **Pills** (`9999px`)
are reserved for: the mic control, chips/badges, and the tab indicator. Buttons are
`lg`, cards `xl`, sheets/dialogs `2xl`, inputs `md`. The `rounded-[min(...)]`
hacks in ui/button sizes get replaced by the scale.

### 1.5 Borders & elevation

Hierarchy mechanism order: (1) spacing, (2) hairline, (3) type weight, (4) wash,
(5) shadow — shadows last, never alone. Two shadows only: `--elev-1` (resting card that
must float: dialogs, toasts) and `--elev-2` (overlays). The existing `.card-lift` hover
is kept for tappable cards on desktop pointer only. Glows (`bloom-gold`,
`legendary-glow`) are prohibited.

### 1.6 Layout widths & safe areas

App shell: `max-w-3xl`. Immersive sessions: full-bleed with `max-w-xl` content column.
Safe areas: tab bar pads `env(safe-area-inset-bottom)` (existing, keep); immersive
screens (no header) pad `env(safe-area-inset-top)` via `.safe-top` utility (new);
horizontal gutters add `env(safe-area-inset-left/right)` on landscape phones via the
page-gutter utility.

### 1.7 Motion

Tokens: `--dur-fast: 140ms` (state flips), `--dur-base: 240ms` (enter/exit),
`--dur-gentle: 420ms` (celebrations), easing `cubic-bezier(0.16, 1, 0.3, 1)` everywhere.
**Allowed motions** (each communicates state): page-enter fade-up · list stagger (≤ 8
items) · progress fill · mic listening pulse · eq-bars speaking · thinking shimmer ·
stamp-in (the ONE celebration: tricolor stamp scales in at `--dur-gentle`, once) ·
skeleton shimmer. **Prohibited:** infinite ambient loops (sheen, float, sparkle rain,
rotating halos, chest shake, cinematic letterbox) — scheduled for deletion with their
consumers. Reduced motion: every allowed motion has a defined end-state render; the
global 0.01ms kill-switch stays as the safety net; skeleton shimmer becomes static;
stamp appears without scale.

### 1.8 Focus

One rule, kept from the better of the two existing: 2px `--primary` at 55% outline,
2px offset, radius 4px. The duplicate `:focus-visible`/`::selection` blocks collapse to
one each. Selection: primary at 18% (the yellow selection reads as highlighter noise).
Focus is never removed, never color-only on dark fills (adds offset ring).

### 1.9 Icons

**Lucide only** (1.75px stroke default, 2.25 active), sized 16/20/24. Emoji are
prohibited in chrome, navigation, cards, and buttons. Content-data emoji (scenario
`icon` fields, cosmetics) are not edited on this branch (Phase 0 owns content files);
instead `lib/ui/icon-map.ts` maps content ids → lucide components at render time, with
the emoji as last-resort fallback for unmapped future content. Illustration: one drawn
style for scenario/scenery art (spec'd in the Higgsfield bible); Lumi renders only in
Yo/shop contexts, never beside Joel's photograph.

---

## 2. Components

### 2.1 Buttons (one family)

`Button` (ui/button.tsx) becomes the only button. Size tokens change to meet 44px
mobile targets: `sm 36px` (dense desktop chrome only) · `default 44px` · `lg 52px`
(primary CTA) · `icon 44px` · `icon-sm 36px` (header chrome only). Variants:
`primary` (solid `--primary`, white text) · `secondary` (ink text, hairline border,
paper fill) · `ghost` (ink text, no border) · `destructive` (existing) · `link`.
Hand-rolled pills (onboarding `Primary`, home CTAs) migrate to `Button size=lg` with a
`pill` prop for the two sanctioned pill uses. Disabled: 40% opacity **plus** cursor and
`aria-disabled` — and primary CTAs prefer *hidden-until-valid* or helper text over
long-lived disabled states (onboarding "Seguir" ambiguity fix).

### 2.2 Inputs & forms

`Input`/`Textarea`: 48px min height, `md` radius, hairline border, focus ring per §1.8,
label = `.type-label` above (single language + gloss per §1.2). Error text: `--warn`
tone with fix guidance, never bare red. Radio-cards (settings, onboarding): selected =
primary hairline + `--surface-wash` + leading check icon (not border-weight-only).

### 2.3 Cards

`Card`: white, `xl` radius, hairline, 20px padding, optional `.card-lift` when the whole
card is a link. `SectionCard` = `.type-label` header + rows with hairline dividers.
`StatRow` (replaces stat-chip grids): icon 20px, `.type-data` value, `.type-support`
label, horizontal, no nested borders.

### 2.4 Navigation

`TabBar` (rebuilt `mobile-nav`): 4 items (Hoy `Sunrise` · Camino `Route` · Hablar
`MessageCircle` · Yo `CircleUser`), 56px + safe-area, `.type-label`-scale 11px labels
always visible, active = primary + filled-weight stroke + 2px top indicator,
`aria-current="page"`, persists to `lg`. `AppHeader`: wordmark + flag bar (keep), four
space links ≥ lg, sound + settings icon buttons (44px), **no instructor toggle**
(moves into /coach; coach-only chrome never renders for learners).

### 2.5 Progress & feedback

`ProgressBar`: 6px, `lg` radius track (`--muted`), primary fill, animated fill on
mount, `aria-valuenow`. `ProgressRing`: 44px, for session steps. `EarnedStat` vs
`EstimatedStat`: inked `.type-data-big` with stamp underline vs muted ghost with
"estimado" tag — the honesty architecture as components. `SessionSpine`: the persistent
step indicator inside sessions (replaces per-drill "1/8" counters). `FeedbackPanel`:
the one anatomy — heard-text · landed highlights (success ink) · one fix (warn tone +
tip + replay button). `Stamp`: the single celebration (tricolor arc stamp, used at
session end and exam pass only).

### 2.6 Dialogs, sheets, toasts

`Dialog` (existing base-ui): `2xl`, `--elev-2`, focus-trapped (verify), max-w-sm.
`Sheet` (new, mobile): bottom sheet for secondary choices, drag handle, safe-area
padded. `Toast` (sonner, existing): bottom-center above tab bar, `--elev-1`, auto-read
(`aria-live="polite"`), one line + optional action.

### 2.7 States

`EmptyState`: icon-in-wash circle (40px) + `.type-title` + one-sentence support + one
action — codifies the excellent /review pattern. `LoadingSkeleton`: hairline-bordered
blocks matching real layout, shimmer (static under reduced motion); every space gets a
skeleton for its first data read. `ErrorState`: same skeleton as EmptyState with warm
copy rules ("Esto no cargó. No es tu culpa — intenta de nuevo.") + retry; **the
component ships here, the `error.tsx`/404 wiring belongs to Phase 0** (they adopt it).
`OfflineNote`: hairline banner, not a toast (persistent conditions get persistent UI).

### 2.8 Prohibited patterns (component level)

Emoji in any chrome · cards nested ≥ 2 deep · shadows as the only hierarchy · disabled
primary CTAs as the default resting state · doubled bilingual labels · mono for
sentences · free-floating "0/N" counts without a session frame · infinite ambient
animation · more than one dominant CTA per screen · gacha/chest/spark reward moments ·
uppercase display serif (Fraunces stays sentence-case) · new hand-rolled buttons.

---

## 3. Migration guidance

**Order:** tokens → primitives → shells → screens. Never rename-only; migrate a
component when its screen is being touched for a real reason (brief: don't rewrite for
naming uniformity).

| Existing | Disposition |
|---|---|
| `globals.css` editorial base + flag utilities + eq-bars + hero-calm + splash | Keep (tokens corrected). |
| Duplicate focus/selection blocks, teal `--ring` | Fix in Batch A. |
| Anime/arcade/cinematic/ambient keyframes (`star-pop`… `cine-*`, `ambient-*`, `sheen`, `arcade-ring`, `legendary-glow`, `game-hero`, `chest-shake`) | Delete **with their consumers** as each surface is rebuilt; until then untouched (no dead-CSS risk, no visual regressions on unrebuilt screens). |
| `ui/button.tsx` sizes | Retoken in Batch B (44px). Existing call sites audited for size drift. |
| Hand-rolled pills/CTAs | Migrate per-screen in Batch C+. |
| `mobile-nav.tsx` | Rebuild as 4-tab `TabBar` (Batch C). |
| `site-header.tsx` | Keep shell; demote instructor toggle; 44px targets (Batch C). |
| `readiness-card.tsx` | Rebuild presentation on `EarnedStat`/`EstimatedStat` (Batch D, behind existing props — no logic change). |
| Emoji surfaces | `icon-map` shim (Batch B) + per-surface swap. |
| `maximumScale: 1` | Remove in Batch A (a11y; iOS ignores it anyway — mic-tap zoom is addressed with `touch-action: manipulation` on controls). |
| `.dark` block | Inert; documented unsupported. |

Every batch: typecheck + ratchet + tests + build + 4-viewport screenshots + keyboard/
focus/contrast/reduced-motion pass, logged in `PHASE-0-INTEGRATION-LOG.md`.
