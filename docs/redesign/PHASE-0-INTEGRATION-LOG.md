# Phase 0 integration log — redesign/premium-ui

This branch runs in parallel with the Phase 0 remediation branch
(`worktree-phase0-remediation`). **Phase 0 merges first; this branch rebases onto it.**
Every commit here is logged with its files, rationale, expected conflicts, and rebase
guidance. Conflict resolution rule: **adapt the UI to Phase 0's behavior — never restore
obsolete UI logic, never weaken a security/privacy/identity/data-integrity fix.**

Phase 0's stated scope: privacy, identity leakage (Mariana purge), data integrity
(Dexie/sync), curriculum defects (hints/IPA/content), assessment integrity, error
handling (error boundaries + branded 404). At branch time Phase 0 had **zero commits**
(worktree clean at `1cbdb31`), so expected conflicts below are inferred from that scope,
not from observed diffs. Re-check `git log main..worktree-phase0-remediation` at rebase time.

Files this branch treats as off-limits (Phase 0 territory): `lib/db/**`, `lib/sync/**`,
`lib/srs.ts`, `lib/content/**` (curriculum data), `lib/allowlist.ts`, `lib/auth-*.ts`,
`app/api/**`, `components/auth-gate.tsx`, `components/login-screen.tsx`,
`components/reset-password-screen.tsx`, `components/oauth-callback-screen.tsx`,
`components/profile-binder.tsx`, `app/error.tsx` / `app/global-error.tsx` /
`app/not-found.tsx` (Phase 0 will create these; we provide adoptable primitives),
exam/grading/readiness logic, supabase/**, vercel.json, next.config.ts (production config).

---

## Commits

### 7e7a1d2 — Redesign: record baseline and UI/UX diagnosis
- **Files:** `docs/redesign/BASELINE.md`, `docs/redesign/CLARA-UI-UX-DIAGNOSIS.md` (new)
- **Why:** Step 1/3 deliverables; records green baseline (typecheck 0, ratchet 11/11,
  440 checks, build 35 routes) at branch point `1cbdb31`.
- **Expected conflicts:** none (new files in a directory Phase 0 doesn't use).
- **Rebase decisions:** none.
- **Post-integration checks:** none.
- **Safe to cherry-pick independently:** yes.

### 6a041b4 — Design system: token corrections, type roles, restore pinch zoom
- **Files:** `app/globals.css` (edit), `app/layout.tsx` (viewport export only),
  `docs/redesign/CLARA-PREMIUM-DESIGN-DIRECTION.md`, `docs/redesign/CLARA-DESIGN-SYSTEM.md`,
  `docs/redesign/PHASE-0-INTEGRATION-LOG.md` (new docs)
- **Why:** Batch A foundations — single focus/selection definition, blue `--ring`,
  named type roles, motion/safe-area/honesty tokens, stamp keyframe; removes the
  `maximumScale: 1` zoom lock (WCAG 1.4.4) replaced by `touch-action: manipulation`.
- **Expected conflicts:** `app/layout.tsx` is a plausible Phase 0 touchpoint (it wires
  AuthGate/OnboardingFlow and could gain error-boundary-adjacent changes). Conflict
  surface is only the `viewport` export block. `globals.css` unlikely to be touched by
  Phase 0.
- **Rebase decisions:** if Phase 0 edits `layout.tsx`, keep both sides — their JSX/
  provider changes and this branch's viewport block are disjoint. Never reintroduce
  `maximumScale`.
- **Post-integration checks:** pinch zoom works on Android Chrome; no double-tap zoom
  jump on mic buttons on iOS Safari; focus ring visible and blue on keyboard Tab.
- **Verification at commit:** typecheck 0 · ratchet 11/11 · 440 checks pass · build OK.
- **Safe to cherry-pick independently:** yes.

### ee9ef0a — Prototype: system primitives and the eight core surfaces in /preview
- **Files:** all new — `components/system/*` (7 files), `lib/ui/icon-map.tsx`,
  `app/preview/**` (10 files), `docs/redesign/screenshots/**`; `app/globals.css`
  gains skeleton + mic-pulse utilities (append-only edits).
- **Why:** Step 6 prototype: the new hierarchy/typography/nav/states demonstrated in
  isolated routes before any production surface changes.
- **Expected conflicts:** none — Phase 0 does not create these paths. `globals.css`
  edits are appends; trivial to merge.
- **Rebase decisions:** none. If Phase 0 renames content scenario ids (Mariana purge
  touches `lib/content/scenarios.ts`), re-check `lib/ui/icon-map.tsx` id keys
  (greetings/cafe/directions/shopping/smalltalk/plans).
- **Post-integration checks:** `/preview` renders; `/preview/talk` session toggle works.
- **Verification at commit:** typecheck 0 · ratchet 11/11 · 440 checks · build OK
  (49 static pages incl. 9 preview routes) · 4-viewport capture clean (0 overflow,
  0 console errors) · keyboard focus reaches TabBar with visible ring ·
  reduced-motion pass captured.
- **Safe to cherry-pick independently:** yes (with the globals.css append from 6a041b4).

### 3e6c426 — Nav: four spaces on every device; Talk sheds emoji iconography
- **Files:** `components/mobile-nav.tsx` (rewrite), `components/site-header.tsx`
  (nav links + 44px targets), `components/system/scenario-glyph.tsx` (new),
  `app/talk/page.tsx` (two icon-rendering spans only), `lib/i18n.ts` (two new keys,
  append-only).
- **Why:** the target IA's navigation, implemented as pure presentation: all four tab
  destinations are existing routes; no route was added, removed, or redirected.
- **Expected conflicts:** `app/talk/page.tsx` is a **likely Phase 0 conflict** — the
  Mariana-chip fix touches this file (openers/suggestions logic). This branch's edits
  are confined to two JSX spans (scenario icon rendering) + one import; they do not
  touch chips, openers, API calls, or state.
- **Rebase decisions:** take Phase 0's logic changes wholesale; re-apply the two
  ScenarioGlyph spans on top. For `lib/i18n.ts`, both sides may append keys — keep
  both (pure additive). `site-header.tsx`/`mobile-nav.tsx` are not in Phase 0's scope.
- **Post-integration checks:** tab bar renders on / /map /talk /profile at 390 and
  768; Talk scenario cards show drawn icons and correct titles after the Mariana
  purge; header links match tab bar at 1440.
- **Verification at commit:** typecheck 0 · ratchet 11/11 · 440 checks · build OK ·
  live capture at 390/768/1440 (no overflow; nav renders; icons correct). One ratchet
  regression (react-hooks/static-components) was caught and fixed pre-commit.
- **Safe to cherry-pick independently:** mostly — needs `lib/ui/icon-map.tsx` from
  ee9ef0a; i18n keys are self-contained.

### be04eb5 — A11y: finger-sized lesson pips with real labels, skip link
- **Files:** `components/practice/learn-intro.tsx` (pip block only),
  `app/layout.tsx` (skip link + main id).
- **Why:** 8px pip buttons with number-only labels failed tap-target and SR-labeling
  expectations; no skip link existed.
- **Expected conflicts:** `app/layout.tsx` again (see 6a041b4) — this adds two JSX
  nodes inside AuthGate; if Phase 0 restructures layout children (e.g. error
  boundaries), keep their structure and re-insert the skip link + `id="contenido"`.
  `learn-intro.tsx` is presentation; Phase 0's hint fixes live in content files, not
  here.
- **Post-integration checks:** Tab from a fresh load focuses "Saltar al contenido";
  lesson intro pips announce "La idea N de M".
- **Verification at commit:** typecheck 0 · ratchet 11/11 · 440 checks · build OK.
- **Safe to cherry-pick independently:** yes.

---

## Rebase procedure (when Phase 0 completes)

1. `git -C /Users/joel/clara fetch . worktree-phase0-remediation` (or fetch its final
   branch name) and read `git log main..<phase0>` + `git diff --stat` first.
2. From this worktree: `git rebase <phase0-final-branch>` (after it merges to main:
   `git rebase main`).
3. Conflict policy, in order of precedence:
   - **Phase 0's behavior always wins** on auth, privacy, identity, data, content,
     grading, error handling. Adapt UI markup around their logic; never revert theirs.
   - `app/layout.tsx`: keep Phase 0's structure (providers/boundaries); re-apply this
     branch's three disjoint pieces — viewport block (no `maximumScale`), skip link,
     `id="contenido"` on main.
   - `app/talk/page.tsx`: take Phase 0's chip/opener logic; re-apply the two
     `ScenarioGlyph` spans + import.
   - `lib/i18n.ts`: additive on both sides — keep both key sets.
   - `lib/content/scenarios.ts` is theirs entirely; afterwards re-verify
     `lib/ui/icon-map.tsx` id keys still match.
   - If Phase 0 added `app/error.tsx` / `global-error.tsx` / `not-found.tsx`, offer
     them `ErrorState`/`EmptyState` from `components/system/states.tsx` as a follow-up;
     do not rewrite their files during rebase.
4. Full verification: `npm run verify` (typecheck + ratchet + 440 checks + build).
5. Manual retest (all at 390 + 1440): sign in/out with a real account · consent/privacy
   surfaces Phase 0 added · account switching on a shared device · onboarding
   fresh-profile run · one lesson end-to-end · Talk session round-trip (chips must
   show the learner's name, never Mariana) · exam entry state · tab bar on
   / /map /talk /profile · pinch zoom on Android · skip link.
6. Request review before merging; do not deploy from this branch.

## Non-code assets note

`.env.local` was copied into this worktree for dev-server testing only; it is
gitignored, was verified with `git check-ignore`, and must not be committed.
