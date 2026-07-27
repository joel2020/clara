# Clara — Session Handoff

Paste the prompt below into a fresh Claude Code session (run from `~/clara`) to
continue where the last session left off. Last updated: 2026-07-27.

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

TWO THINGS ONLY YOU CAN DO:
1. Set AZURE_OPENAI_API_KEY. Until then prod deliberately still runs
   gpt-4o-mini, because getChatModel() requires all three variables:
     cd ~/clara && read -rs "K?Azure key: " && echo && \
       printf 'AZURE_OPENAI_API_KEY=%s\n' "$K" >> .env.local && \
       for e in production preview; do printf %s "$K" | npx vercel env add AZURE_OPENAI_API_KEY $e; done && \
       unset K
   Then redeploy and verify a real /talk turn. WATCH FOR: gpt-5.6-luna is
   reasoning-capable, and reasoning tokens count against max_completion_tokens
   (currently 600 in app/api/chat/route.ts) — empty replies mean raise it.
2. Azure Speech is still F0 = 5 audio-hours/month across ALL students. The stage
   exams will chew through that. S0 is about $1/audio-hour.

KNOWN HONEST GAP: readiness fluency is a PROXY (recent pass rate). Azure returns a
real FluencyScore per attempt but nothing persists it on `Attempt`. That is item 1
in WHAT IS LEFT, and until it is done the copy must not call it measured fluency.

TEST SUITE (191 checks, all green): placement 45, exams 28, exam-compose 24,
report 24, readiness 16, weak-items 16, insights 13, chat-client 11, today 8,
paths 6. Run the alias-free ones with
`node lib/<x>.test.mjs`; those importing through "@/" need `npx tsx`.

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
