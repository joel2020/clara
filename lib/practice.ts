import { repo } from "@/lib/db";
import type { PracticeItem } from "@/lib/db/types";
import { applyResult, freshProgress } from "@/lib/srs";
import { scoreAttempt, type ScoreResult } from "@/lib/speech/scoring";
import { partnerOf } from "@/lib/content/lessons";
import { applyAttempt, type AttemptRewards } from "@/lib/gamification";

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

  await repo.recordAttempt({
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
  });

  const prev =
    (await repo.getProgress(item.id)) ??
    freshProgress(
      { itemId: item.id, lessonId, categoryId: item.categoryId, phoneme: item.phoneme },
      now,
    );
  await repo.saveProgress(applyResult(prev, result.passed, result.score, now));

  // Game layer: XP, streak, combo, achievements.
  const [player, settings] = await Promise.all([repo.getPlayerStats(), repo.getSettings()]);
  const { stats, rewards } = applyAttempt(player, {
    passed: result.passed,
    combo: result.passed ? combo : 0,
    dailyGoal: settings.dailyGoal,
  });
  await repo.savePlayerStats(stats);

  return { score: result, rewards };
}
