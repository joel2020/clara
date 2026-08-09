import { derivePersonalWeaknesses, type SoundWeakness } from "./pronunciation-diagnosis.ts";
import {
  LATAM_PRONUNCIATION_PRIOR,
  isLatamPronunciationFeature,
  type LatamPronunciationFeature,
  type PronunciationImpact,
} from "./latam-prior.ts";

const MAX_BOSS_HISTORY = 80;
const MIN_VALID_ATTEMPTS = 2;
const IMPACT_RANK: Readonly<Record<PronunciationImpact, number>> = {
  "word-identity": 0,
  "omitted-ending": 1,
  intelligibility: 2,
  "rhythm-fluency": 3,
};

export interface WeeklySoundBossInput {
  /** Newest first; only the bounded Task 5 evidence contract is accepted. */
  attempts: readonly unknown[];
  /** Features actually taught in the learner's current curriculum window. */
  curriculumFeatures: readonly unknown[];
}

export interface WeeklySoundBossTarget extends SoundWeakness {
  impact: PronunciationImpact;
}

/** Pick measured current needs only. The LATAM prior breaks ties; it never creates a weakness. */
export function selectWeeklySoundBoss(input: WeeklySoundBossInput): WeeklySoundBossTarget[] {
  const current = new Set<LatamPronunciationFeature>(
    input.curriculumFeatures.filter(isLatamPronunciationFeature),
  );
  return derivePersonalWeaknesses(input.attempts.slice(0, MAX_BOSS_HISTORY))
    .filter((weakness) => weakness.validAttempts >= MIN_VALID_ATTEMPTS && current.has(weakness.feature))
    .map((weakness) => ({ ...weakness, impact: LATAM_PRONUNCIATION_PRIOR[weakness.feature].impact }))
    .sort((left, right) => IMPACT_RANK[left.impact] - IMPACT_RANK[right.impact]
      || left.score - right.score
      || right.validAttempts - left.validAttempts
      || LATAM_PRONUNCIATION_PRIOR[left.feature].priorOrder - LATAM_PRONUNCIATION_PRIOR[right.feature].priorOrder
      || left.feature.localeCompare(right.feature))
    .slice(0, 3);
}
