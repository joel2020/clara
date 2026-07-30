# Learning metrics

The definitions the instructor cockpit (`app/api/coach/route.ts`, `app/coach/page.tsx`)
computes, and the only definitions anyone may quote when reporting how Clara is
doing. Every metric below is derived from the closed analytics schema in
`lib/analytics-schema.ts` plus the learner's own practice tables. Nothing here
reads a transcript, a recording, an email address, or a raw event property.

The optimization target is **meaningful completed learning**, not time in app.
Two rules follow from that and apply to every metric on this page:

1. **A technical failure is never a learner mistake.** Failures are recorded as
   `technical_failure` events with a bounded `category`
   (`speech-recognition`, `microphone-permission`, `audio-playback`, `network`,
   `sync`, `api`, `storage`). They never enter a numerator of learner
   performance, and they remove the affected unit from the denominator where the
   learner was blocked rather than disengaged.
2. **A technical-skip is never completed practice.** An activity that ends with
   `activityStatus: "technical-skip"` is excluded from completed practice,
   practice time, and speaking participation. Only
   `activityStatus: "completed"` counts.

## Shared terms

| Term | Definition |
| --- | --- |
| **Local day** | The learner's own calendar day, as the `YYYY-MM-DD` `day` column written on every event by the device that produced it. All day arithmetic (returns, active days, streak gaps) uses that string, never a server timezone. `player_stats.last_active_day` is the same local-day string. |
| **Window** | The trailing 14 local days ending today, inclusive. Every rate on this page is computed inside the window; anything older is out of scope, not zero. |
| **Eligible population** | Auth-bound learner profiles only: `profiles.id` matching a UUID. Legacy sync-code (text slug) profiles and the instructor's own admin account activity are excluded. |
| **Valid attempt** | A pronunciation attempt the learner actually produced: a row in `attempts`, or a `speaking_attempted` event. Capture failures are never written to attempt history (`AttemptEvidence` in `lib/db/types.ts`), so attempt history is valid by construction. |
| **Empty denominator** | Reported as `null`, never as `0`. Zero would read as "she scored badly"; null reads as "not measured yet". |

---

## 1. Daily active learner

- **Unit:** learners (count), and the derived rate over the eligible population.
- **Numerator:** distinct eligible learners with at least one *meaningful* event
  on the local day — an `activity_complete` with `activityStatus: "completed"`,
  or a `speaking_attempted` event. For **today only**, her own day counter
  (`player_stats.last_active_day`) also counts: it is written on practice, and a
  learner whose events are still queued in the outbox has practised all the
  same. Past days are event-evidenced only.
- **Denominator (for the rate):** eligible learners with any practice history.
- **Local-day boundary:** the event's own `day` field.
- **Exclusions:** `app_open`, `mode_open`, `session_start` and `session_resume`
  alone do not make a learner active — opening the app is not learning.
  `activity_complete` with `activityStatus: "technical-skip"` does not count.

## 2. Daily session completion rate

- **Unit:** percentage of started session-days that were completed.
- **Numerator:** learner-days in the window with at least one `session_complete`.
- **Denominator:** learner-days in the window with at least one `session_start`,
  minus excluded days (below).
- **Local-day boundary:** the event `day`. A session started before midnight and
  finished after it is attributed to the day the events carry.
- **Exclusions:**
  - Days with a `session_start`, no `session_complete`, and at least one
    `technical_failure` — the app blocked her, so the day leaves the denominator
    entirely rather than counting as an abandoned session.
  - `session_resume` never adds to the denominator; resuming is not a second
    session.
  - Days outside the window; learners outside the eligible population.

## 3. Next-day return rate

- **Unit:** percentage of eligible active days followed by another active day.
- **Numerator:** active local days `D` (per metric 1) where `D + 1` is also an
  active day for the same learner.
- **Denominator:** active local days `D` inside the window where `D` is strictly
  before today.
- **Local-day boundary:** `D + 1` is the calendar day after `D` in the learner's
  local days.
- **Exclusions:** today (the learner still has a day to return in, so counting it
  would guarantee a miss), and active days before the window start, which are
  not observed at all. The client's `return_next_day` event is corroborating instrumentation; the rate
  is computed from active days so a missing marker cannot deflate it.

## 4. Seven-day return rate

- **Unit:** percentage of eligible active days followed by a return within a week.
- **Numerator:** active local days `D` where at least one of `D + 1 … D + 7` is
  also an active day for the same learner.
- **Denominator:** active local days `D` inside the window with a full seven-day
  observation period available (`today − D >= 7`).
- **Exclusions:** active days too recent to have had seven days to return in.
  Same corroboration note as metric 3 for `return_seven_day`.

## 5. Meaningful practice time

- **Unit:** minutes, reported as the average per active learner-day.
- **Numerator:** sum of `durationMs` on `activity_complete` events with
  `activityStatus: "completed"`, each capped at 10 minutes.
- **Denominator:** active learner-days (metric 1) in the window.
- **Local-day boundary:** the event `day`.
- **Exclusions:**
  - Any activity with `activityStatus` of `technical-skip`, `pending`, or
    `active` — unfinished or app-broken work is not practice time.
  - Events with no `durationMs` (an optional property; its absence drops the
    duration, never the event).
  - Time above the 10-minute per-activity cap, which is a backgrounded tab, not
    practice. The composed daily session budgets 15 minutes in total, so no
    single honest activity approaches the cap.
  - Session wall-clock time, screen time, and idle time are never counted.
- **Per learner:** the cockpit row shows the same numerator as a window total
  (`sessions.practiceMinutes`), not an average; the cohort tile shows the average
  per active learner-day.

## 6. Speaking participation

- **Unit:** percentage of eligible session-days on which the learner spoke.
- **Numerator:** learner-days with at least one `speaking_attempted` event
  (a valid attempt, passed or failed — trying counts).
- **Denominator:** learner-days with at least one `session_start`, minus
  excluded days.
- **Exclusions:** a day is removed from both numerator and denominator when the
  speak activity ended as `activity_complete` with
  `activityStatus: "technical-skip"` and no valid attempt was recorded — a
  microphone permission denial or a dead recognizer must not read as a learner
  who refused to speak.
- **Note:** failing an attempt is participation. Only silence is non-participation.

## 7. Review completion rate

- **Unit:** percentage of due review items that were actually reviewed.
- **Numerator:** sum of `completedCount` across `review_complete` events in the
  window.
- **Denominator:** sum of `dueCount` across the same events.
- **Local-day boundary:** the event `day`; the metric is a window sum, not a
  per-day average, so a heavy backlog day is not diluted by a light one.
- **Exclusions:** events with `dueCount: 0` contribute nothing to either side
  (there was nothing to review). Items still due but never surfaced are reported
  separately as **review need** (count of `progress` rows with
  `due_at <= now`, `attempts > 0`, and `box < 5`), which is a backlog, not a rate.

## 8. Technical failure rate

- **Unit:** percentage of practice interactions that failed for a technical reason.
- **Numerator:** `technical_failure` events in the window, all categories.
- **Denominator:** technical interactions attempted — `activity_complete` events
  with `activityStatus: "completed"`, plus `speaking_attempted` events, plus the
  numerator (so a failure is counted as an attempted interaction that did not
  land).
- **Exclusions:**
  - `client_error` events are developer diagnostics, not learner-facing
    technical failures, and are reported separately in the cockpit's error list.
  - A retried-and-recovered failure (`retried: true`) still counts: she still
    waited.
  - This rate never affects accuracy, pass rate, streaks, XP, or weak-area
    ranking. It is a measure of us, not of her.

---

## Weak areas (ranking, not a rate)

Weak areas are grouped by curriculum label — the item's `phoneme` when it has
one, otherwise its `category_id`. The label is curriculum metadata; no learner
content is involved.

- **Valid attempts only.** Misses come from rows in `attempts` inside the window
  (`passed = false`). Because a capture failure is never written to attempt
  history, and `technical_failure` events are a separate stream that this ranking
  does not read, a broken microphone can never manufacture a weak area.
- **Due progress.** An item counts toward its area's due total when
  `due_at <= now`, `attempts > 0`, and `box < 5` (not yet mastered).
- **Score:** `missRate + 0.05 x min(dueItems, 5)`, where
  `missRate = misses / validAttempts` (0 when there are no attempts). Ties break
  on more misses first, then alphabetically by label so the order is stable.
- **Eligibility:** an area appears only if it has at least one miss or at least
  one due item. Mastered items (`box >= 5`) and never-attempted items produce
  neither.
- **Bound:** the top 3 areas per learner are returned. The cockpit is a triage
  screen, not an export.

## Sync and technical warnings (operational, not a metric)

Bounded warning codes per learner, for triage:

| Code | Trigger |
| --- | --- |
| `never-practiced` | No `last_active_day` at all. |
| `quiet` | 3 or more local days since `last_active_day`. |
| `session-drop` | 2 or more started session-days and a completion rate below 50%. |
| `no-speaking` | At least one started session-day in the window and zero `speaking_attempted` events. |
| `review-backlog` | 12 or more items due (see metric 7). |
| `sync-lag` | `last_active_day` is 2 or more days newer than the newest event that reached the cloud, or any `technical_failure` in `sync` / `network` / `storage`. This is the server-visible shadow of a local outbox that has not drained (`lib/sync/outbox.ts` retries entirely on-device). |
| `technical-trouble` | 3 or more `technical_failure` events in the remaining categories. |

Warnings are heuristics for deciding who to message today. They are deliberately
not reported as learning outcomes.

## What the instructor response never contains

The coach API returns bounded per-learner summaries only: counts, rates,
durations, curriculum labels, bounded warning codes, the learner's display name,
and her profile id. It never returns a transcript, an attempt's target or heard
text, voice content, an email address, or a raw event `props` object — the
handler selects only the columns it aggregates and never forwards a props bag.
Admin-only at both layers: `app/api/coach/route.ts` rejects non-admins with 403
before any query runs, and `app/coach/page.tsx` renders the teacher screen only
for `useAccess().admin`. Per-account RLS is unchanged.
