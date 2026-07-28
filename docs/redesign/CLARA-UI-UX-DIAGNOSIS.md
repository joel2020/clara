# Clara — UI/UX Diagnosis (redesign/premium-ui)

Date: 2026-07-28. Scope: visual design, UX, navigation, IA, ergonomics, accessibility, perceived quality.
Method: full read of `clara-audit/CLARA-PRODUCT-AUDIT.md` (2026-07-28) + its 84 screenshots, then independent live verification at 390×844, 430×932, 768×1024, and 1440×900 against a dev build of `main` @ `1cbdb31` (25 routes × 4 viewports, fresh-user onboarding completed per viewport; auth captured separately with Supabase env present). Live captures and the per-route overflow/console report are in the session scratchpad (`before/`, `report.json`); curated copies land in `docs/redesign/screenshots/` with the prototype.

Severity: **P0** prevents safe/understandable use · **P1** major barrier to activation, learning, trust, or retention · **P2** meaningful usability/quality problem · **P3** refinement.
Each finding is tagged **[observed]** (verified live or in code) or **[judgment]** (design opinion).

Out of scope here (Phase 0 owns them): Mariana identity residue, privacy/consent, curriculum/hint defects, assessment integrity, error *handling* (error boundaries), data sync. They are referenced only where they intersect presentation.

---

## 1. Visual-quality verdict — blunt

**Clara has a genuinely distinctive editorial foundation wearing three costumes at once.** The base system — Fraunces display serif, warm near-white paper, ink type, tricolor flag bar, hairline borders — is real design with a point of view, and it is better than most of the category. But layered on top of it are (a) an "anime study-game layer" (gacha gradients, candy nodes, sparkle bursts, an AI-anime mascot) and (b) an "arcade polish" layer (sheens, blooms, rotating tricolor halos), both literally labeled as such in `globals.css`. Add OS emoji standing in as the icon system on the most premium surfaces (Talk scenario cards, shop chest, map palm tree) and a photographed human tutor 60px from an anime PNG, and the result reads as *assembled from three products*. None of the three registers is badly executed; the problem is that they coexist. The distance between Clara today and "credible multimillion-dollar product" is not more polish — it is **choosing one register and deleting the other two.**

## 2. UX-quality verdict — blunt

**The core loop design is right; the surface architecture fights it.** `/today`'s 3-step guided session is the best-designed loop shell in the category comparison set, and the app's empty states, honest copy, and single-CTA home are professional work. But the learner is offered ~19 navigable destinations across three overlapping navigation systems, six of which are separate single-purpose drill mini-apps that Today was explicitly built to deal out. Progress lives on three different screens in two different languages. Jargon leaks everywhere ("PROVISIONAL", "B2 · 80", "A0"). A brand-new user's home screen is a wall of zeros at the exact moment motivation is most fragile. The UX doesn't need new features; it needs **fewer surfaces, one language policy, and numbers that only appear once they mean something.**

---

## 3. The five strongest existing design decisions (protect these)

1. **The editorial foundation** — Fraunces + warm paper + hairlines + restrained Colombian-blue accent. Distinctive against a category of rounded-cartoon sameness. [judgment, corroborated by audit §7.8]
2. **One dominant CTA on Home** ("Sesión de hoy") and the guided 3-step Today loop with a locked chest. This is correct activation design. [observed]
3. **The honesty voice** — "Tu reporte, cuando lo ganes", provisional-vs-earned levels, "No queremos darte un documento que diga más de lo que ya demostraste". This copy *is* the brand. [observed]
4. **Craft in the states** — review's "Estás al día" empty state, delayed splash, reduced-motion coverage across nearly every keyframe, zero horizontal overflow on 25 routes × 4 viewports, zero real console errors. The engineering respects the user. [observed]
5. **The tricolor as signature, not wallpaper** — the 3px flag bar, flag dots, tricolor selection. Colombian identity expressed as typographic detail rather than cliché. [judgment]

## 4. The ten most damaging visual/interaction problems

1. **P1 · Three visual registers on one screen path** [observed]. Editorial serif + anime Lumi + arcade FX + OS emoji + photo Joel. Most of the "assembled, not designed" feeling comes from this single fact. (Home, Today, Map, Shop, Talk.)
2. **P1 · The Map is the premium-killer screen** [observed]. 51 flat gray lock circles on a dashed line, one emoji palm tree, a generic gradient orb as the active node — on the surface users will benchmark against Duolingo's single most polished view. English lesson titles under a Spanish-first voice compound it.
3. **P1 · New-user home is a wall of zeros** [observed]. "0/100", four zeroed bars, "Te faltan 88 frases dominadas", 0 stars, 0 racha, plus jargon ("NIVEL A0 · PROVISIONAL · Meta: B2 · 80"). Demoralizing and illegible to the target user in the first minute.
4. **P1 · Six drill mini-apps exposed as destinations** [observed]. /listen /build /shadow /play /radio /duet each with its own entry screen and "Empezar" — the "which do I do?" decision Today exists to remove is pushed back onto the learner, and "Oído" (tab → /listen) vs "Sonidos" (header → /dashboard) name two audio destinations that mean different things.
5. **P1 · Emoji as the icon system on flagship surfaces** [observed]. Talk scenario cards (👋 ☕ 🗺️ 🛍️), shop chest 🎁, map scenery, duet/cosmetics content. 17 files. Free glyphs on the surfaces that most need to look designed.
6. **P2 · Progress has three homes in two languages** [observed]. /mundo (Spanish, stats+streak+pet), /dashboard (English, "Your progress / Accuracy by sound"), /profile (Spanish, level+path). Same concepts, three IAs, no rule for which one to trust.
7. **P2 · Bilingual policy is unmanaged** [observed]. Auth doubles every label ("CORREO · EMAIL"), home headline is English for an A0 Spanish speaker, Dashboard is English while siblings are Spanish, map lesson titles English-first. There is a language setting — it is not consistently honored.
8. **P2 · Accessibility regressions against a thoughtful base** [observed]. `maximumScale: 1` blocks pinch zoom on Android (WCAG 1.4.4; iOS ignores it anyway, so the stated rationale doesn't hold); icon buttons at 32–36px vs 44px minimum; two competing `:focus-visible` rules in globals.css; no skip link; lesson pips are 32px unlabeled buttons.
9. **P2 · The tablet dead zone** [observed]. At exactly 768px the bottom tab bar disappears (`md:hidden`) and navigation collapses to a 2-item desktop header — touch-first tablet users get the weakest nav in the app. Desktop itself is an unadapted 768px column in a 1440px window.
10. **P2 · Reward economy visuals undercut the brand** [observed/judgment]. Free daily chest (+15★ for showing up) against "gana estrellas hablando bien"; XP debt framing ("40 XP para subir") before any action; speed round promises urgency with no timer. The honesty brand contradicts itself in the game layer.

---

## 5. Screen-by-screen assessment

Format: **single job / first-second-third read / verdict**. All observed live at 390×844 unless noted.

**Login (auth env present)** — Job: get in without friction. Reads: Lumi → "Clara" → doubled bilingual labels. Anime mascot is the first brand impression before any human warmth; every label duplicated; `mariana@ejemplo.com` placeholder (Phase 0). Functional, not premium. *P2 presentation; auth behavior untouchable (Phase 0 + recent auth work).* 
**Account creation** — same shell, same doubling. P2.
**Onboarding** — Job: commit to a goal. Top 55% of step 1 is empty; disabled "Seguir" (pale blue pill) looks tappable; six goals now exist (audit's "two goals" is stale) but options render as plain chips. Warm copy, right length. P2 layout, P3 affordance.
**Placement steps** — Job: measure honestly. Clean MCQs; shows right/wrong mid-test (assessment integrity → Phase 0, but the *presentation* choice of green/red mid-test is also a UX error). Result screen with subskill bars + week-1 plan is good product thinking. P2.
**Home `/`** — Job: start today's session. Reads: hero card (English headline + anime Lumi) → blue CTA → zero-wall readiness card. The one right CTA exists; everything after it argues with it. Below fold: HUD, quests, Llamada card, "EXPLORAR TODO". P1 (zeros, jargon, register clash), P2 (headline language).
**Today `/today`** — Job: run the 3-step session. Best surface in the app. Weaknesses: step-2 label mismatch ("Aprende" / "Abrir la llamada"), rainbow-gradient orb + anime Lumi + photo Joel in one column, dead vertical rhythm between steps. P2s only.
**Lessons `/lessons`** — Job: browse the curriculum. Dense, scannable, fine. English count strings ("10 sentences"). P3.
**Lesson intro `/lesson/[id]`** — Job: teach one idea, then drill. APRENDE→FRASES chips + "LA IDEA 1 de 4" cards are real pedagogy presented silently (no audio on an audio-first product — content/TTS wiring is Phase-0-adjacent; the *presentation* gap is ours). 32px unlabeled pips. Huge dead zone below the card. P2.
**Exercise shells (listen/build/shadow/play)** — Job: one rep, fast. Mechanically sound; visually bare — "1 / 8" counter, dark audio circle, four full-width option pills, then emptiness. No session frame (what am I in, how far, what's next), no shared shell across the four. Play: no timer on a "speed" round; British IPA + broken ɔ glyph (content fix → Phase 0 adjacent; glyph/font fix is ours). P1 as architecture (six shells), P2 per screen.
**Completion/reward states** — star-pop + confetti exist and are honest about scores; but reward visuals (chest shake, sparkle) sit in the arcade register. P2.
**Talk `/talk`** — Job: choose a scenario and speak. Entry: serif title + emoji cards. Session: Joel's bubble + translation + chips + mic pill is the right anatomy; middle 50% is empty blur; no presence state for Joel (no speaking/thinking indication beyond tiny eq bars); chips hardcoded (Phase 0). P1 for the emoji entry + presence gap on the flagship surface.
**Call `/call`** — Job: pick a case, take the call. Persona cards (MOLESTO/TRANQUILO/FURIOSO) are the most differentiated design in the app and the most on-brand surface. Plain-text list presentation undersells it. P2.
**Exam `/exam`** — Job: prove level. Locked state copy is excellent; visual is a plain card. P3.
**Plan `/plan`** — Job: see the week. Fine, minimal. P3.
**Map `/map`** — see §4.2. P1.
**Review `/review`** — "Estás al día" empty state is the best state design in the app. Keep. P3.
**Report `/report`** — Locked card copy is brand-defining; presentation is a bare card with one button. Underdesigned for the feature a recruiter would see. P2.
**Mundo/Dashboard/Profile** — three progress homes, two languages (§4.6). Dashboard additionally leads with a zero-state ("0% aciertos", "—"). P2.
**Shop `/shop`** — 🎁 emoji chest, +15 free stars, Lumi PNG under bunting; pedestal CSS exists and is nice; economy messaging contradicts brand (§4.10). P2.
**Media `/media`** — U.S. politics headlines to an A0 beginner (content policy → Phase 0). Presentation itself is clean. P3 (presentation only).
**Settings `/settings`** — Job: set name/language/exigencia. Clear, well-copied. Radio-card selected state is subtle (thin blue border). P3.
**Coach `/coach`** — raw "No autorizado." for non-admins; internal tool, fine; not a product surface. Untested as admin. P3.
**404** — default English Next.js 404 inside the app chrome. Branded 404 is on Phase 0's list; we supply the presentation primitives. P2.
**Loading** — delayed splash + Lumi loader exist; no skeletons anywhere (route transitions show blank content areas). P2.
**Permission-denied (mic)** — practice surfaces assume mic grant; denial path shows browser default only. Not fully testable headless. P2 [judgment].
**Network/provider failure** — with no API keys the app degrades gracefully (observed: /media shows its outage note; talk disables). Failure *presentation* is plain text; no designed error state component. P2.
**Mobile navigation** — 5 tabs: Inicio/Hoy/Hablar/Oído/Mapa. Two tabs (Inicio, Hoy) are the same job; Oído is one of six drills promoted to global nav; Shop/Progress/Profile unreachable from nav (live in Home's "EXPLORAR TODO" accordion). Hidden on non-hub routes (correct immersion instinct). P1 (structure), not execution.
**Desktop navigation** — Lecciones + Sonidos + instructor toggle; no Talk, no Today. A different IA than mobile for the same product. P2.

## 6. Information-architecture assessment

The app answers the seven user questions like this today: *What should I do now?* → answered well once (Home CTA → Today), then re-asked by 6 drill entries + games grid. *Why does it matter?* → readiness card gestures at "para trabajar en inglés" but leads with jargon and zeros. *How am I improving?* → three competing surfaces. *What's blocking me?* → "Te faltan 88 frases" with no link to which. *How close to the job goal?* → buried ("B2 · 80"); the BPO funnel (support track, call sim, interview, report) — Clara's actual product — is scattered across /call, /exam, /report and never presented as a track. *Where do I practice speaking?* → Hablar (good) + Llamada card + Duet — three entries, no hierarchy. *What happens next?* → nothing tells her; sessions end without a bridge to tomorrow.
**Root cause [judgment]:** the IA exposes the *implementation* (every mini-app is a route) instead of the *promise* (one daily session, one skill tree, one job goal). The fix is demotion, not deletion — Today deals drills; Map holds the ladder; one "Yo" surface holds identity+progress+shop; the job funnel gets presented as a track.

## 7. Navigation assessment

Three systems, three vocabularies [observed]: bottom tabs (Inicio/Hoy/Hablar/Oído/Mapa), header nav (Lecciones/Sonidos + Instructor), in-page back links (mostly "← Lecciones"/"← Inicio", not always the true origin). Tab bar hides on 15+ routes by allowlist (`SHOW_ON`), so drills/talk/shop have *no* persistent nav — immersion is right for mid-exercise, wrong for entries like /talk and /shop. At md (768px) the tab bar vanishes entirely (tablet gets desktop's 2-link header). Instructor toggle renders for teachers in the product header rather than inside coach tooling. Labels are honest but mixed-register ("Oído" = a drill, others = spaces). Active states: color-only on tabs (plus strokeWidth bump), underline on header. Safe-area: handled on the tab bar (env inset) [observed]; nothing handles the top notch on immersive screens.

## 8. Mobile ergonomics assessment

Zero horizontal overflow on every route at 390/430/768/1440 [observed] — genuinely rare. One-hand reach is decent (primary CTAs bottom-half on Talk/practice; onboarding CTA upper-third is the exception). Tap targets: nav items OK; header icons 36px; lesson pips and several icon buttons 32px; option pills full-width (good). Thumb-zone conflicts: none observed. Keyboard avoidance untested on device (structural risk noted in audit; not re-testable headless) [judgment]. The 768px tablet breakpoint is the ergonomic hole (§4.9). Fixed elements respect `safe-area-inset-bottom`; `viewportFit: cover` is set, but no surface uses `safe-area-inset-top` — acceptable while the sticky header exists on all hub routes.

## 9. Accessibility assessment

**Strengths [observed]:** app-wide reduced-motion kill switch (0.01ms animations) plus per-effect opt-outs (ambient layer hidden outright); aria-labels on icon buttons in header/nav; focus-visible defined; semantic buttons/links throughout; `lang` handling via i18n util; contrast of ink-on-paper body text comfortably passes AA.
**Failures:** `maximumScale: 1` (WCAG 1.4.4 — Android real-world impact) P2; two conflicting global `:focus-visible`/`::selection` definitions (cascade-order dependent; ring color differs from shadcn `--ring` teal, which is itself a leftover — teal ring on a blue-accent app) P3; 32px controls under 44px minimum (pips unlabeled — screen reader hears "button" ×4) P2; no skip-to-content link P3; muted-foreground (`oklch 0.54`) on tinted card washes needs contrast verification per-surface P3 [judgment pending measurement]; mono-font IPA glyph rendering (Ɔ) breaks comprehension of the one string a learner must read precisely P2; color-only tab active state (with strokeWidth assist) P3; charts/progress bars carry no text alternatives beyond adjacent numbers (acceptable) P3.

## 10. Consistency inventory

- **Type:** Fraunces (display, `font-optical-sizing: none` — deliberate and good) / Geist sans / Geist mono. Mono is used for *data* (counts, IPA, "0/51 paradas") but leaks into labels ("40 XP para subir" as body copy). Ad hoc sizes beyond the Tailwind scale appear on nearly every screen (`text-[10px]`, `text-[11px]`, `text-[0.8rem]`). No named type roles.
- **Color:** OKLCH semantic tokens exist and are largely respected; tricolor tokens (`--co-*`) well-defined; **but** `--ring` is teal (shadcn leftover) while focus rules use co-blue; `.dark` palette exists with no exposed toggle (`next-themes` installed, unused) — an unmaintained second theme.
- **Radius:** tokenized scale off `--radius: 1rem` — good — but `rounded-full` pills, `rounded-[min(...)]` hacks in button sizes, and 3xl/4xl cards mix freely on one screen.
- **Elevation:** `.elev-1/.elev-2` + `.card-lift` exist; many cards use borders only; shop/legendary add glows — three shadow philosophies.
- **Buttons:** shadcn `Button` (h-8 = 32px default!) coexists with hand-rolled `Primary` pills (onboarding), `rounded-full` CTAs (home/today), and bare `<button>`s. Two-plus button systems; the shadcn one is barely used by app screens.
- **Icons:** lucide-react properly used in nav/header/practice chrome; emoji used in Talk/shop/map/duets/cosmetics/content (17 files). Two icon systems.
- **Motion:** ~40 keyframes in three registers (editorial fades / anime pops / arcade sheens+halos). Reduced-motion is handled; register is not.
- **Card patterns:** nesting up to 3 deep on Home (card → HUD card → stat chips). Section headers: `SectionHeader` ui component exists; screens mostly hand-roll uppercase-tracking labels.
- **Language:** no enforced policy; per-screen drift documented in §4.7.

## 11. Components to retain (support the direction as-is)

`site-header` shell (flag bar + wordmark), `mobile-nav` skeleton (placement/safe-area/immersion logic — contents change), `SectionHeader`, `ui/*` shadcn primitives as the base layer (with size/token fixes), `review-callout`, empty-state copy patterns, `splash` (delayed), eq-bars speaking indicator, `readiness-card` *concept* (presentation rebuilt), Joel avatar treatment, flag-bar/flag-dots signatures, the `.hero-calm` background recipe, Today's step-list structure.

## 12. Components to simplify

Home page stack (7 stacked surfaces → 3: greeting+CTA, one meaningful progress statement, one secondary card); readiness card (hide zeroed bars, translate jargon, one number only when earned); practice entry screens (six → one shared shell with a mode prop); progress surfaces (three → one, presentation-side merge first via consistent components); shop (pedestal stays, chest reframed, economy copy aligned); auth labels (single-language via existing setting); onboarding step layout (kill the dead 55%, anchor CTA to thumb zone).

## 13. Components to rebuild

Map (nodes, trail, scenery, world headers — full visual rebuild to category standard); Talk entry cards + Talk session presence (scenario iconography, Joel presence states, layout of the empty middle); drill shells (one `PracticeShell` with progress, mode identity, session frame); icon layer (emoji → drawn/lucide set via presentation-side mapping); reward/celebration into one signature system (tricolor stamp; retire arcade layer); loading skeletons; error/failure state component family; the button layer (one system, 44px+ mobile targets).

## 14. Features/surfaces to visually deprioritize

/radio, /media (pending Phase 0 content policy), /duet (fold into Talk's world), /shop (reachable from Yo, not celebrated in nav), XP/level HUD (subordinate to phrase mastery + job readiness), Instructor toggle (out of the learner header), desktop-specific investment (mobile-first is right; desktop gets the mobile column centered *well*, nothing more).

## 15. Do-not-touch-until-Phase-0-lands (and why)

Login/auth screens beyond pure copy/style tokens (auth flows actively changing — Google login/allowlist work on adjacent branches); onboarding *data* steps (name binding = identity work); placement feedback behavior (assessment integrity); Talk chips/content (`lib/content/scenarios.ts` — Mariana purge will rewrite); hint/IPA strings in `lib/content/*` (curriculum defects); /media feed logic (content filtering); anything in `lib/db`, `lib/sync`, `lib/srs`; `app/error.tsx` / `global-error.tsx` / branded 404 (explicitly on Phase 0's fix list — we deliver presentation primitives they can adopt, not the files); readiness *label semantics* ("listening"/"interaction" renames are assessment-honesty fixes); notification timing.

---

## Appendix: live-verification deltas vs the product audit

Confirmed live: zero h-overflow everywhere; zero console errors beyond expected degraded-API 403/404/503; Mariana placeholders at login/onboarding; wall-of-zeros home; emoji surfaces; three-register clash; map state; 404 default; tab/header IA split. **Stale in audit:** onboarding now offers six goals (not two); goal step renders them as selectable chips. **New findings not in audit:** 768px tablet nav gap; duplicate `:focus-visible`/`::selection` rules; teal `--ring` leftover vs blue focus; shadcn Button 32px default vs hand-rolled pill divergence; dark palette shipped but unreachable; `SHOW_ON` allowlist leaves /talk and /shop with no nav at all.
