# Redesign branch — deliverables summary and final assessment

Date: 2026-07-28 · Branch: `redesign/premium-ui` (worktree `/Users/joel/clara/.worktrees/premium-ui`)
Base: `main` @ `1cbdb31`. **Not merged, not deployed. Rebases after Phase 0.**

## 1. Deliverables index

| # | Deliverable | Where |
|---|---|---|
| 1 | UI/UX diagnosis | `CLARA-UI-UX-DIAGNOSIS.md` |
| 2 | Premium design direction | `CLARA-PREMIUM-DESIGN-DIRECTION.md` |
| 3 | Design system | `CLARA-DESIGN-SYSTEM.md` |
| 4 | Higgsfield style bible | `HIGGSFIELD-STYLE-BIBLE.md` (no assets generated — gated on approval) |
| 5 | Phase 0 integration log + rebase instructions | `PHASE-0-INTEGRATION-LOG.md` |
| 6 | Component & token inventory | Diagnosis §10–13 (existing) + Design System §1–2 (target) |
| 7 | IA proposal | Direction §3 (incl. the route-merge integration proposal) |
| 8 | Navigation proposal + implementation | Direction §4; shipped in `mobile-nav.tsx`/`site-header.tsx` |
| 9 | Core-flow prototype | `/preview/*` — 9 routes (Hoy, lesson, exercise, feedback, Hablar entry+session, Camino, Yo, system gallery) |
| 10 | Before/after screenshots | `docs/redesign/screenshots/{before,after}/` (4 viewports captured; curated set committed) |
| 11 | Accessibility findings + verification | Diagnosis §9; evidence below §3 |
| 12 | File-by-file summary | §2 below + per-commit entries in the integration log |
| 13 | Test/lint/type/build evidence | §3 below + per-commit entries |
| 14 | Rebase instructions | Integration log, final section |
| 15 | Remaining risks | §4 below |
| 16 | Blunt premium assessment | §5 below |

## 2. File-by-file implementation summary

**Production code (7 files changed, all presentation-layer):**
- `app/globals.css` — single focus/selection definitions; `--ring` → accent blue; new
  tokens (`--estimated/--earned/--surface-wash`, durations/easing); type roles
  (`.type-*`); safe-area utilities; skeleton, mic-pulse, stamp-in keyframes;
  `touch-action: manipulation` on controls. Nothing removed that any live surface uses.
- `app/layout.tsx` — `maximumScale: 1` removed (WCAG 1.4.4); skip link;
  `id="contenido"` on `<main>`. Viewport/JSX edits only; providers untouched.
- `components/mobile-nav.tsx` — rewritten: 4 tabs (Hoy · Camino · Hablar · Yo → `/`,
  `/map`, `/talk`, `/profile`), persists to `lg`, `aria-current`, non-color active
  indicator, shows on `/talk` and `/shop`.
- `components/site-header.tsx` — desktop links mirror the four spaces at `lg+`;
  44px icon targets. Instructor toggle left in place (demotion to /coach is in the
  integration proposal, not this branch).
- `app/talk/page.tsx` — two spans: scenario emoji → `ScenarioGlyph` drawn icons.
  No logic touched.
- `components/practice/learn-intro.tsx` — concept pips: 36px targets, tab semantics,
  meaningful SR labels.
- `lib/i18n.ts` — `navCamino`, `navYo` keys (append-only).

**New modules (production-ready, mostly consumed by the prototype so far):**
`components/system/` — `tab-bar`, `progress` (bar/ring), `stats`
(earned/estimated/row), `states` (empty/error/offline/skeleton), `feedback`
(panel/stamp), `session` (SessionShell), `mic-button`, `scenario-glyph`;
`lib/ui/icon-map.tsx` (content-id/emoji → lucide bridge).

**Prototype:** `app/preview/**` — isolated, unlinked from product flows, brings its
own chrome, hides the production header while mounted.

**Deliberately not implemented here** (documented in Direction §3 / Design System §3):
route mergers (home=today, Yo consolidation), practice-shell adoption across the six
drills, map visual rebuild, home rebuild (blocked on a `todayPlan()` selector
extraction — the one business-logic interface this design needs), error.tsx/404
wiring (Phase 0 owns), auth label single-language fix (auth is Phase 0/adjacent-branch
territory), shop economy changes (product decision, not presentation).

## 3. Verification evidence

Every commit ran: `tsc --noEmit` (0 errors) · lint ratchet (11/11 baseline, one
regression caught and fixed pre-commit) · `npm test` (16 files, 440 checks, 0
failures) · `next build` (compiled clean; 49 static pages with previews). Baseline at
branch point was identical — no inherited failures, no new ones.

Live checks (Playwright, dev build):
- **Viewports** 390×844 / 430×932 / 768×1024 / 1440×900: all 25 production routes
  (before) and all 9 prototype routes (after) — **0px horizontal overflow
  everywhere; no console errors** beyond expected degraded-API 403/503/404 when
  running without provider keys.
- **Keyboard:** skip link is first Tab stop; focus ring visible (blue, 2px, offset);
  4 Tabs on prototype Hoy land on the tab bar (verified active element).
- **Contrast (computed from OKLCH tokens):** foreground/background 18.4:1 ·
  muted-foreground/background 4.95:1 · muted/card 5.06:1 · primary/background 8.4:1 ·
  primary-foreground/primary 8.4:1 · success/card 4.65:1 · warn-foreground/card 8.7:1
  — all text pairs ≥ AA. `--warn` raw (3.18:1) is used only for icons/underlines
  (3:1 UI-component threshold — passes).
- **Reduced motion:** dedicated capture pass (`reduced_motion="reduce"`): pages render
  complete with static skeletons/stamp; global kill-switch verified still present.
- **Bilingual wrapping / text expansion:** prototype surfaces carry full-length
  Spanish with English glosses at 390px with no truncation or overflow (capture set).
- **States:** empty/error/offline/skeleton all rendered in `/preview/system` and
  captured. Production failure presentation unchanged on this branch (Phase 0 owns
  error boundaries).
- **Screenshots:** committed under `docs/redesign/screenshots/`; full 4-viewport sets
  in the session scratchpad.

Known verification gaps (honest): no real-device iOS/Android pass (headless Chromium
only); mic/permission-denied flows not exercised end-to-end; the production `/play`
IPA glyph rendering (mangled Ɔ) is diagnosed but not fixed — likely Geist Mono
stylistic-set interaction, needs a visual repro before changing font features.

## 4. Remaining risks

1. **Phase 0 rebase risk is concentrated in two files** — `app/layout.tsx` and
   `app/talk/page.tsx`. Both have small, disjoint edits here and explicit re-apply
   notes in the integration log. Everything else is new files or Phase-0-untouched.
2. **Phase 0 had zero commits when this branch was cut**, so all conflict predictions
   are scope-inferred. Re-read their final diff before rebasing.
3. **The 4-tab nav ships before the route mergers**: Hoy tab points at the current
   home (which still links to /today), and Yo points at the current /profile, so the
   IA is better but the destination surfaces still carry old presentation until the
   post-Phase-0 route work. This is visible seam, accepted deliberately.
4. **Removed header links** (/lessons, /dashboard) are still reachable (home explore
   section, map) but one fewer click-path exists on desktop; watch for teacher
   workflow friction.
5. **Prototype routes ship in the bundle** if this branch ever deploys as-is; they are
   unlinked and harmless but should be gated or removed at production-integration time.
6. **The old visual registers still exist in production surfaces** (map, shop,
   cinematic layer). This branch intentionally did not half-rebuild them; until the
   per-surface migrations run, the app remains visually mixed outside the prototype.

## 5. Blunt assessment: does the prototype look commercially premium?

**The prototype: yes, credibly — with two caveats. The production app: meaningfully
better, not yet transformed.**

What the prototype gets right: the merged Hoy passes the five-second test (name,
today's job-anchored promise, one button, Joel's face, tricolor signature — nothing
competing); Camino's earned/estimated honesty and self-explaining locks read like a
product with a spine; the feedback anatomy and stamp close feel adult and designed;
one type system and one icon family hold every surface together. Set beside Speak or
current fintech onboarding it reads as a real product, not a template — and it is
distinctive (serif + paper + tricolor + a real human face is not what anyone else in
the category looks like).

Caveat one: it is still *component-premium*, not *world-premium*. The surfaces are
clean, hierarchical, and coherent, but the distinctive warmth budget — scenario art,
the map's journey illustration, Joel motion moments — is specified (style bible,
sanctioned shortlist) and not yet produced. Without that layer the prototype risks
reading "tastefully minimal" rather than "unmistakably Clara". Caveat two: the
hardest screens to make premium (map, live drills under real latency, celebration in
context) are exactly the ones this branch deferred; judgment on them is reserved
until migration.

Production today after this branch: navigation is simple and intentional on every
device, Talk sheds its emoji, zoom works, targets are tappable, focus is visible —
real gains, all low-conflict. But the home a user actually sees still opens with
jargon and zeros until the route-merge work lands. The distance to "multimillion-
dollar product" is now a defined migration path with a working reference
implementation, not a mystery — that is what this branch was for.
