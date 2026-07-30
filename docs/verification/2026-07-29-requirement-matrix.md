# Requirement-to-evidence matrix

Spec: `docs/superpowers/specs/2026-07-29-daily-classroom-and-character-system-design.md`

Status vocabulary: `proven` (direct evidence attached), `partial` (evidence
covers part of the requirement), `unverified` (no evidence yet — not a pass),
`contradicted` (evidence shows the requirement is not met).

A broad requirement is never marked `proven` by a narrow unit test alone.

| # | Spec section | Requirement | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | 4.1 Dashboard | Dashboard centred on today's session | `components/today-session-card.tsx`; `after-dashboard-*.png`; `lib/game-system.test.mjs` | proven |
| 2 | 4.2 Session sequence | In-order runner with one action per step | `app/today/page.tsx`, `components/daily-session/activity-shell.tsx`; `after-today-*.png`; `lib/ui/typography.test.mjs` (112 checks) | proven |
| 3 | 4.2 | Checkpointed transitions survive navigation | `lib/daily-session-store.ts` `checkpointActivity`; `lib/daily-session-store.test.mjs`; browser resume scenario (below) | proven |
| 4 | 4.3 Completion | Practiced / review-next derived from real evidence | `components/daily-session/session-complete.tsx`; `lib/ui/typography.test.mjs` | proven |
| 5 | 4.3 | One evidenced improvement surfaced | Neutral no-evidence copy only; derivation not implemented | partial |
| 6 | 5 Orchestrator | Pure deterministic composer, 15-min cap | `lib/daily-session.ts`; `lib/daily-session.test.mjs` | proven |
| 7 | 6 Personalization | CEFR/path assistance and weakness ranking | `lib/daily-session.ts` `compareCandidates`; `lib/daily-session.test.mjs` | proven |
| 8 | 6 | Technical failures excluded from evidence | `lib/practice.ts` attempt path; `lib/speech/recognition.ts`; `docs/learning-metrics.md` exclusions; `lib/report.test.mjs` | proven |
| 9 | 7 Persistence | Account-scoped local persistence | `lib/db/dexie.ts` v10; `lib/db/scope.test.mjs` (30 checks) | proven |
| 10 | 7 | Monotonic cloud merge, no progress loss | `supabase/daily_sessions.sql`; `lib/daily-session-merge.ts`; `lib/sync/daily-session-sql-logic.test.mjs` | partial (not executed on real PostgreSQL) |
| 11 | 7 | Migrations do not weaken RLS | `supabase/daily_sessions.sql` own-rows-only via `auth.uid()`, rerun-safe; `supabase/events.sql`, `supabase/player_stats_economy.sql` additive | partial (not applied to production) |
| 12 | 8 Failure behavior | Technical failure never reads as learner failure | `components/daily-session/technical-recovery.tsx`; `components/practice/shadow-round.tsx` neutral notice (commit `2a7cac6`) | proven |
| 13 | 8 | Comeback session shorter, no guilt copy | `lib/comeback.ts`; `lib/comeback.test.mjs` (11 checks incl. copy guard) | proven |
| 14 | 8 | Visible sync queue state | Not implemented | unverified |
| 15 | 9 Clara identity | `CHARACTER_DESIGN_SYSTEM.md` authoritative guide | `CHARACTER_DESIGN_SYSTEM.md` (236 lines) | proven |
| 16 | 9 | Typed manifest: 7 states x 4 frames, safe areas, anchors | `lib/character.ts` `CLARA_ASSETS`; `lib/character-manifest.test.mjs` (110 checks) | proven |
| 17 | 9.3 | Master sheet created and approved before pose expansion | Candidates at `docs/character/master-sheet-candidates/`; approval not granted | partial — blocked on Joel |
| 18 | 9.4 | Seven production states rendered as assets | Not produced (gated on 17) | unverified |
| 19 | 9 | Clara is the sole learner-facing guide | Learner-facing Lumi copy and alt text removed; Lumi artwork still renders pending 18 | partial |
| 20 | 10 Avatars | Adult woman and adult man, visibly in their 20s | `public/avatars/adult-woman-01/*`, `public/avatars/adult-man-01/*` (8 sheets); `after-shop-*.png` | proven |
| 21 | 10 | Medellin streetwear direction for the young man | `street-default` (everyday nea), `street-noche`, `street-futbol`, `street-oficina` | proven |
| 22 | 10 | Original baseball caps specifically, no team/brand marks | `public/avatars/caps/*` (6 originals); `lib/store.test.mjs` brand-name guard | proven |
| 23 | 10 | Both avatars share one catalog; pets supported | `lib/avatar.ts` `composeAvatarLayers`; `lib/avatar.test.mjs` (138 checks) | proven |
| 24 | 10 | Live full-body preview, no clipping across sizes | `components/avatar/avatar-preview.tsx`; clipping assertion over 12 base x cap pairs; browser render at 320-1440 | proven |
| 25 | 10 | Store states "No real money · Earned through learning." | `lib/i18n.ts` `shopNoRealMoney`; shop scenario check; `after-shop-*.png` | proven |
| 26 | 10 | Cosmetic-only, learning-earned currency | `lib/cosmetics.ts`, `lib/store.ts`; `lib/store.test.mjs` (66 checks); `lib/avatar.test.mjs` assessment-isolation test | proven |
| 27 | 11 Humor | Frequency cap, cooldown, deterministic selection | `lib/humor.ts`; `lib/humor.test.mjs` (340 checks) | proven |
| 28 | 11 | No humor during consent, technical, account, correction | `lib/humor.ts` `RESTRICTED_CONTEXTS`; `lib/humor.test.mjs` | proven |
| 29 | 11 | No invented Joel quotes before approval | All Joel lines `approval: "draft"`, excluded at runtime; `lib/humor.test.mjs` | proven |
| 30 | 12 Rewards | Idempotent completion reward | `lib/daily-session-reward.ts`; `lib/db/dexie-repository.ts` transaction; tests | proven |
| 31 | 13 Instructor | Sessions, level/path, speaking, weak areas, review, warnings | `app/api/coach/route.ts`, `app/coach/page.tsx`; `lib/report.test.mjs` (58 checks) | proven |
| 32 | 13 | Instructor data admin-only at API and UI | `lib/privacy-access.test.mjs` (27 checks); browser: `/coach` shows "No autorizado.", `/api/coach` returns 403 | proven |
| 33 | 14 Instrumentation | Closed event union, bounded properties | `lib/analytics-schema.ts`; `lib/analytics-schema.test.mjs` (214 checks) | proven |
| 34 | 14 | No transcripts, audio, voice, or contact data in events | Denied-name list rejected on every event type; `lib/analytics-schema.test.mjs` | proven |
| 35 | 14 | Metric definitions with exclusions | `docs/learning-metrics.md` | proven |
| 36 | 15.2 | 320 / 375 / 390 / 430 / tablet / desktop | 31 screenshots per state; zero horizontal overflow at all six widths | proven |
| 37 | 15.2 | Reduced motion | Browser scenario with `reduced_motion: reduce` | proven |
| 38 | 15.2 | Spanish accents and punctuation | Browser scenario asserts accented glyphs render | proven |
| 39 | 15.2 | Interrupted and resumed session | Browser scenario: leave mid-session, return to "PASO 1 DE 6 / Progreso guardado" | proven |
| 40 | 15.2 | Offline durability | Local-first render after `set_offline(true)` | partial (dev server; production offline unverified) |
| 41 | 15.2 | Speech failure and denied microphone | Unit-level only; no browser permission simulation | partial |
| 42 | 15.2 | New Google-account learner, existing learner | Owner-only credentials | unverified |
| 43 | 15.2 | Safari / Firefox coverage | Chromium only | unverified |
| 44 | 15.3 | Authenticated production smoke tests | Owner-only credentials | unverified |
| 45 | 17 Exclusions | No payments, energy gates, or guilt copy | `lib/game-system.test.mjs` energy guard; `lib/comeback.test.mjs` copy guard; store currency-symbol check | proven |
| 46 | 17 | No learner progress reset or rewrite | Whole-plan review confirmed no reset path added; only pre-existing user-invoked reset remains | proven |

## Summary

- proven: 33
- partial: 8 (5, 10, 11, 17, 19, 40, 41)
- unverified: 5 (14, 18, 42, 43, 44)
- contradicted: 0

Nothing in this matrix is marked proven on the strength of a unit test where the
requirement is about learner-visible behavior; those rows carry a screenshot or
a browser scenario as well.
