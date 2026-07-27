import type { TalkSession } from "@/lib/db/types";

// The general path's felt milestone: hold a ten-minute unscripted conversation
// without freezing.
//
// "Without freezing" has to be measurable or it is marketing. Three criteria are
// objective and are enforced here. A fourth — pauses below her own trailing
// average — is deliberately NOT gated yet: `avgPauseMs` is recorded on every
// session so the baseline can be built, but gating on it before that baseline
// exists would make the milestone unpredictable rather than fair.

export const MILESTONE_MINUTES = 10;
export const MILESTONE_TURNS = 20;

const MS_PER_MIN = 60_000;

export interface MilestoneProgress {
  /** Longest qualifying-shaped session so far, in whole minutes. */
  bestMinutes: number;
  /** Turns in that best session. */
  bestTurns: number;
  /** 0..100 toward the ten-minute goal. */
  percent: number;
  achieved: boolean;
  /** When she first achieved it, or null. */
  achievedAt: number | null;
}

/** A session counts only if she finished it — an abandoned call proves nothing. */
function eligible(s: TalkSession): boolean {
  return s.completed === true;
}

export function qualifies(s: TalkSession): boolean {
  return (
    eligible(s) && s.durationMs >= MILESTONE_MINUTES * MS_PER_MIN && s.studentTurns >= MILESTONE_TURNS
  );
}

export function milestoneProgress(sessions: TalkSession[]): MilestoneProgress {
  const done = sessions.filter(eligible);

  // Best is by duration, but a long session with almost no speaking from her is not
  // progress toward talking for ten minutes — so rank by the weaker of the two
  // criteria, expressed as a fraction of the goal.
  let best: TalkSession | null = null;
  let bestFraction = 0;
  for (const s of done) {
    const fraction = Math.min(
      s.durationMs / (MILESTONE_MINUTES * MS_PER_MIN),
      s.studentTurns / MILESTONE_TURNS,
    );
    if (fraction > bestFraction) {
      bestFraction = fraction;
      best = s;
    }
  }

  const achievedSessions = done.filter(qualifies).sort((a, b) => a.at - b.at);

  return {
    bestMinutes: best ? Math.floor(best.durationMs / MS_PER_MIN) : 0,
    bestTurns: best ? best.studentTurns : 0,
    percent: Math.max(0, Math.min(100, Math.round(bestFraction * 100))),
    achieved: achievedSessions.length > 0,
    achievedAt: achievedSessions.length ? achievedSessions[0].at : null,
  };
}
