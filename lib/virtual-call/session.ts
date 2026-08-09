// The Virtual Call state machine and correction policy.
//
// Pure and plain-node testable on purpose: what the learner experiences on a
// call — when the guide interrupts, when a retry is demanded, when the call ends —
// is decided here, not inside a React component or a model prompt. The model
// proposes an analysis; this module decides what actually happens with it.
//
// The two modes are genuinely different products, not a severity slider:
//   natural  — the conversation is the point. Corrections are collected and
//              shown discreetly, and surface properly in the end report.
//              The guide only interrupts when meaning did not get through.
//   practice — a correction that matters stops the call: the guide explains it in
//              one line and asks for the sentence again, then verifies.

import type { Level } from "../placement.ts";
import { isAssessmentResult, type AssessmentResult } from "../speech/azure-response.ts";
import { diagnosePronunciationTarget } from "../speech/pronunciation-diagnosis.ts";
import type { PronunciationCueKey } from "../speech/latam-prior.ts";
import { gradePronunciation, type CefrLevel, type PronunciationVerdict } from "../speech/pronunciation-policy.ts";

export type CorrectionMode = "natural" | "practice";

/** Where a turn sits in the call. Drives the UI state and what input is allowed. */
export type CallPhase =
  | "idle"
  | "connecting"
  | "guide-speaking"
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
  /** One acoustic cue selected from this turn's free-speech evidence. */
  pronunciation?: CallPronunciationDiagnostic;
}

export type CorrectionKind = "grammar" | "vocabulary" | "phrasing" | "pronunciation";

/** What the model returned for one learner turn, after server-side validation. */
export interface TurnAnalysis {
  /** The guide's spoken reply. */
  reply: string;
  /** Spanish rendering of the reply, so she can always follow. */
  replyEs: string;
  /** The single correction worth making, or null when the turn was fine. */
  correction: TurnCorrection | null;
  /** True when the guide genuinely could not tell what she meant. */
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
   * Present whenever the audio was actually scored by the speech service —
   * which is every turn when Azure is configured, since it grades unscripted
   * speech as well as a known sentence. Still never INFERRED from a transcript:
   * absent means nothing was measured, not that it was fine.
   */
  pronunciation?: PronunciationEvidence;
}

export interface PronunciationEvidence {
  /** Free speech can identify a practice target, but can never be mastery. */
  diagnostic: CallPronunciationDiagnostic;
  /** Present only after a reference-text phrase capture. */
  scripted?: ScriptedCallPronunciation;
}

export interface CallPronunciationDiagnostic {
  assessmentKind: "free";
  policyVersion: "latam-v1";
  outcome: "diagnostic";
  targetWord: string;
  targetSound: string;
  cueKey: PronunciationCueKey;
  referenceSentence: string;
  source: "personal-evidence" | "latam-prior" | "provider";
}

export interface ScriptedCallPronunciation {
  assessmentKind: "phrase";
  policyVersion: "latam-v1";
  outcome: PronunciationVerdict["outcome"];
  targetWord: string;
  referenceSentence: string;
  /** Included only for acoustically graded mastery/retry evidence. */
  score?: number;
  reasons: string[];
}

export interface RetryOutcome {
  transcript: string;
  accepted: boolean;
  /** Unavailable means provider failure supplied no transcript judgment. */
  transcriptStatus?: "unavailable";
  /** Word-level similarity against the corrected sentence, 0..1. */
  similarity: number;
  at: number;
  /** Acoustic verdict from the separate reference-text assessment. */
  pronunciationOutcome?: PronunciationVerdict["outcome"];
  pronunciationPolicyVersion?: "latam-v1";
}

export interface CallState {
  scenarioId: string;
  mode: CorrectionMode;
  level: Level;
  phase: CallPhase;
  startedAt: number;
  endedAt: number | null;
  turns: LearnerTurn[];
  /** Set in practice mode while the guide waits for the sentence again. */
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
export const MAX_CALL_REFERENCE_CHARS = 200;

function boundedSentence(value: string, targetWord: string): string | null {
  const candidates = value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/);
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const word = new RegExp(`(^|[^A-Za-z])${escaped}(?=$|[^A-Za-z])`, "i");
  return candidates.find((candidate) => candidate.length > 0 && candidate.length <= MAX_CALL_REFERENCE_CHARS && word.test(candidate)) ?? null;
}

/** Build one bounded free-speech cue; never returns a score or mastery. */
export function diagnoseFreeCallPronunciation(input: {
  evidence: unknown;
  sentence: string;
  canonicalCorrection?: string;
  cefr: CefrLevel;
}): CallPronunciationDiagnostic | null {
  if (!isAssessmentResult(input.evidence)) return null;
  const verdict = gradePronunciation({ context: "free", cefr: input.cefr, evidence: input.evidence });
  if (verdict.outcome !== "diagnostic" || input.evidence.providerStatus !== "valid" || input.evidence.recognitionReason !== undefined) return null;
  const diagnosis = diagnosePronunciationTarget({ evidence: input.evidence, personalWeaknesses: [] });
  if (!diagnosis) return null;
  const referenceSentence = (input.canonicalCorrection ? boundedSentence(input.canonicalCorrection, diagnosis.word) : null)
    ?? boundedSentence(input.sentence, diagnosis.word);
  if (!referenceSentence) return null;
  return {
    assessmentKind: "free",
    policyVersion: verdict.policyVersion,
    outcome: "diagnostic",
    targetWord: diagnosis.word,
    targetSound: diagnosis.target,
    cueKey: diagnosis.cueKey,
    referenceSentence,
    source: diagnosis.source,
  };
}

/** Apply the shared strict phrase policy to a known reference-text retry. */
export function gradeScriptedCallPronunciation(input: {
  evidence: unknown;
  referenceSentence: string;
  targetWord: string;
  cefr: CefrLevel;
}): ScriptedCallPronunciation {
  const evidence = isAssessmentResult(input.evidence) ? input.evidence : null;
  const verdict = evidence
    ? gradePronunciation({ context: "daily-phrase", cefr: input.cefr, evidence })
    : { policyVersion: "latam-v1" as const, outcome: "technical-skip" as const, reasons: ["invalid-provider-evidence"] };
  return {
    assessmentKind: "phrase",
    policyVersion: verdict.policyVersion,
    outcome: verdict.outcome,
    targetWord: input.targetWord.slice(0, 80),
    referenceSentence: input.referenceSentence.slice(0, MAX_CALL_REFERENCE_CHARS),
    ...((verdict.outcome === "mastered" || verdict.outcome === "retry") && evidence?.pronunciationScore !== undefined
      ? { score: Math.round(evidence.pronunciationScore) }
      : {}),
    reasons: verdict.reasons.slice(0, 8).map((reason) => reason.slice(0, 80)),
  };
}

/** Entering mute stops a capture; leaving mute must not discard a new reply. */
export function shouldCancelCaptureOnMute(wasMuted: boolean): boolean {
  return !wasMuted;
}

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
    phase: "guide-speaking",
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

/**
 * Is this correction shown inline during the call?
 *
 * Both modes use the same visibility rule — a `minor` note never interrupts the
 * conversation visually — because what differs between them is whether the call
 * STOPS (see shouldInterrupt), not whether the note is legible. An earlier
 * version branched on mode with identical arms, which read as an intended
 * difference that did not exist.
 */
export function shouldShowInline(correction: TurnCorrection | null): boolean {
  if (!correction) return false;
  return correction.severity !== "none" && correction.severity !== "minor";
}

/**
 * Normalize for comparison: case and punctuation.
 *
 * Typographic apostrophes are folded to a straight one FIRST, and that step is
 * load-bearing rather than cosmetic. Models and speech synthesis emit "friend’s"
 * (U+2019) while speech transcripts emit "friend's", so without this a learner
 * who repeats the corrected sentence perfectly has it split into "friend s" and
 * scored as a miss. Found in browser testing, where a correct retry was rejected.
 */
export function normalizeUtterance(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ´`]/g, "'")
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

export function retryReferenceSentence(correction: TurnCorrection): string {
  return correction.pronunciation?.referenceSentence ?? correction.corrected;
}

/** Apply one analyzed learner turn, returning the next state. Pure. */
export function applyTurn(
  state: CallState,
  input: { transcript: string; analysis: TurnAnalysis; at: number; pronunciation?: PronunciationEvidence },
): CallState {
  const correction = input.analysis.correction;
  const interrupt = shouldInterrupt(state.mode, correction, input.analysis.needsClarification);
  const turn: LearnerTurn = {
    index: state.turns.length,
    transcript: input.transcript,
    at: input.at,
    correction,
    ...(input.pronunciation ? { pronunciation: input.pronunciation } : {}),
  };
  const turns = [...state.turns, turn];
  const pending = interrupt && correction ? correction : null;
  return {
    ...state,
    turns,
    pendingRetry: pending,
    pendingRetryTurn: pending ? turn.index : null,
    phase: pending ? "awaiting-retry" : "guide-speaking",
  };
}

/** Record a retry attempt against the pending correction. Pure. */
export function applyRetry(
  state: CallState,
  input: { transcript: string; at: number; pronunciation?: PronunciationEvidence; transcriptStatus?: "unavailable" },
): CallState {
  if (!state.pendingRetry || state.pendingRetryTurn === null) return state;
  const similarityOutcome = evaluateRetry(input.transcript, retryReferenceSentence(state.pendingRetry), input.at);
  const scripted = input.pronunciation?.scripted;
  const outcome: RetryOutcome = {
    ...similarityOutcome,
    ...(input.transcriptStatus ? { transcriptStatus: input.transcriptStatus } : {}),
    ...(scripted ? { pronunciationOutcome: scripted.outcome, pronunciationPolicyVersion: scripted.policyVersion } : {}),
  };
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
    phase: "guide-speaking",
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
