# Clara — seven-day pilot

A short, honest test of one question: **does a guided daily session get a real
adult learner to practice speaking on more days than the old thirteen-modes app
did, without making her feel bad on the days she misses?**

This is not a growth test. Nothing here measures time in app, and no success
criterion rewards keeping someone on their phone longer.

## Cohort

Four to six of Joel's former students. Adults, Colombian Spanish speakers,
already known to Joel so that honest feedback is possible. Include at least:

- one learner at A1/A2 and one at B1 or above, so the composer is exercised
  across levels;
- one learner who is out of practice (has not studied in a month or more), so
  the comeback session is exercised;
- one learner on an older or lower-end Android phone, and one on iPhone.

Two learners already using Clara continue as the baseline; their existing
progress is never reset.

## Consent and support

Before day 1, each participant gets, in Spanish:

- what the app records (practice attempts, session progress, counts and
  timings — never a recording of their voice sent anywhere, never their
  contact details in analytics);
- that participation is optional and stopping costs them nothing;
- that their data is theirs and can be deleted on request;
- a direct WhatsApp line to Joel for anything that breaks.

Record consent before the learner's first session. No pilot analytics are read
for a learner who has not consented.

## The daily task

One guided session a day, from the dashboard: open Clara, press Empezar, follow
the steps to the end. About 15 minutes, or 5-8 on a comeback day. Nothing else
is asked. Learners are explicitly told that a missed day is fine and that the
app will not punish them for it.

## What is measured

All of these come from the closed event schema in `lib/analytics-schema.ts` and
the definitions in `docs/learning-metrics.md`.

| Measure | Definition | What would count as good |
| --- | --- | --- |
| Session completion rate | Sessions completed / sessions started, per learner | Most started sessions get finished |
| Speaking participation | Days with at least one valid speaking attempt / active days | Speaking happens on most active days, not just tapping |
| Next-day return | Learners active on day N who are active on N+1 | Returning without a reminder |
| Seven-day return | Active on day 1 and again by day 7 | The loop survives a gap |
| Technical failure rate | Categorized technical failures / sessions | Low, and never mistaken for learner error |
| Useful feedback | Count of specific, actionable reports from learners | Volume matters less than specificity |

Deliberately not measured as a success signal: total minutes in app, streak
length, store spending.

## Schedule and interviews

**Day 1 — setup and first session.** Joel walks each learner through install and
the first guided session, watching without helping unless they are stuck.

Ask afterwards: What did you think this was asking you to do? Was anything
confusing? Did the app ever seem to say you got something wrong when you had
not?

**Day 3 — mid-pilot check.** Short message or call.

Ask: Have you skipped a day? How did the app make you feel about that? Is the
session too long, too short, or right? Is the speaking part working on your
phone?

**Day 7 — exit interview.** Longer conversation.

Ask: Would you keep using this without me asking you to? What is the one thing
you would change? Did you feel your English actually moved? Did the store or
the avatar matter to you at all, or is it noise? Was anything ever unfair?

Record answers verbatim in Spanish; do not paraphrase into English before
analysis.

## Issue severity and response

| Severity | Definition | Response |
| --- | --- | --- |
| S1 | Learner progress lost, wrong learner's data visible, auth or privacy failure | Stop the pilot. Fix or roll back the same day. |
| S2 | Learner blocked from completing a session; speaking unusable on a device | Fix within 24 hours; tell affected learners directly. |
| S3 | Wrong or misleading feedback shown, including a technical failure presented as a learner mistake | Fix within 48 hours. |
| S4 | Cosmetic, copy, or layout problem | Log it; batch after the pilot. |

Any S1 is also a rollback trigger regardless of cause.

## Rollback criteria

Roll back to the previous production commit if any of these hold:

- any S1 occurs;
- two or more learners cannot complete a session on their own device;
- session completion rate is below one third across the cohort after day 3;
- learners report the app made them feel judged or punished.

Rollback procedure: redeploy the last known-good commit from the Vercel
dashboard (promote the previous production deployment). Learner data is not
migrated backwards — the schema changes in this release are additive, so an
older build ignores the new columns rather than failing on them.

## After the pilot

Write up: what was learned per measure, the verbatim feedback, every issue with
its severity, and an explicit recommendation to continue, change, or stop.
Educational risks that the pilot did not resolve stay on the risk list in
`docs/verification/2026-07-29-results.md` rather than being quietly dropped.
