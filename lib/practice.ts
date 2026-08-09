import { repo } from "@/lib/db";
import type { Attempt, PracticeItem } from "@/lib/db/types";
import { isGradedScoreResult, scoreAttempt, type ScoreResult } from "@/lib/speech/scoring";
import { diagnose, diagnoseAssessment, type Diagnosis } from "@/lib/speech/diagnose";
import type { Assessment } from "@/lib/speech/azure";
import { partnerOf } from "@/lib/content/lessons";
import type { AttemptRewards } from "@/lib/gamification";
import { flushOutbox } from "@/lib/sync/outbox";
import type { PronunciationDiagnosis } from "@/lib/speech/pronunciation-diagnosis";
import type { PronunciationVerdict } from "@/lib/speech/pronunciation-policy";
import type { PronunciationSessionTransition } from "@/lib/speech/pronunciation-session";
import { StalePracticeBindingError, type PracticeAttemptMutation, type PracticePersistenceBinding } from "@/lib/db/repository";
import type { DailySession } from "@/lib/daily-session";

// One place that knows how an attempt becomes saved state: score it, append to
// history, advance the item's spaced-repetition box, and award XP / streak /
// achievements. Returns both the score and the game rewards so the UI can react.

export interface PracticeOutcome {
  score: ScoreResult;
  /** False means no learner record, progress, reward, quest, or sync mutation occurred. */
  recorded: boolean;
  rewards: AttemptRewards;
  /** Which word went wrong and which sound to fix — the pinpoint feedback. */
  diagnosis: Diagnosis;
  /** Acoustic sub-scores (pronunciation/fluency), when Azure assessed the attempt. */
  assessment?: Assessment;
  /** The captured-account daily row produced by the same transaction. */
  dailySession?: DailySession;
}

export interface PronunciationPracticeCommit {
  verdict: PronunciationVerdict;
  diagnosis: PronunciationDiagnosis | null;
  transition: PronunciationSessionTransition;
}

const SAFE_NO_REWARDS: AttemptRewards = {
  xpGain: 0,
  newXp: 0,
  leveledUp: false,
  oldLevel: 0,
  newLevel: 0,
  combo: 0,
  starsEarned: 0,
  starTotal: 0,
  streakIncreased: false,
  currentStreak: 0,
  freezeUsed: false,
  freezeEarned: false,
  dailyGoalMet: false,
  unlocked: [],
};

export interface PracticeAttemptArgs {
  item: PracticeItem;
  lessonId: string;
  transcript: string;
  alternatives: string[];
  /** Consecutive passes this session including this attempt (0 if this failed). */
  combo: number;
  itemPool?: PracticeItem[];
  /** Phoneme-level acoustic scores, when the recording went through Azure. */
  assessment?: Assessment;
  /** Strict coach metadata. When present, its state transition owns reward/SRS boundaries. */
  pronunciation?: PronunciationPracticeCommit;
  /** Stable identity generated before capture evidence crosses the save boundary. */
  clientAttemptId?: string;
  /** Concrete account scope captured synchronously when microphone capture starts. */
  persistenceBinding: PracticePersistenceBinding;
  dailyPronunciation?: {
    day: string;
    activityId: string;
    contentHash: string;
    targetIndex: 0 | 1 | 2;
  };
}

interface PreparedPracticeAttempt {
  binding: PracticePersistenceBinding;
  mutation: PracticeAttemptMutation;
  score: ScoreResult;
  diagnosis: Diagnosis;
  assessment?: Assessment;
}

const preparedByRequest = new WeakMap<PracticeAttemptArgs, PreparedPracticeAttempt>();

async function commitPrepared(prepared: PreparedPracticeAttempt): Promise<PracticeOutcome> {
  const commit = await repo.commitPracticeAttempt(prepared.binding, prepared.mutation);
  if (commit.status === "already-committed") {
    if (commit.outboxIds.length > 0) void flushOutbox();
    return {
      score: prepared.score,
      recorded: false,
      rewards: { ...SAFE_NO_REWARDS, unlocked: [] },
      diagnosis: prepared.diagnosis,
      assessment: prepared.assessment,
      dailySession: commit.dailySession,
    };
  }
  void flushOutbox();
  return {
    score: prepared.score,
    recorded: true,
    rewards: commit.rewards,
    diagnosis: prepared.diagnosis,
    assessment: prepared.assessment,
    dailySession: commit.dailySession,
  };
}

export async function recordPracticeAttempt(args: PracticeAttemptArgs): Promise<PracticeOutcome> {
  const cached = preparedByRequest.get(args);
  if (cached) return commitPrepared(cached);
  const requestedBinding = args.persistenceBinding;
  if (!requestedBinding) throw new StalePracticeBindingError();
  const { item, lessonId, transcript, alternatives, combo, itemPool, assessment, pronunciation } = args;
  const partner = partnerOf(item, itemPool);

  const scored = scoreAttempt({
    target: item.text,
    transcript,
    alternatives,
    kind: item.kind,
    partnerText: partner?.text,
    assessment,
  });
  // The shared coach already ran the versioned policy with the caller's CEFR
  // context. Never let this legacy adapter's A0 compatibility path replace it.
  const result: ScoreResult = pronunciation
    ? {
        ...scored,
        passed: pronunciation.verdict.outcome === "mastered",
        gradingOutcome: pronunciation.verdict.outcome,
        feedbackKey: pronunciation.verdict.outcome === "mastered"
          ? "pass"
          : pronunciation.verdict.outcome === "retry"
            ? "close"
            : pronunciation.verdict.outcome === "diagnostic"
              ? "diagnostic"
              : "technical",
      }
    : scored;

  // Diagnostic, technical, and transcript-only evidence is useful coaching,
  // but it is not a learner result. Return before the first persistence,
  // progress, reward, quest, or sync boundary.
  if (!isGradedScoreResult(result)) {
    const diagnosis = assessment
      ? diagnoseAssessment(assessment.words, item.text)
      : diagnose(item.text, result.heard);
    return {
      score: result,
      recorded: false,
      rewards: { ...SAFE_NO_REWARDS, unlocked: [] },
      diagnosis,
      assessment,
    };
  }

  const now = Date.now();

  const attempt: Attempt = {
    clientAttemptId: args.clientAttemptId ?? globalThis.crypto.randomUUID(),
    itemId: item.id,
    lessonId,
    categoryId: item.categoryId,
    phoneme: item.phoneme,
    target: item.text,
    heard: result.heard,
    score: result.score,
    passed: result.passed,
    heardPartner: result.heardPartner,
    // Only present on the Azure path; left undefined rather than 0 so readiness can
    // tell "not measured" from "measured badly".
    fluency: assessment?.fluencyScore,
    ...(pronunciation ? {
      policyVersion: pronunciation.verdict.policyVersion,
      providerStatus: assessment?.providerStatus,
      pronunciationScore: assessment?.pronunciationScore,
      accuracyScore: assessment?.accuracyScore,
      completenessScore: assessment?.completenessScore,
      prosodyScore: assessment?.prosodyScore,
      targetPhonemeScore: assessment?.targetPhonemeScore,
      weakestPhoneme: pronunciation.diagnosis?.cueKey.replace("pronunciation.cue.es.", ""),
      weakestWord: pronunciation.diagnosis ? item.text : undefined,
      attemptOrdinal: pronunciation.transition.state.validAttempts as 1 | 2 | 3,
      pronunciationOutcome: pronunciation.transition.state.status === "mastered"
        ? "mastered" as const
        : pronunciation.transition.state.status === "practiced-not-mastered"
          ? "practiced-not-mastered" as const
          : undefined,
    } : {}),
    at: now,
  };
  const terminalPronunciation = pronunciation?.transition.state.status === "mastered"
    || pronunciation?.transition.state.status === "practiced-not-mastered";
  const shouldWriteProgress = pronunciation ? terminalPronunciation : true;
  const shouldWritePlayer = !pronunciation || terminalPronunciation;

  const diagnosis = result.passed
    ? { misses: [], sound: null }
    : assessment
      ? diagnoseAssessment(assessment.words, item.text)
      : diagnose(item.text, result.heard);

  // Attempt, SRS, and player reward are one durable unit. The UUID makes a
  // retry safe even if the caller could not observe whether IndexedDB committed.
  const mutation: PracticeAttemptMutation = {
    attempt,
    ...(args.dailyPronunciation && pronunciation ? {
      dailyPronunciation: {
        ...args.dailyPronunciation,
        event: {
          id: attempt.clientAttemptId!,
          targetIndex: args.dailyPronunciation.targetIndex,
          outcome: pronunciation.verdict.outcome as "mastered" | "retry",
          score: result.score,
          ordinal: pronunciation.transition.state.validAttempts as 1 | 2 | 3,
          at: now,
        },
        at: now,
      },
    } : {}),
    ...(shouldWriteProgress ? {
      progress: {
        passed: result.passed,
        score: result.score,
        ...(pronunciation?.transition.state.status === "practiced-not-mastered"
          ? { dueInMs: 86_400_000 }
          : {}),
      },
    } : {}),
    ...(shouldWritePlayer ? {
      reward: {
        passed: pronunciation ? pronunciation.transition.srsPass : result.passed,
        combo: pronunciation ? pronunciation.transition.combo : result.passed ? combo : 0,
        score: result.score,
        ...(pronunciation ? {
          xpAward: pronunciation.transition.xpAward,
          masteryStars: pronunciation.transition.masteryStars,
        } : {}),
      },
    } : {}),
    quest: !pronunciation || terminalPronunciation,
  };
  const prepared = { binding: requestedBinding, mutation, score: result, diagnosis, assessment };
  preparedByRequest.set(args, prepared);
  return commitPrepared(prepared);
}
