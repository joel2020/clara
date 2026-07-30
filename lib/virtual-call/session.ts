// The Virtual Call state machine and correction policy.
//
// Pure and plain-node testable on purpose: what the learner experiences on a
// call — when Clara interrupts, when a retry is demanded, when the call ends —
// is decided here, not inside a React component or a model prompt. The model
// proposes an analysis; this module decides what actually happens with it.
//
// The two modes are genuinely different products, not a severity slider:
//   natural  — the conversation is the point. Corrections are collected and
//              shown discreetly, and surface properly in the end report.
//              Clara only interrupts when meaning did not get through.
//   practice — a correction that matters stops the call: Clara explains it in
//              one line and asks for the sentence again, then verifies.

import type { Level } from "../placement.ts";

export type CorrectionMode = "natural" | "practice";

/** Where a turn sits in the call. Drives the UI state and what input is allowed. */
export type CallPhase =
  | "idle"
  | "connecting"
  | "clara-speaking"
  | "listening"
  | "processing"
  | "awaiting-retry"
  | "ended";

/** How serious a mistake is. Only "blocking" ever interrupts a natural call. */
export type MistakeSeverity = "none" | "minor" | "significant" | "blocking";

export interface TurnCorrection {
  /** The learner's sentence as transcribed. */
  original: string;
  /** The same sentence, fixed. This is what a retry is checked against. */
  corrected: string;
  /** One short explanation, in her coach language. */
  explanation: string;
  severity: MistakeSeverity;
  /** "grammar" | "vocabulary" | "phrasing" — used to group the report. */
  kind: CorrectionKind;
}

export type CorrectionKind = "grammar" | "vocabulary" | "phrasing";

/** What the model returned for one learner turn, after server-side validation. */
export interface TurnAnalysis {
  /** Clara's spoken reply. */
  reply: string;
  /** Spanish rendering of the reply, so she can always follow. */
  replyEs: string;
  /** The single correction worth making, or null when the turn was fine. */
  correction: TurnCorrection | null;
  /** True when Clara genuinely could not tell what she meant. */
  needsClarification: boolean;
  /** Short phrases she could say next. */
  suggestions: string[];
  /** Did this turn satisfy the scenario's completion criteria? */
  metCriteria: boolean;
}

export interface LearnerTurn {
  index: number;
  transcript: string;
  at: number;
  correction: TurnCorrection | null;
  /** Set when this turn's correction was retried. */
  retry?: RetryOutcome;
  /**
   * Pronunciation is only ever present when the utterance had a KNOWN target
   * (a retry), because that is the only case the speech service can score
   * against. Never inferred from a free-speech transcript.
   */
  pronunciation?: PronunciationEvidence;
}

export interface PronunciationEvidence {
  /** 0-100 from the assessment service. */
  score: number;
  /** The sentence that was scored — the evidence this number refers to. */
  target: string;
  worstWord?: string;
}

export interface RetryOutcome {
  transcript: string;
  accepted: boolean;
  /** Word-level similarity against the corrected sentence, 0..1. */
  similarity: number;
  at: number;
}

export interface CallState {
  scenarioId: string;
  mode: CorrectionMode;
  level: Level;
  phase: CallPhase;
  startedAt: number;
  endedAt: number | null;
  turns: LearnerTurn[];
  /** Set in practice mode while Clara waits for the sentence again. */
  pendingRetry: TurnCorrection | null;
  /** Turn index the pending retry belongs to. */
  pendingRetryTurn: number | null;
  targetTurns: number;
}

/**
 * Hard ceilings. These are cost controls as much as UX: every learner turn is a
 * transcription plus a model call plus a speech synthesis, so an unbounded call
 * is an unbounded bill. The UI shows the remaining time rather than cutting out.
 */
export const MAX_CALL_MS = 10 * 60 * 1000;
export const MAX_RECORDING_MS = 30 * 1000;
export const MAX_TURNS = 24;
/** How many prior turns are sent to the model. Keeps token cost flat per call. */
export const CONTEXT_WINDOW_TURNS = 8;
/** A retry is accepted at or above this word-level similarity. */
export const RETRY_ACCEPT_SIMILARITY = 0.8;

export function createCallState(input: {
  scenarioId: string;
  mode: CorrectionMode;
  level: Level;
  startedAt: number;
  targetTurns: number;
}): CallState {
  return {
    scenarioId: input.scenarioId,
    mode: input.mode,
    level: input.level,
    phase: "clara-speaking",
    startedAt: input.startedAt,
    endedAt: null,
    turns: [],
    pendingRetry: null,
    pendingRetryTurn: null,
    targetTurns: input.targetTurns,
  };
}

/**
 * Should this correction stop the call and demand the sentence again?
 *
 * Practice mode pauses on anything that actually matters, but deliberately not
 * on "minor" — stopping a learner to fix a harmless article is how a practice
 * call turns into a grammar drill she avoids. Natural mode only ever pauses
 * when meaning did not survive, which is a comprehension problem rather than a
 * correction.
 */
export function shouldInterrupt(
  mode: CorrectionMode,
  correction: TurnCorrection | null,
  needsClarification: boolean,
): boolean {
  if (needsClarification) return true;
  if (!correction) return false;
  if (correction.severity === "blocking") return true;
  return mode === "practice" && correction.severity === "significant";
}

/** Corrections shown inline during the call, per mode. */
export function shouldShowInline(mode: CorrectionMode, correction: TurnCorrection | null): boolean {
  if (!correction) return false;
  if (correction.severity === "none") return false;
  // Natural mode keeps them discreet but visible; the report is where they land.
  return mode === "practice" ? correction.severity !== "minor" : correction.severity !== "minor";
}

/** Normalize for comparison: case, punctuation, and filler contractions. */
export function normalizeUtterance(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Word-level similarity, 0..1 — how close the retry was to the target sentence.
 * Uses token edit distance rather than characters so a single wrong word in a
 * short sentence does not read as a near-miss.
 */
export function utteranceSimilarity(said: string, target: string): number {
  const a = normalizeUtterance(said).split(" ").filter(Boolean);
  const b = normalizeUtterance(target).split(" ").filter(Boolean);
  // No target to check against — that is our data being wrong, not her speech.
  // Scoring it as a miss would fail a learner who said nothing wrong.
  if (b.length === 0) return 1;
  if (a.length === 0) return 0;
  // Levenshtein over word arrays.
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  const distance = prev[b.length];
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

export function evaluateRetry(said: string, target: string, at: number): RetryOutcome {
  const similarity = utteranceSimilarity(said, target);
  return { transcript: said, accepted: similarity >= RETRY_ACCEPT_SIMILARITY, similarity, at };
}

/** Apply one analyzed learner turn, returning the next state. Pure. */
export function applyTurn(
  state: CallState,
  input: { transcript: string; analysis: TurnAnalysis; at: number },
): CallState {
  const correction = input.analysis.correction;
  const interrupt = shouldInterrupt(state.mode, correction, input.analysis.needsClarification);
  const turn: LearnerTurn = {
    index: state.turns.length,
    transcript: input.transcript,
    at: input.at,
    correction,
  };
  const turns = [...state.turns, turn];
  const pending = interrupt && correction ? correction : null;
  return {
    ...state,
    turns,
    pendingRetry: pending,
    pendingRetryTurn: pending ? turn.index : null,
    phase: pending ? "awaiting-retry" : "clara-speaking",
  };
}

/** Record a retry attempt against the pending correction. Pure. */
export function applyRetry(
  state: CallState,
  input: { transcript: string; at: number; pronunciation?: PronunciationEvidence },
): CallState {
  if (!state.pendingRetry || state.pendingRetryTurn === null) return state;
  const outcome = evaluateRetry(input.transcript, state.pendingRetry.corrected, input.at);
  const turns = state.turns.map((t) =>
    t.index === state.pendingRetryTurn
      ? { ...t, retry: outcome, ...(input.pronunciation ? { pronunciation: input.pronunciation } : {}) }
      : t,
  );
  // One retry only. Demanding it twice turns encouragement into a wall, and the
  // correction is already recorded for the report either way.
  return {
    ...state,
    turns,
    pendingRetry: null,
    pendingRetryTurn: null,
    phase: "clara-speaking",
  };
}

export function endCall(state: CallState, at: number): CallState {
  return { ...state, phase: "ended", endedAt: at, pendingRetry: null, pendingRetryTurn: null };
}

/** Elapsed call time, clamped so a clock jump cannot show a negative duration. */
export function callDurationMs(state: CallState, now: number): number {
  const end = state.endedAt ?? now;
  return Math.max(0, end - state.startedAt);
}

export function callTimeRemainingMs(state: CallState, now: number): number {
  return Math.max(0, MAX_CALL_MS - callDurationMs(state, now));
}

/** Has the call hit a hard stop? Duration or turn ceiling. */
export function mustEnd(state: CallState, now: number): boolean {
  return callTimeRemainingMs(state, now) <= 0 || state.turns.length >= MAX_TURNS;
}

/** Enough turns to be worth a report, per the scenario's own target. */
export function reachedTarget(state: CallState): boolean {
  return state.turns.length >= state.targetTurns;
}

/**
 * The turns sent to the model. Windowed rather than unbounded so cost per turn
 * stays flat over a long call; older turns are summarized by the caller.
 */
export function contextTurns(state: CallState): LearnerTurn[] {
  return state.turns.slice(-CONTEXT_WINDOW_TURNS);
}
