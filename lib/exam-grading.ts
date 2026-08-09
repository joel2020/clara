// How a high-stakes open answer's grade is decided (audit P1).
//
// Two failure families used to collapse into a hard zero or a keyword bag,
// and both corrupted what an "earned level" means:
//   • The retell was scored client-side by order-independent substring
//     matching — six keywords in any ungrammatical order scored 100.
//   • A grader outage recorded 0 for the section and burned the daily
//     attempt — punishing the honest learner for our infrastructure.

import {
  gradePronunciation,
  type CefrLevel,
  type PronunciationEvidence,
  type PronunciationVerdict,
} from "./speech/pronunciation-policy.ts";
//
// The rules, executable and testable:
//   • Genuine no-speech is a bounded learner miss. Silent hardware and every
//     other capture/provider failure void the sitting without learner blame.
//   • A real transcript is graded by the CEFR-aware model, or not at all.
//     There is no mechanical fallback for unscripted speech: if the grader is
//     unreachable or returns nonsense, the sitting is VOID — nothing recorded,
//     the daily attempt is not consumed, and the learner is told plainly.
export type OpenGrade =
  | { kind: "scored"; score: number; fix: string | null }
  | { kind: "unavailable"; reason: string };

/** How many times the client re-asks the grader before voiding the sitting. */
export const GRADER_RETRIES = 1;

export type CaptureFailureDisposition =
  | { kind: "retry" }
  | { kind: "void" }
  | { kind: "learner-zero" };

/** Provider outages void; bounded no-match/no-speech remains an honest learner zero. */
export function interpretCaptureFailure(code: string | undefined): CaptureFailureDisposition {
  if (code === "consent" || code === "cancelled") return { kind: "retry" };
  if (code === "no-speech") return { kind: "learner-zero" };
  // Fail closed: permission, device, browser, network, unknown, and future
  // codes are not evidence of learner performance.
  return { kind: "void" };
}

/**
 * Interpret one /api/grade response. Anything that is not an unambiguous
 * numeric grade is "unavailable" — never a zero, never a guess.
 */
export function interpretGraderResponse(status: number, body: unknown): OpenGrade {
  if (status !== 200) return { kind: "unavailable", reason: `status ${status}` };
  if (typeof body !== "object" || body === null) return { kind: "unavailable", reason: "malformed body" };
  const score = (body as { score?: unknown }).score;
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return { kind: "unavailable", reason: "no numeric score" };
  }
  const fixRaw = (body as { fix?: unknown }).fix;
  const fix = typeof fixRaw === "string" && fixRaw.trim() ? fixRaw.trim() : null;
  return { kind: "scored", score: Math.max(0, Math.min(100, Math.round(score))), fix };
}

export const MAX_STAGE_LEARNER_MISSES = 3;

export type StageSpeakingStatus = "ready" | "retry" | "mastered" | "practice-required" | "voided";

export interface StageSpeakingState {
  status: StageSpeakingStatus;
  learnerMisses: number;
  validAcousticAttempts: number;
  lastVerdict?: PronunciationVerdict;
}

export type StageSpeakingEvent =
  | { type: "acoustic"; cefr: CefrLevel; evidence: PronunciationEvidence }
  | { type: "no-speech" }
  | { type: "consent" }
  | { type: "cancelled" }
  | { type: "technical"; code: string };

export interface StageSpeakingTransition {
  state: StageSpeakingState;
  accepted: boolean;
  disposition: "retry" | "advance" | "practice-required" | "void";
  score?: number;
}

export function initialStageSpeakingState(): StageSpeakingState {
  return { status: "ready", learnerMisses: 0, validAcousticAttempts: 0 };
}

function isTerminal(state: StageSpeakingState): boolean {
  return state.status === "mastered" || state.status === "practice-required" || state.status === "voided";
}

function boundedStageScore(evidence: PronunciationEvidence, cefr: CefrLevel): number {
  const scores = [
    evidence.pronunciationScore,
    evidence.accuracyScore,
    evidence.completenessScore,
    evidence.targetPhonemeScore,
    ...(cefr === "A0" || cefr === "A1" ? [] : [evidence.prosodyScore]),
  ];
  return Math.round(scores.reduce<number>((sum, score) => sum + (score ?? 0), 0) / scores.length);
}

/**
 * Pure stage-item state machine. Only complete normalized Azure evidence can be
 * graded. No transcript, clock, timer, random value, or persistence participates.
 */
export function transitionStageSpeaking(
  state: StageSpeakingState,
  event: StageSpeakingEvent,
): StageSpeakingTransition {
  if (isTerminal(state)) return { state, accepted: false, disposition: state.status === "voided" ? "void" : state.status === "mastered" ? "advance" : "practice-required" };
  if (event.type === "consent" || event.type === "cancelled") {
    return { state, accepted: true, disposition: "retry" };
  }
  if (event.type === "technical") {
    return { state: { ...state, status: "voided" }, accepted: true, disposition: "void" };
  }
  if (event.type === "no-speech") {
    const learnerMisses = Math.min(MAX_STAGE_LEARNER_MISSES, state.learnerMisses + 1);
    const exhausted = learnerMisses === MAX_STAGE_LEARNER_MISSES;
    return {
      state: { ...state, learnerMisses, status: exhausted ? "practice-required" : "retry" },
      accepted: true,
      disposition: exhausted ? "practice-required" : "retry",
    };
  }

  let verdict: PronunciationVerdict;
  try {
    verdict = gradePronunciation({ context: "stage", cefr: event.cefr, evidence: event.evidence });
  } catch {
    return { state: { ...state, status: "voided" }, accepted: true, disposition: "void" };
  }
  if (verdict.outcome === "technical-skip" || verdict.outcome === "diagnostic") {
    return { state: { ...state, status: "voided", lastVerdict: verdict }, accepted: true, disposition: "void" };
  }
  const validAcousticAttempts = state.validAcousticAttempts + 1;
  if (verdict.outcome === "mastered") {
    return {
      state: { ...state, status: "mastered", validAcousticAttempts, lastVerdict: verdict },
      accepted: true,
      disposition: "advance",
      score: boundedStageScore(event.evidence, event.cefr),
    };
  }
  const learnerMisses = Math.min(MAX_STAGE_LEARNER_MISSES, state.learnerMisses + 1);
  const exhausted = learnerMisses === MAX_STAGE_LEARNER_MISSES;
  return {
    state: { status: exhausted ? "practice-required" : "retry", learnerMisses, validAcousticAttempts, lastVerdict: verdict },
    accepted: true,
    disposition: exhausted ? "practice-required" : "retry",
  };
}

/**
 * Which machinery produced a section's scores — stored with the sitting so a
 * disputed result can be audited (acoustic policy, LLM, or mechanical).
 */
export type GradePath = "llm" | "azure" | "mechanical";

/** Fold per-item paths into one label per section for storage. */
export function foldGradePaths(paths: Record<string, GradePath[]>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(paths).map(([k, list]) => [k, [...new Set(list)].join("+") || "none"]),
  );
}
