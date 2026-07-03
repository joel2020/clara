import { repo } from "@/lib/db";
import type { Attempt, ItemProgress, PracticeItem } from "@/lib/db/types";
import { applyResult, freshProgress } from "@/lib/srs";
import { scoreAttempt, type ScoreResult } from "@/lib/speech/scoring";
import { partnerOf } from "@/lib/content/lessons";
import { applyAttempt, type AttemptRewards } from "@/lib/gamification";
import { pushAttempt, pushProgress, pushPlayer } from "@/lib/sync/supabase-sync";

// One place that knows how an attempt becomes saved state: score it, append to
// history, advance the item's spaced-repetition box, and award XP / streak /
// achievements. Returns both the score and the game rewards so the UI can react.

export interface PracticeOutcome {
  score: ScoreResult;
  rewards: AttemptRewards;
}

export async function recordPracticeAttempt(args: {
  item: PracticeItem;
  lessonId: string;
  transcript: string;
  alternatives: string[];
  /** Consecutive passes this session including this attempt (0 if this failed). */
  combo: number;
  itemPool?: PracticeItem[];
}): Promise<PracticeOutcome> {
  const { item, lessonId, transcript, alternatives, combo, itemPool } = args;
  const partner = partnerOf(item, itemPool);

  const result = scoreAttempt({
    target: item.text,
    transcript,
    alternatives,
    kind: item.kind,
    partnerText: partner?.text,
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
    at: now,
  };
  await repo.recordAttempt(attempt);

  const prev =
    (await repo.getProgress(item.id)) ??
    freshProgress(
      { itemId: item.id, lessonId, categoryId: item.categoryId, phoneme: item.phoneme },
      now,
    );
  const nextProgress: ItemProgress = applyResult(prev, result.passed, result.score, now);
  await repo.saveProgress(nextProgress);

  // Game layer: XP, streak, combo, achievements.
  const [player, settings] = await Promise.all([repo.getPlayerStats(), repo.getSettings()]);
  const { stats, rewards } = applyAttempt(player, {
    passed: result.passed,
    combo: result.passed ? combo : 0,
    dailyGoal: settings.dailyGoal,
  });
  await repo.savePlayerStats(stats);

  // Mirror to the cloud for cross-device sync + the instructor's view.
  // No-ops when Supabase isn't configured or no profile is set.
  if (settings.profileId) {
    pushAttempt(settings.profileId, attempt);
    pushProgress(settings.profileId, nextProgress);
    pushPlayer(settings.profileId, stats);
  }

  return { score: result, rewards };
}
