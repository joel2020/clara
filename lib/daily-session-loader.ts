import type { Attempt } from "./db/types.ts";
import { dailyPronunciationChoiceIds, isAuthoredDailyPronunciationActivity, type DailyPronunciationHistoryRow, type DailySession } from "./daily-session.ts";
import { dailyPronunciationContentHash, dailyPronunciationLegacyContentHash, isDailyPronunciationGameState } from "./speech/daily-pronunciation-game.ts";
import { targetEvidenceMetadata } from "./speech/pronunciation-target-evidence.ts";

/** Keep only bounded decision evidence; raw recognized/target speech never enters composition. */
export function dailyPronunciationEvidence(attempt: Attempt): DailyPronunciationHistoryRow {
  return {
    itemId: attempt.itemId,
    passed: attempt.passed,
    at: attempt.at,
    evidence: "valid",
    ...(attempt.providerStatus ? { providerStatus: attempt.providerStatus } : {}),
    ...(attempt.policyVersion ? { policyVersion: attempt.policyVersion } : {}),
    ...(attempt.targetPhonemeScore === undefined ? {} : { targetPhonemeScore: attempt.targetPhonemeScore }),
    ...(attempt.weakestPhoneme ? { weakestPhoneme: attempt.weakestPhoneme } : {}),
    ...(attempt.phoneme ? { phoneme: attempt.phoneme } : {}),
    ...(attempt.pronunciationOutcome ? { pronunciationOutcome: attempt.pronunciationOutcome } : {}),
  };
}

export function hasRequiredScoredPronunciation(session: DailySession): boolean {
  return session.version === 2 && session.activities.some((activity) => activity.kind === "speak"
    && activity.pronunciation?.mode === "scored"
    && isAuthoredDailyPronunciationActivity(activity.pronunciation)
    && activity.pronunciation.targets.every((target) => targetEvidenceMetadata(target).reduction !== "diagnostic-only")
    && isDailyPronunciationGameState(
      activity.pronunciation.state,
      [
        dailyPronunciationContentHash(activity.pronunciation.game, activity.pronunciation.targets, activity.pronunciation.itemPool),
        dailyPronunciationLegacyContentHash(activity.pronunciation.game, activity.pronunciation.targets),
      ],
      dailyPronunciationChoiceIds(activity.pronunciation, activity.pronunciation.state?.targetIndex ?? 0),
    )
    && activity.pronunciation.state?.game === activity.pronunciation.game);
}

export interface DailySessionLoadBoundary {
  day: string;
  load: (day: string) => Promise<DailySession | undefined>;
  compose: () => Promise<DailySession | null>;
  save: (session: DailySession) => Promise<DailySession>;
  publish: (session: DailySession) => void;
}

/**
 * Resume persisted state before consulting fresh learner evidence. A newly
 * composed plan crosses the durable save boundary before React can publish it.
 */
export async function loadOrCreateDailySession(
  boundary: DailySessionLoadBoundary,
): Promise<DailySession | null> {
  const saved = await boundary.load(boundary.day);
  // Once a learner has started, the stored row is an audit/resume boundary.
  // Legacy and even partially corrupt rows are published byte-for-byte rather
  // than silently replacing progress. New/unstarted rows may migrate to v2.
  if (saved?.startedAt !== null && saved?.startedAt !== undefined) {
    boundary.publish(saved);
    return saved;
  }
  if (saved && hasRequiredScoredPronunciation(saved)) {
    boundary.publish(saved);
    return saved;
  }

  const composed = await boundary.compose();
  if (!composed || !hasRequiredScoredPronunciation(composed)) return null;
  const persisted = await boundary.save(composed);
  boundary.publish(persisted);
  return persisted;
}
