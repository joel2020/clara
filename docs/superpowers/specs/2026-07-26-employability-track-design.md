# Clara — two paths, one destination each

Design doc. Date: 2026-07-26. Status: approved, revised after review.
Visual mockup: https://claude.ai/code/artifact/d12f71c9-6d7d-4ec9-bec6-4a99c700b2ef

## Goal

Clara stops being 13 practice modes and becomes a product with a destination.
But not everyone wants the same destination, so the student chooses her path once
at onboarding and can change it later:

- **Trabajo** — B2 spoken English, evidenced, for remote customer-support work
  with US companies. B2 is the stated hiring minimum for bilingual voice accounts
  in Medellín and BPOs screen with automated spoken tests, so this destination is
  defined by the market, not invented by us.
- **Hablar con confianza** — climb the CEFR ladder to B2, with the felt milestone
  being a 10-minute unscripted conversation with Joel without freezing.

Both paths answer the same question at a glance: *am I getting closer, and what
is the one thing blocking me?*

## Why two paths and not six

Onboarding already collects a `goal` (travel, social, work, moving, dating,
fluency) and `/api/chat` already adapts to it. That stays as **flavor inside the
general path** — it changes what Joel talks about, not where the student is
headed. Promoting all six goals to paths would recreate the problem we are
solving: many destinations competing, none winning.

The rule: **one choice at onboarding, exactly one path on screen afterward.** The
choice is not a menu the student keeps returning to.

## Non-goals

- Not a certification. We produce a practice assessment aligned to CEFR
  descriptors, and never claim to be Versant or issue a Versant score.
- Not a rewrite. The 13 modes stay and keep working; they stop being 13 equal
  entry points and become the drills that feed the score.
- Not professional/tech-role English (standups, Slack, meetings). That is the
  B2+ follow-on once support English lands.

## What differs by path, and what does not

Shared by both — this is what makes two paths cheap:

- The same four subskills and the same scoring engine.
- The same home layout: score, band, trajectory, one next action.
- The same gamification: stars, streak, shop, pets, cosmetics, quests.
- The same per-item progress and SRS.

| | Trabajo | Hablar con confianza |
|---|---|---|
| Target | B2 = 80, framed as hireable | B2 = 80, framed as fluent |
| Milestone | Passed mock exam + report | 10-minute unscripted conversation |
| Curriculum order | Support English and interview units first | Existing conversation ladder, ordered by band and goal |
| Joel in `/talk` | Also plays impatient customers (call simulator) | Friendly partner in her chosen goal's contexts |
| Exam | Required — it sets the band | Optional — placement sets the band |
| Report | Yes, for recruiters | Not by default |

### The four subskills (both paths)

| Subskill | Source of truth |
|---|---|
| Intelligibility | Azure `AccuracyScore` (already captured per attempt) |
| Fluency | Azure `FluencyScore`, plus words-per-minute and pre-speech pause |
| Listening under pressure | comprehension at natural speed / degraded audio |
| Interactive response | latency and relevance of unscripted answers |

## Score contract

1. **The band is set by an assessment, never by grinding.** On the general path
   that is the existing CEFR placement (`lib/placement.ts`). On the job path it
   is the timed mock exam, one sitting per day, no retries.
2. **Daily practice moves a provisional trend** between assessments, from
   telemetry already stored.
3. **Repeating mastered material must not move it.** Weight new and unmastered
   items only.
4. Home always shows band, score, target, and the single lowest subskill as the
   named blocker.

## The conversation milestone (general path)

"Ten minutes without freezing" has to be measurable or it is marketing. A
qualifying session is a single `/talk` conversation with:

- elapsed time >= 10 minutes,
- >= 20 student turns,
- no abandonment, and
- median pre-speech pause below her own trailing average, proving she is not
  stalling to translate in her head.

Partial progress is shown ("tu mejor charla: 6 minutos") so it reads as a climb.

## Storage

`settings.onboarding` is already a jsonb column synced to the cloud, so the path
is one more field inside it — **no migration required**. Add
`onboarding.path: "job" | "general"`, defaulting to `"general"` for existing
students so nobody is silently conscripted into the job track. The path selector
also lives in `/profile` next to "retake placement".

Switching paths never touches attempts, progress, or player stats. It changes
ordering, framing, and target only. This must be stated in the UI so a student
is not afraid to switch.

## Components

### 1. Path choice + readiness score + new home

- `lib/readiness.ts` — pure: `computeReadiness(attempts, progress, path, band)`
  returns `{score, band, target, subskills, blocker, milestone}`. Unit-tested,
  following `lib/placement.ts` and `lib/insights.ts`.
- Onboarding gains one step: which path, with plain-language framing (not jargon
  like "CEFR" or "BPO").
- Home leads with score, band, trajectory, next action; the 13 tiles collapse
  behind three intents (Practicar / Llamada or Charla / Examen) with the rest
  under "Explorar todo".
- Data viz: scores are magnitude, so all four subskill bars use the single
  primary blue; the blocking subskill carries an amber chip **with text**, so
  state is never conveyed by color alone.

### 2. Support-English and interview curriculum (job path)

Authored like `lib/content/conversation-*.ts` — `chunks()` rows with `text`,
`ipa`, Colombian-Spanish `meaning`, `hint` — plus Spanish intros in `es.ts`
(`INTROS_ES`), audio via the existing generate scripts.

Units: opening and identity verification · asking for repetition without losing
face · empathy and de-escalation · hold, transfer, callback · explaining problem
and next steps · **spelling names and reading numbers aloud** · closing and the
CSAT ask · declining or saying "I don't know" professionally. Then the interview
block: tell me about yourself · why this company · strengths and weaknesses ·
schedule and salary · questions to ask them.

Spelling and numbers on a call is where the existing sounds track pays off
directly — digit and letter clarity is a top real-world call failure.

### 3. Call simulator (job path)

Extends `/talk`. Joel plays an American customer at natural speed with a concrete
scenario, scored against a QA checklist: empathized · verified identity · read
digits back correctly · closed with a next step, plus intelligibility from Azure.
Playback at 1.0–1.15 rate reuses the existing `playbackRate` lever.

### 4. Mock exam and report (job path)

Six sections mirroring the industry format — read aloud, repeat sentence,
sentence build, short answer, story retell, open response — each mapping to an
existing verified primitive (produce-panel, `/shadow`, `/build`, `/listen`,
`/talk`). Timed, no retries same day. Output: band, four subscores, three fixes.
Report is a print-clean one-pager with an explicit "practice assessment, not an
official certification" line.

## Build order

The two-path decision reorders this, and improves it. The general path needs
almost no new content, because the conversation ladder already spans A0–C2. So
the design transformation can ship first and serve a real student immediately,
instead of waiting behind content authoring.

1. **Path choice, readiness score, new home.** Serves both paths. The general
   path is fully functional at the end of this phase using existing curriculum
   and existing placement. Mariana benefits on day one.
2. **Support-English and interview curriculum.** Unlocks the job path.
3. **Call simulator.** The differentiator.
4. **Mock exam and report.** Makes the job path's band verifiable and gives the
   student the artifact she sends with an application.

Interim honesty note: until phase 4, the job path's band also comes from
placement rather than the exam. The UI must say "provisional" until an exam has
been sat, or the number overclaims.

## Risks and costs

- **Azure Speech F0 is 5 audio-hours/month across all students.** Exams plus call
  practice consume that quickly — fine for two or three students, not twenty. S0
  is about $1/audio-hour. This is the one cost decision the design forces.
- **Two paths mean two experiences to keep honest.** Mitigated by sharing the
  engine and changing only target, ordering, and copy.
- **Trademark.** Mirror the format, cite CEFR, never say Versant to a user.
- **Existing students see a changed home.** Mariana is 66 lessons in with 3000
  stars; the gamification layer must survive the restructure untouched, and she
  must default to the general path.
- Chat now runs on Azure `gpt-5.6-luna` (low-latency, multilingual). The call
  simulator depends on that quality; if it proves weak at holding an impatient
  persona, `terra` is a one-line env change.

## Open decisions for Joel

- Azure Speech S0 upgrade: now, or when student count grows?
- Does the report carry the Alivio brand, or Joel personally as instructor?
- App Store: deferred by decision on 2026-07-26. Trigger to revisit is
  distribution, not capability.
