# Clara — Session Handoff

Paste the prompt below into a fresh Claude Code session (run from `~/clara`) to
continue where the last session left off. Last updated: 2026-07-30.

## Where things stand (2026-07-30)

The daily-classroom rebuild is **shipped to production** at commit `2db5052`.
Clara is no longer a menu of practice modes: the dashboard leads with today's
session, and `/today` is a guided, resumable runner that checkpoints every step.

Landed: the daily-loop runner and composer, account-scoped persistence with a
monotonic Supabase merge, idempotent completion rewards, adult learner avatars
(woman and man, in their 20s) with original baseball caps and pets, an
earned-only store stating "No real money · Earned through learning.", a closed
privacy-bounded analytics schema, instructor insights, comeback sessions, and
the Clara character design system and typed asset manifest.

Evidence: `docs/verification/2026-07-29-results.md`, the requirement matrix
beside it, and 61 before/after screenshots across six widths.

### Resolved 2026-07-30

- **Joel approved his six humor lines.** They now carry `joel-approved` in
  `lib/content/humor.ts` and can render in his voice. Any NEW line still starts
  as `draft` and is excluded at runtime — the gate is per line, not per file.
- **Joel approved the Clara master sheet**, and the seven production states were
  produced from it and committed to `public/character/clara/`.
- **Joel then decided Lumi is the better character**, so the learner-facing
  guide was reverted to Lumi across the app. Clara's artwork and manifest stay
  in the repo, unused, behind `CLARA_ARTWORK_AVAILABLE` — restoring her is a
  flag flip plus reverting one commit, not a regeneration.
- **The Virtual Call still uses Clara**, because that feature was built around
  her as a named AI practice guide and never had Lumi to revert to. Changing it
  means rewriting the system prompt, the on-screen AI disclosure, and
  `VIRTUAL_CALL_SYSTEM.md` — a real change, not a swap. Open question for Joel.

**Still needs Joel — owner-only:**

1. **Authenticated production smoke tests**, which need an owner account on the
   allowlist.
2. **Physical iPhone checks**: microphone capture, Safari PWA install, OAuth
   redirect, and push delivery.
3. **Safari and Firefox** rendering; everything verified so far was Chromium.
4. **Run `docs/PILOT_PLAN_7_DAYS.md`** with the former students.

---

```
Continue work on Clara — my American-English app for Colombian Spanish speakers
(students: Mariana, Valentina; I'm Joel, teacher/admin). Local repo: ~/clara.
Live: clara-joel-carias-projects.vercel.app  Repo: github.com/joel2020/clara
(auto-deploys on push to main). Read my memory file clara-pronunciation-app.md
before starting.

THE BIG PICTURE (decided 2026-07-26/27): Clara is no longer thirteen practice
modes, it is a product with a destination the student chooses.
  - Spec:   docs/superpowers/specs/2026-07-26-employability-track-design.md
  - Plan:   docs/superpowers/plans/2026-07-27-phase-1-paths-and-readiness.md
  - Mockup: https://claude.ai/code/artifact/d12f71c9-6d7d-4ec9-bec6-4a99c700b2ef

Two paths, chosen at onboarding, changeable in /profile, defaulting to "general"
for existing students:
  - job     — B2 evidenced, for remote US customer-support work (B2 is the real
              Medellin BPO hiring bar; they screen with Versant-style tests)
  - general — climb to B2 plus hold a 10-minute unscripted chat without freezing

ALL FIVE PHASES ARE SHIPPED AND LIVE:
- Phase 1 — paths + readiness: lib/paths.ts, lib/readiness.ts, the onboarding path
  step, the /profile switcher, components/readiness-card.tsx leading the home page.
- Phase 2 — stage exams: /exam. lib/exams.ts (80% mastery unlocks a sitting,
  weighted six sections, pass mark 70, one sitting per day, promotion),
  lib/exam-compose.ts (composed from existing curriculum so no new audio is needed;
  seeded by day+level so a sitting is reproducible), app/api/grade (LLM grader for
  the two open-ended sections), Dexie v6 examAttempts.
- Phase 3 — support curriculum: lib/content/conversation-support.ts, 9 units and 90
  phrases with Joel + full cast audio (630 clips) and 90 Spanish gloss clips.
  pickNextLesson is path-aware, so the job path walks these first.
- Phase 4 — call simulator: /call. Five personas from calm to furious, /api/chat
  mode:"call" (customer, never a tutor), /api/call-score against the BPO QA rubric,
  Dexie v7 callScores.
- Phase 5 — recruiter report: /report, print-to-PDF, gated behind a passed exam.
- Plus: four Medellin outfits, the Azure gpt-5.6-luna deployment (env-gated), and
  three real bug fixes (weak-item ranking inversion, reset() leaks, and
  computeReadiness never receiving examPassed so provisional could never clear).

DO NOT "FIX" THESE — they are deliberate:
- The exam writes no SRS progress (otherwise a sitting inflates the very mastery
  percentage that unlocks the next sitting).
- A failed mic capture scores zero (an exam cannot be dodged with a silent mic).
- On a call, correction and practice are forced null server-side — a customer does
  not teach.
- The report shows nothing until an exam is passed, and never claims a band above
  what was demonstrated.
- The report has no "hours studied" figure because Clara does not measure time.

WHAT IS LEFT (in rough value order):
1. Thread Azure's real FluencyScore onto Attempt and drop the pass-rate proxy in
   lib/readiness.ts. This is the last "honest approximation" in the product.
2. The general path's 10-minute conversation milestone is defined in the spec but not
   implemented: /talk does not record session duration or turn counts yet.
3. Cloud sync for examAttempts and callScores (both are local-only today, so a
   device change loses them — progress and stars already sync).
4. Real-device QA of /exam and /call on Mariana's iPhone. Neither has been through a
   full run with a real microphone.
5. Optionally surface support-track progress on /mundo.

AZURE IS FULLY LIVE (2026-07-27):
- clara-speech is on S0 Standard, so the 5-audio-hour/month cap is gone
  (~$1/audio-hour, no idle cost).
- AZURE_OPENAI_API_KEY is set locally and in Vercel prod+preview, and a rebuild has
  picked it up — so /talk, /call, the exam grader and the QA scorer all run on
  gpt-5.6-luna now, not gpt-4o-mini.
- Verified against the live deployment: strict json_schema works on api-version
  2024-12-01-preview, ~2.5s latency with ~150ms to first token, and 74-78 reasoning
  tokens per reply. That last number is why max_completion_tokens is 2000 everywhere
  and must not be lowered — a tight ceiling returns an EMPTY reply on this model.

NO KNOWN DISHONEST NUMBERS: fluency now comes from Azure's measured FluencyScore,
with unmeasured attempts EXCLUDED rather than zeroed, and the card says "(estimada)"
whenever it has to fall back to the pass-rate proxy. Keep that label honest.

TEST SUITE (440 checks, all green across 16 files): placement 45, exams 28,
exam-compose 24, report 24, gamification 30, srs 22, scoring 24, readiness 21,
milestone 21, weak-items 16, insights 13, chat-client 11, sync-schema 109,
sync-coverage 38, today 8, paths 6. Run `npm test` for the lot; alias-free files
run under `node lib/<x>.test.mjs`, those importing through "@/" or "./x.ts" need `npx tsx`.

KEY CONSTRAINTS (do not violate):
- Never use emojis in any written output or drafted copy.
- Act directly, don't ask permission for routine steps.
- Vercel commits MUST be authored 46899218+joel2020@users.noreply.github.com
  (else the deploy blocks). End commit bodies with the Claude co-author line.
- Never commit or print secrets (.env.local is gitignored).
- Audio = ElevenLabs (Joel voice); images = OpenAI gpt-image-1; video =
  Higgsfield MCP + ffmpeg.
- Existing students must keep defaulting to the general path.
- lib/paths.ts must stay dependency-free — lib/onboarding.ts imports it with a
  "./paths.ts" extension so its tests run under bare node.
- I don't want accounts created or passwords typed on my behalf.

Start by reading clara-pronunciation-app.md, then pick from WHAT IS LEFT.
```
