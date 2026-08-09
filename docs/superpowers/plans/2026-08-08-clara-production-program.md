# Clara Production Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Clara redesign and production-hardening program through four independently reviewable plans, ending with a verified 9.0/10 release.

**Architecture:** Work proceeds through explicit dependency gates. Production trust foundations land first, strict pronunciation builds on those stable interfaces, the Lumi experience and Closet consume the new learning/store data, and the release plan proves the integrated system on production infrastructure and real devices.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Dexie 4, Supabase Auth/Postgres/RLS, Azure Speech Pronunciation Assessment, Higgsfield image generation, Vercel, GitHub Actions, Playwright.

## Global Constraints

- Product name is Clara; Lumi is the only recurring student-facing character.
- Target audience is adult LATAM English learners, initially Colombian Spanish speakers.
- Pronunciation standards never ease adaptively; scaffolding may change, pass evidence may not.
- No raw audio retention, unrestricted transcript analytics, loot boxes, real-money cosmetics, or child enrollment.
- Normal daily sessions never hard-block after three valid pronunciation misses; stage assessments remain gated.
- Every UI control is keyboard reachable, has a visible focus state, and meets a 44×44 CSS-pixel touch target where applicable.
- Every task uses test-first development and ends in a focused commit.
- Production release requires zero unaccepted high/critical dependency findings and no unresolved P0 audit finding.

---

## Execution order

1. [Production foundation](2026-08-08-production-foundation.md)
2. [Strict LATAM pronunciation](2026-08-08-latam-pronunciation.md)
3. [Lumi experience and Closet](2026-08-08-lumi-experience-closet.md)
4. [Release verification](2026-08-08-release-verification.md)

Each plan must finish its own verification gate before the next begins. Do not combine
commits across plans: a reviewer must be able to reject pronunciation policy without
rolling back dependency or access-control fixes.

## Shared interfaces

- Production foundation produces `requireAllowedUser(request)` and consistent
  `/api/me` flags for every paid route and learner gate.
- Pronunciation produces `gradePronunciation(input)`, `diagnosePronunciation(input)`,
  and `advancePronunciationSession(state, event)` for UI consumers.
- Lumi experience consumes pronunciation outcomes but never recomputes scores.
- Release verification consumes `npm run verify`, `npm run audit:prod`, Playwright
  projects, Supabase advisor output, Vercel deployment state, and recorded device evidence.

## Approved-spec traceability

| Approved design section | Owning plan and tasks |
|---|---|
| Outcome, boundaries, principles | Program constraints and all child completion gates |
| Four-space information architecture | Lumi Experience Tasks 1–4 |
| Daily learning loop | Pronunciation Tasks 4, 6–7; Lumi Experience Task 2 |
| LATAM priority map and strict scoring | Pronunciation Tasks 1–3 and 10 |
| Three-attempt coaching and games | Pronunciation Tasks 4, 6–9 |
| Structured pronunciation data | Pronunciation Task 5 |
| Human calibration | Pronunciation Task 11; Release Task 7 |
| Lumi-only identity | Foundation Task 3; Lumi Experience Tasks 4 and 10 |
| Six-outfit City Remix and Higgsfield workflow | Lumi Experience Tasks 6–7 |
| Lumi's Closet and unlock economy | Lumi Experience Tasks 5–8 |
| Motion and sound | Lumi Experience Task 9 |
| Dependencies, auth, quotas, browser security, accessibility | Foundation Tasks 1–5 and 8 |
| Supabase roles/recovery and observability | Foundation Tasks 6–7; Release Tasks 3–4 |
| Trust surface and adult-only boundary | Release Task 2 |
| Failure behavior | Pronunciation Tasks 2, 4, 6, and 8; Release Task 1 |
| Automated and human/device verification | Release Tasks 1 and 5–8 |
| Rollout and rollback | Child-plan order; Release Task 9 |

## Non-automatable release gates

The implementation may proceed without waiting for these inputs, but production cannot
be certified until each is real and recorded:

- Higgsfield workspace access and approval of the single Cancha Chic likeness test before
  spending credits on the remaining 41 accepted assets.
- At least six consenting adult LATAM speakers and 30 instructor-rated recordings.
- Physical iPhone and older Android access for device acceptance.
- A bounded invite-only adult student pilot.
- Ownership or selection of the Clara branded domain if the Vercel project has none.

No executor may fabricate these inputs or mark their dependent checkboxes complete from
unit-test evidence alone.

## Program completion gate

- [ ] All four child plans are fully checked and their commits are present on the release branch.
- [ ] `npm ci && npm run verify && npm run audit:prod && npm run test:e2e` exits 0.
- [ ] Vercel production deployment is READY on the release commit with clean runtime logs.
- [ ] Current Clara Supabase RLS, advisors, leaked-password protection, and two-user isolation are verified.
- [ ] iPhone, Android, desktop, keyboard, VoiceOver, push, offline/reconnect, and cross-device evidence is recorded.
- [ ] Final production audit is at least 9.0/10 with no unresolved P0 item.
