import { repo } from "@/lib/db";
import type { Attempt, ItemProgress, PracticeItem } from "@/lib/db/types";
import { applyResult, freshProgress } from "@/lib/srs";
import { scoreAttempt, type ScoreResult } from "@/lib/speech/scoring";
import { diagnose, diagnoseAssessment, type Diagnosis } from "@/lib/speech/diagnose";
import type { Assessment } from "@/lib/speech/azure";
import { partnerOf } from "@/lib/content/lessons";
import { applyAttempt, type AttemptRewards } from "@/lib/gamification";
import { recordQuestEvent } from "@/lib/quests";
import { recentPassRate, adaptiveEase } from "@/lib/adaptive";
import { pushAttempt, pushProgress, pushPlayer } from "@/lib/sync/supabase-sync";

// One place that knows how an attempt becomes saved state: score it, append to
// history, advance the item's spaced-repetition box, and award XP / streak /
// achievements. Returns both the score and the game rewards so the UI can react.

export interface PracticeOutcome {
  score: ScoreResult;
  rewards: AttemptRewards;
  /** Which word went wrong and which sound to fix — the pinpoint feedback. */
  diagnosis: Diagnosis;
  /** Acoustic sub-scores (pronunciation/fluency), when Azure assessed the attempt. */
  assessment?: Assessment;
}

export async function recordPracticeAttempt(args: {
  item: PracticeItem;
  lessonId: string;
  transcript: string;
  alternatives: string[];
  /** Consecutive passes this session including this attempt (0 if this failed). */
  combo: number;
  itemPool?: PracticeItem[];
  /** Phoneme-level acoustic scores, when the recording went through Azure. */
  assessment?: Assessment;
}): Promise<PracticeOutcome> {
  const { item, lessonId, transcript, alternatives, combo, itemPool, assessment } = args;
  const partner = partnerOf(item, itemPool);
  const settings = await repo.getSettings();

  // Adaptive difficulty: shave the pass bar based on how she's doing lately, so
  // a rough patch eases up and a hot streak tightens back up. Only "auto" reads
  // recent history; gentle/normal are constant.
  const recent = settings.difficulty === "auto" ? await repo.getAttempts({ limit: 15 }) : [];
  const ease = adaptiveEase(settings.difficulty, recentPassRate(recent));

  const result = scoreAttempt({
    target: item.text,
    transcript,
    alternatives,
    kind: item.kind,
    partnerText: partner?.text,
    assessment,
    ease,
  });

  const now = Date.now();

  const attempt: Attempt = {
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
    at: now,
  };
  await repo.recordAttempt(attempt);

  const existing = await repo.getProgress(item.id);
  const prev =
    existing ??
    freshProgress(
      { itemId: item.id, lessonId, categoryId: item.categoryId, phoneme: item.phoneme },
      now,
    );
  const nextProgress: ItemProgress = applyResult(prev, result.passed, result.score, now);
  await repo.saveProgress(nextProgress);

  // Game layer: XP, streak, combo, achievements.
  const player = await repo.getPlayerStats();
  const { stats, rewards } = applyAttempt(player, {
    passed: result.passed,
    combo: result.passed ? combo : 0,
    dailyGoal: settings.dailyGoal,
    score: result.score,
  });
  await repo.savePlayerStats(stats);

  // Mirror to the cloud for cross-device sync + the instructor's view.
  // No-ops when Supabase isn't configured or no profile is set.
  if (settings.profileId) {
    pushAttempt(settings.profileId, attempt);
    pushProgress(settings.profileId, nextProgress);
    pushPlayer(settings.profileId, stats);
  }

  // Learning-loop quests: a previously-seen item counts as review; a new one as learning.
  void recordQuestEvent(existing ? "review" : "learn");

  // Pinpoint feedback: which word missed, and which sound explains it. Acoustic
  // (phoneme) diagnosis when available; transcript alignment otherwise.
  const diagnosis = result.passed
    ? { misses: [], sound: null }
    : assessment
      ? diagnoseAssessment(assessment.words, item.text)
      : diagnose(item.text, result.heard);

  return { score: result, rewards, diagnosis, assessment };
}
