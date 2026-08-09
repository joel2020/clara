// The end-of-call report.
//
// Assembled from what actually happened on the call, not from a second model
// pass over a summary. The model contributes the encouraging prose; every claim
// with a number behind it — how many turns, which corrections, whether
// pronunciation was measured — is computed here from the recorded turns so the
// report cannot congratulate her for something she did not do.

import type { CallPronunciationDiagnostic, CallState, CorrectionKind, LearnerTurn, TurnCorrection } from "./session.ts";
import { LATAM_PRONUNCIATION_PRIOR, type PronunciationCueKey } from "../speech/latam-prior.ts";

export interface ReportCorrection {
  original: string;
  corrected: string;
  explanation: string;
  kind: CorrectionKind;
  /** True when she said the fixed sentence back and it was accepted. */
  fixedOnRetry: boolean;
}

export interface PronunciationSummary {
  /** Bounded free-speech cues. These are diagnosis only, never scores. */
  diagnosticTargets: CallPronunciationDiagnostic[];
  /** Reference-text phrase outcomes; free scores never enter these counts. */
  scripted: {
    graded: number;
    mastered: number;
    practiced: number;
    unavailable: number;
    averageScore?: number;
  };
}

/** Text-free pronunciation evidence safe for durable storage and sync. */
export interface PersistedPronunciationSummary {
  version: 2;
  diagnosticCueKeys: PronunciationCueKey[];
  scripted: PronunciationSummary["scripted"];
}

export interface PersistedReportCorrection {
  kind: CorrectionKind;
  fixedOnRetry: boolean;
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
   * Present when a bounded free-speech diagnosis or scripted phrase result exists.
   * Only `scripted` can contain graded evidence; diagnosis is never mastery.
   */
  pronunciation?: PronunciationSummary;
  retriedCount: number;
  retriedAcceptedCount: number;
}

export interface CallPronunciationFacts {
  diagnosed: number;
  graded: number;
  mastered: number;
  practiced: number;
  unavailable: number;
}

const boundedCount = (value: unknown, max: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(0, Math.trunc(value))) : 0;

const pronunciationCueKeys = new Set<PronunciationCueKey>(
  Object.values(LATAM_PRONUNCIATION_PRIOR).map((entry) => entry.cueKey),
);
const diagnosticSources = new Set<CallPronunciationDiagnostic["source"]>(["personal-evidence", "latam-prior", "provider"]);

/** Allowlist and bound the pronunciation evidence that may reach device/cloud storage. */
export function sanitizePersistedPronunciationSummary(value: unknown): PersistedPronunciationSummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const richCueKeys = (Array.isArray(source.diagnosticTargets) ? source.diagnosticTargets : [])
    .flatMap((candidate): PronunciationCueKey[] => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
      const item = candidate as Record<string, unknown>;
      if (
        item.assessmentKind !== "free" || item.policyVersion !== "latam-v1" || item.outcome !== "diagnostic" ||
        !pronunciationCueKeys.has(item.cueKey as PronunciationCueKey) ||
        !diagnosticSources.has(item.source as CallPronunciationDiagnostic["source"])
      ) return [];
      return [item.cueKey as PronunciationCueKey];
    });
  const safeCueKeys = Array.isArray(source.diagnosticCueKeys)
    ? source.diagnosticCueKeys.filter((key): key is PronunciationCueKey => pronunciationCueKeys.has(key as PronunciationCueKey))
    : [];
  const diagnosticCueKeys = [...new Set([...richCueKeys, ...safeCueKeys])].slice(0, 3);
  const rawScripted = source.scripted && typeof source.scripted === "object" && !Array.isArray(source.scripted)
    ? source.scripted as Record<string, unknown>
    : {};
  const graded = boundedCount(rawScripted.graded, 24);
  const mastered = Math.min(graded, boundedCount(rawScripted.mastered, 24));
  const practiced = Math.min(graded - mastered, boundedCount(rawScripted.practiced, 24));
  const unavailable = boundedCount(rawScripted.unavailable, 24);
  const rawAverage = rawScripted.averageScore;
  const averageScore = graded > 0 && typeof rawAverage === "number" && Number.isFinite(rawAverage)
    ? Math.min(100, Math.max(0, Math.round(rawAverage)))
    : undefined;
  if (diagnosticCueKeys.length === 0 && graded === 0 && unavailable === 0) return undefined;
  return {
    version: 2,
    diagnosticCueKeys,
    scripted: { graded, mastered, practiced, unavailable, ...(averageScore === undefined ? {} : { averageScore }) },
  };
}

/** Strip pronunciation down to non-sensitive, consistent counts for prose. */
export function sanitizePronunciationFacts(value: unknown): CallPronunciationFacts {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const scripted = source.scripted && typeof source.scripted === "object" && !Array.isArray(source.scripted)
    ? source.scripted as Record<string, unknown> : {};
  const graded = boundedCount(scripted.graded, 24);
  const mastered = Math.min(graded, boundedCount(scripted.mastered, 24));
  const practiced = Math.min(graded - mastered, boundedCount(scripted.practiced, 24));
  return {
    diagnosed: Array.isArray(source.diagnosticTargets) ? Math.min(3, source.diagnosticTargets.length) : boundedCount(source.diagnosed, 3),
    graded,
    mastered,
    practiced,
    unavailable: boundedCount(scripted.unavailable ?? source.unavailable, 24),
  };
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
    fixedOnRetry: turn.correction.kind === "pronunciation"
      ? turn.pronunciation?.scripted?.outcome === "mastered"
      : Boolean(turn.retry?.accepted),
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
 * Pronunciation summary, or undefined when the call produced no usable evidence.
 * Free speech contributes bounded diagnostic targets only. Only an exact
 * reference-text retry contributes graded evidence.
 */
export function summarizePronunciation(turns: LearnerTurn[]): PronunciationSummary | undefined {
  const evidence = turns.map((turn) => turn.pronunciation).filter((value): value is NonNullable<typeof value> => Boolean(value));
  if (evidence.length === 0) return undefined;
  const seen = new Set<string>();
  const diagnosticTargets = evidence.flatMap(({ diagnostic }) => {
    const key = `${diagnostic.targetWord.toLocaleLowerCase("en-US")}:${diagnostic.cueKey}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [diagnostic];
  }).slice(0, 3);
  const scripted = evidence.map((value) => value.scripted).filter((value): value is NonNullable<typeof value> => Boolean(value));
  const graded = scripted.filter((value) => value.outcome === "mastered" || value.outcome === "retry");
  const scores = graded.map((value) => value.score).filter((score): score is number => score !== undefined);
  return {
    diagnosticTargets,
    scripted: {
      graded: graded.length,
      mastered: graded.filter((value) => value.outcome === "mastered").length,
      practiced: graded.filter((value) => value.outcome === "retry").length,
      unavailable: scripted.filter((value) => value.outcome === "diagnostic" || value.outcome === "technical-skip").length,
      ...(scores.length > 0 ? { averageScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) } : {}),
    },
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
