# Clara — "Camino al trabajo" (employability track)

Design doc. Date: 2026-07-26. Status: awaiting approval.
Visual mockup: https://claude.ai/code/artifact/d12f71c9-6d7d-4ec9-bec6-4a99c700b2ef

## Goal

Turn Clara from a collection of practice modes into a product with one promise:
**B2 spoken English, evidenced, for remote customer-support work with US
companies.** B2 is the stated hiring minimum for bilingual voice accounts in
Medellín, and BPOs screen with automated spoken tests (Versant is the common
one), so the destination is externally defined rather than invented.

Success: a student can answer "am I hireable yet, and what is the one thing
blocking me" at a glance, and leave with an artifact she can send a recruiter.

## Non-goals

- Not a certification. We produce a practice assessment aligned to CEFR
  descriptors. We never claim to be Versant or issue a Versant score.
- Not a rewrite. The 13 existing modes stay and keep working; they stop being
  13 equal entry points.
- Not professional/tech-role English (standups, Slack, meetings) in this pass.
  That is the B2+ follow-on once support English is landed.

## The four subskills

Chosen because they are what a support hiring screen actually measures:

| Subskill | Source of truth |
|---|---|
| Intelligibility | Azure `AccuracyScore` (already captured per attempt) |
| Fluency | Azure `FluencyScore`, plus words-per-minute and pre-speech pause |
| Listening under pressure | comprehension items at natural speed / degraded audio |
| Interactive response | latency and relevance of unscripted answers |

## Score contract

A dishonest number destroys the product, so the rules are explicit:

1. **The mock exam sets the band.** Only a timed, single-sitting, no-retry
   assessment may assert "you are B1". One sitting per day, per student.
2. **Daily practice moves a provisional trend** between exams, computed from
   telemetry we already store (accuracy, fluency, pauses, comprehension).
3. **Grinding easy material must not move it.** Weight new and unmastered items;
   repetitions of a mastered item contribute nothing.
4. The home screen always shows band, score, target (B2 = 80), and the single
   lowest subskill as the blocker.

## Components

### 1. Support-English curriculum (Phase 1)

New units authored exactly like `lib/content/conversation-*.ts` — `chunks()` rows
with `text`, `ipa`, Colombian-Spanish `meaning`, `hint` — plus Spanish intros in
`lib/content/es.ts` (`INTROS_ES`), audio via `scripts/generate-audio.mjs` and
`scripts/generate-es-audio.mjs`.

Units: opening and identity verification · asking for repetition without losing
face · empathy and de-escalation · hold, transfer, callback · explaining problem
and next steps · **spelling names and reading numbers aloud** · closing and the
CSAT ask · declining or saying "I don't know" professionally.

Then an interview block: tell me about yourself · why this company · strengths
and weaknesses · schedule and salary · questions to ask them.

Note: the spelling-and-numbers unit is where the existing sounds track pays off
directly — digit and letter clarity is a top real-world call failure.

### 2. Readiness score and new home (Phase 2)

- `lib/readiness.ts` — pure module: `computeReadiness(attempts, progress, exams)`
  returns `{score, band, subskills, blocker}`. Pure and unit-tested, following
  the pattern of `lib/placement.ts` and `lib/insights.ts`.
- Home leads with score, band chip, 8-week trajectory, next action.
- The 13 tiles collapse behind three intents: Practicar / Llamada / Simulacro,
  with the rest under "Explorar todo" (the expander already exists from the
  focus-daily-loop work).
- Data viz: scores are magnitude, so all four subskill bars use the single
  primary blue; the blocking subskill carries an amber chip **with text**
  ("bloquea B2") so state is never color-alone.

### 3. Call simulator (Phase 3)

Extends `/talk` rather than replacing it. Joel plays an American customer:
natural speed, mildly impatient, a concrete scenario. Structure per call:

- Scenario seed (double charge, wrong item, cancellation, angry about a delay).
- Scored against a QA checklist: empathized · verified identity · read digits
  back correctly · closed with a next step — plus intelligibility from Azure.
- Playback at 1.0–1.15 rate (the existing `playbackRate` machinery already
  handles 0.65 slow, so speeding up is the same lever).

This is the differentiated feature; no consumer language app ships it.

### 4. Mock exam and report (Phase 4)

- Six sections mirroring the industry format: read aloud, repeat sentence,
  sentence build, short answer, story retell, open response. Each maps to an
  existing verified primitive (produce-panel, `/shadow`, `/build`, `/listen`,
  `/talk`).
- Timed, no retries same day. Output: band, four subscores, three specific fixes.
- Report: print-clean one-pager (band, score, hours, phrases, calls, date, ID,
  instructor signature) with an explicit "practice assessment, not an official
  certification" line. Downloadable PDF and shareable link.

## Risks and costs

- **Azure Speech F0 is 5 audio-hours/month across all students.** An exam plus
  call practice consumes that quickly — fine for 2–3 students, not 20. S0 is
  about $1/audio-hour. This is the one cost decision the design forces.
- **The customer persona needs a stronger model.** gpt-4o-mini's weak
  instruction-following is what produced the "vase for her books" turn. Moving
  chat to a stronger model on the user's Azure account (in progress).
- **Trademark.** Mirror the format, cite CEFR, never say Versant to a user.
- **Existing students see a changed home.** Mariana is 66 lessons in with 3000
  stars; the gamification layer must survive the restructure untouched.

## Build order

Each phase depends on the previous; the score cannot exist before the content it
measures.

1. Support-English and interview curriculum, with audio.
2. Readiness score and the new home.
3. Call simulator.
4. Mock exam and report.

Phases 3 and 4 may swap if the motivating feature is wanted sooner.

## Open decisions for Joel

- Azure Speech S0 upgrade: now, or wait until student count grows?
- Which model for the call simulator once the Azure OpenAI deployment is live?
- Does the report carry the Alivio brand, or Joel personally as instructor?
