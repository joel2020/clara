// The end-of-call report.
//
// Assembled from what actually happened on the call, not from a second model
// pass over a summary. The model contributes the encouraging prose; every claim
// with a number behind it — how many turns, which corrections, whether
// pronunciation was measured — is computed here from the recorded turns so the
// report cannot congratulate her for something she did not do.

import type { CallState, CorrectionKind, LearnerTurn, TurnCorrection } from "./session.ts";

export interface ReportCorrection {
  original: string;
  corrected: string;
  explanation: string;
  kind: CorrectionKind;
  /** True when she said the fixed sentence back and it was accepted. */
  fixedOnRetry: boolean;
}

export interface PronunciationSummary {
  /** Number of utterances that were actually scored against a known target. */
  scored: number;
  averageScore: number;
  worstWords: string[];
}

export interface CallReport {
  scenarioId: string;
  durationMs: number;
  learnerTurns: number;
  /** Turns where nothing needed fixing. The "what went well" evidence. */
  cleanTurns: number;
  metCriteria: boolean;
  corrections: ReportCorrection[];
  /** Two or three, most severe first. */
  priorities: ReportCorrection[];
  vocabularyUsed: string[];
  /**
   * Present ONLY when at least one utterance was scored against a known target.
   * Absent means pronunciation was not measured — never that it was perfect.
   */
  pronunciation?: PronunciationSummary;
  retriedCount: number;
  retriedAcceptedCount: number;
}

const SEVERITY_RANK: Record<TurnCorrection["severity"], number> = {
  blocking: 3,
  significant: 2,
  minor: 1,
  none: 0,
};

function toReportCorrection(turn: LearnerTurn): ReportCorrection | null {
  if (!turn.correction || turn.correction.severity === "none") return null;
  return {
    original: turn.correction.original,
    corrected: turn.correction.corrected,
    explanation: turn.correction.explanation,
    kind: turn.correction.kind,
    fixedOnRetry: Boolean(turn.retry?.accepted),
  };
}

/**
 * Which corrections to lead with. Most severe first, and a mistake she already
 * fixed on a retry is deprioritized — she has demonstrably got it, so putting
 * it top of her list would be discouraging and wrong.
 */
export function prioritizeCorrections(turns: LearnerTurn[], limit = 3): ReportCorrection[] {
  const scored = turns
    .map((t) => ({ turn: t, report: toReportCorrection(t) }))
    .filter((x): x is { turn: LearnerTurn; report: ReportCorrection } => x.report !== null)
    .map(({ turn, report }) => ({
      report,
      rank: SEVERITY_RANK[turn.correction!.severity] - (report.fixedOnRetry ? 1.5 : 0),
    }));
  // Collapse repeats of the same corrected sentence — a pattern repeated three
  // times is one thing to work on, not three.
  const seen = new Set<string>();
  const unique: typeof scored = [];
  for (const item of scored.sort((a, b) => b.rank - a.rank)) {
    const key = item.report.corrected.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique.slice(0, limit).map((x) => x.report);
}

/**
 * Pronunciation summary, or undefined when nothing was scored.
 *
 * Only retry utterances carry evidence, because only they had a known target
 * for the speech service to score against. Returning undefined is the honest
 * answer for a call where she never retried anything.
 */
export function summarizePronunciation(turns: LearnerTurn[]): PronunciationSummary | undefined {
  const scored = turns.map((t) => t.pronunciation).filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (scored.length === 0) return undefined;
  const total = scored.reduce((sum, p) => sum + p.score, 0);
  const worstWords = scored
    .map((p) => p.worstWord)
    .filter((w): w is string => Boolean(w && w.trim()))
    .slice(0, 3);
  return {
    scored: scored.length,
    averageScore: Math.round(total / scored.length),
    worstWords,
  };
}

/** Target vocabulary the learner actually said, matched on word boundaries. */
export function vocabularyUsed(turns: LearnerTurn[], target: readonly string[]): string[] {
  const said = turns.map((t) => t.transcript.toLowerCase()).join(" ");
  return target.filter((phrase) => {
    const p = phrase.toLowerCase().trim();
    if (!p) return false;
    return new RegExp(`(^|\\W)${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`).test(said);
  });
}

export function buildReport(input: {
  state: CallState;
  now: number;
  targetVocabulary: readonly string[];
  metCriteria: boolean;
}): CallReport {
  const { state, now } = input;
  const turns = state.turns;
  const corrections = turns.map(toReportCorrection).filter((c): c is ReportCorrection => c !== null);
  const retried = turns.filter((t) => t.retry);
  return {
    scenarioId: state.scenarioId,
    durationMs: Math.max(0, (state.endedAt ?? now) - state.startedAt),
    learnerTurns: turns.length,
    cleanTurns: turns.filter((t) => !t.correction || t.correction.severity === "none").length,
    metCriteria: input.metCriteria,
    corrections,
    priorities: prioritizeCorrections(turns),
    vocabularyUsed: vocabularyUsed(turns, input.targetVocabulary),
    pronunciation: summarizePronunciation(turns),
    retriedCount: retried.length,
    retriedAcceptedCount: retried.filter((t) => t.retry?.accepted).length,
  };
}
