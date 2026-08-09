import type { PronunciationVerdict } from "./pronunciation-policy.ts";
import { PASS_XP, roundRewardXp, starRating } from "../gamification.ts";

export interface PronunciationSessionState {
  validAttempts: number;
  firstValidScore?: number;
  status: "active" | "mastered" | "practiced-not-mastered" | "technical-skip";
}

export type PronunciationSessionEvent =
  | { type: "valid-verdict"; verdict: PronunciationVerdict; score?: number; combo?: number }
  | { type: "technical-failure"; reason: string }
  | { type: "skip-after-outage" };

export interface PronunciationSessionTransition {
  state: PronunciationSessionState;
  coachingStage: 1 | 2 | 3;
  rewardMultiplier: 0 | 0.25 | 1;
  xpAward: number;
  masteryStars: number;
  combo: number;
  srsPass: boolean;
  dueDayOffset?: 1;
  canContinue: boolean;
}

export const INITIAL_PRONUNCIATION_SESSION_STATE: PronunciationSessionState = Object.freeze({
  validAttempts: 0,
  status: "active",
});

const STATUSES = new Set<PronunciationSessionState["status"]>([
  "active",
  "mastered",
  "practiced-not-mastered",
  "technical-skip",
]);
const OUTCOMES = new Set<PronunciationVerdict["outcome"]>([
  "mastered",
  "retry",
  "diagnostic",
  "technical-skip",
]);
const MAX_VERDICT_REASONS = 16;
const MAX_VERDICT_REASON_LENGTH = 96;
const VERDICT_REASON_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertScore(score: number | undefined, required: boolean): void {
  if (score === undefined) {
    if (required) throw new TypeError("A graded pronunciation verdict requires a score");
    return;
  }
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError("Pronunciation score must be finite and between 0 and 100");
  }
}

function assertState(state: PronunciationSessionState): void {
  if (
    !state ||
    !Number.isInteger(state.validAttempts) ||
    state.validAttempts < 0 ||
    state.validAttempts > 3 ||
    !STATUSES.has(state.status)
  ) {
    throw new TypeError("Invalid pronunciation session state");
  }
  assertScore(state.firstValidScore, false);
  if ((state.validAttempts === 0) !== (state.firstValidScore === undefined)) {
    throw new TypeError("First valid score must match valid attempt evidence");
  }
  if (state.status === "active" && state.validAttempts >= 3) {
    throw new TypeError("An active pronunciation session cannot have three attempts");
  }
  if (state.status === "mastered" && state.validAttempts < 1) {
    throw new TypeError("A mastered session requires a valid attempt");
  }
  if (state.status === "practiced-not-mastered" && state.validAttempts !== 3) {
    throw new TypeError("A practiced-not-mastered session requires three valid attempts");
  }
  if (state.status === "technical-skip" && state.validAttempts >= 3) {
    throw new TypeError("A technical skip must occur before attempt exhaustion");
  }
}

export function isPronunciationSessionState(value: unknown): value is PronunciationSessionState {
  try {
    assertState(value as PronunciationSessionState);
    return true;
  } catch {
    return false;
  }
}

function hasValidVerdictReasons(reasons: unknown): reasons is string[] {
  if (!Array.isArray(reasons) || reasons.length > MAX_VERDICT_REASONS) return false;
  for (let index = 0; index < reasons.length; index += 1) {
    if (!Object.hasOwn(reasons, index)) return false;
    const reason = reasons[index];
    if (
      typeof reason !== "string" ||
      reason.length === 0 ||
      reason.length > MAX_VERDICT_REASON_LENGTH ||
      !VERDICT_REASON_PATTERN.test(reason)
    ) {
      return false;
    }
  }
  return true;
}

function assertEvent(event: PronunciationSessionEvent): void {
  if (!event || typeof event !== "object") throw new TypeError("Invalid pronunciation event");
  if (event.type === "technical-failure") {
    if (typeof event.reason !== "string" || event.reason.trim().length === 0) {
      throw new TypeError("A technical failure requires a reason");
    }
    return;
  }
  if (event.type === "skip-after-outage") return;
  if (event.type !== "valid-verdict") throw new TypeError("Unknown pronunciation event");
  if (
    !event.verdict ||
    event.verdict.policyVersion !== "latam-v1" ||
    !OUTCOMES.has(event.verdict.outcome) ||
    !hasValidVerdictReasons(event.verdict.reasons)
  ) {
    throw new TypeError("Invalid pronunciation verdict");
  }
  const graded = event.verdict.outcome === "mastered" || event.verdict.outcome === "retry";
  assertScore(event.score, graded);
  if (event.combo !== undefined && (!Number.isSafeInteger(event.combo) || event.combo < 0)) {
    throw new TypeError("Pronunciation combo must be a non-negative integer");
  }
}

function coachingStage(state: PronunciationSessionState): 1 | 2 | 3 {
  if (state.status === "active") return Math.min(state.validAttempts + 1, 3) as 1 | 2 | 3;
  return Math.max(1, Math.min(state.validAttempts, 3)) as 1 | 2 | 3;
}

function noRewardTransition(
  state: PronunciationSessionState,
  canContinue = state.status !== "active",
): PronunciationSessionTransition {
  return {
    state: { ...state },
    coachingStage: coachingStage(state),
    rewardMultiplier: 0,
    xpAward: 0,
    masteryStars: 0,
    combo: 0,
    srsPass: false,
    ...(state.status === "practiced-not-mastered" ? { dueDayOffset: 1 as const } : {}),
    canContinue,
  };
}

export function transitionPronunciationSession(
  state: PronunciationSessionState,
  event: PronunciationSessionEvent,
): PronunciationSessionTransition {
  assertState(state);
  assertEvent(event);

  // A persisted terminal state is the idempotency boundary. Replayed UI or
  // sync events can re-render it, but cannot award XP, stars, combo, or SRS.
  if (state.status !== "active") return noRewardTransition(state, true);

  if (event.type === "technical-failure") return noRewardTransition(state, false);
  if (event.type === "skip-after-outage") {
    return noRewardTransition({ ...state, status: "technical-skip" }, true);
  }
  if (
    event.verdict.outcome === "diagnostic" ||
    event.verdict.outcome === "technical-skip"
  ) {
    return noRewardTransition(state, false);
  }

  const score = event.score as number;
  const validAttempts = state.validAttempts + 1;
  const firstValidScore = state.firstValidScore ?? score;
  if (event.verdict.outcome === "mastered") {
    const masteredState: PronunciationSessionState = {
      validAttempts,
      firstValidScore,
      status: "mastered",
    };
    return {
      state: masteredState,
      coachingStage: coachingStage(masteredState),
      rewardMultiplier: 1,
      xpAward: roundRewardXp(PASS_XP, 1),
      masteryStars: starRating(true, score),
      combo: event.combo ?? 1,
      srsPass: true,
      canContinue: true,
    };
  }

  if (validAttempts < 3) {
    return noRewardTransition(
      { validAttempts, firstValidScore, status: "active" },
      false,
    );
  }

  const practicedState: PronunciationSessionState = {
    validAttempts: 3,
    firstValidScore,
    status: "practiced-not-mastered",
  };
  return {
    state: practicedState,
    coachingStage: 3,
    rewardMultiplier: 0.25,
    xpAward: roundRewardXp(PASS_XP, 0.25),
    masteryStars: 0,
    combo: 0,
    srsPass: false,
    dueDayOffset: 1,
    canContinue: true,
  };
}
