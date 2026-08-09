import {
  isAssessmentResult,
  type AssessmentResult,
  type AssessedWord,
} from "./azure-response.ts";
import {
  isLatamPronunciationFeature,
  LATAM_PRONUNCIATION_PRIOR,
  PRONUNCIATION_TARGET_METADATA,
  type LatamPronunciationFeature,
  type PronunciationCueKey,
  type PronunciationImpact,
  type PronunciationTargetMetadata,
} from "./latam-prior.ts";

export interface PronunciationDiagnosis {
  target: string;
  observed?: string;
  cueKey: PronunciationCueKey;
  contrast?: { target: string; likelySubstitution: string };
  source: "personal-evidence" | "latam-prior" | "provider";
}

/**
 * A weakness aggregate may be created only from valid scored attempts.
 * The runtime guard enforces that boundary when persisted or untyped data enters.
 */
export interface SoundWeakness {
  feature: LatamPronunciationFeature;
  evidenceStatus: "valid";
  /** Aggregate target-sound accuracy from 0 to 100; lower means weaker. */
  score: number;
  /** Number of valid, non-technical attempts contributing to the aggregate. */
  validAttempts: number;
  /** Measured output only; omit when the provider did not identify it. */
  observed?: string;
}

type UnknownRecord = Record<string, unknown>;

interface Candidate {
  feature: LatamPronunciationFeature;
  score: number;
  validAttempts: number;
  observed?: string;
  word?: string;
}

const IMPACT_RANK: Readonly<Record<PronunciationImpact, number>> = {
  "word-identity": 0,
  "omitted-ending": 1,
  intelligibility: 2,
  "rhythm-fluency": 3,
};

const PHONEME_FEATURE: Readonly<Record<string, LatamPronunciationFeature>> = {
  "ɪ": "short-i-long-ee",
  i: "short-i-long-ee",
  "iː": "short-i-long-ee",
  "ʊ": "foot-goose",
  u: "foot-goose",
  "uː": "foot-goose",
  "æ": "trap-dress",
  "ɛ": "trap-dress",
  "ʌ": "strut-lot",
  "ɑ": "strut-lot",
  b: "b-v",
  v: "b-v",
  "dʒ": "dzh-y",
  j: "dzh-y",
  "ʃ": "sh-ch",
  "tʃ": "sh-ch",
  "θ": "th",
  "ð": "th",
  h: "h",
  "ɹ": "rhotic-r",
  "ɻ": "rhotic-r",
  r: "rhotic-r",
  "ɝ": "rhotic-r",
  "ɚ": "rhotic-r",
  "ə": "schwa",
};

const CONSONANT_PHONEMES = new Set([
  "b", "d", "dʒ", "ð", "f", "g", "h", "j", "k", "l", "m", "n", "ŋ", "p",
  "r", "ɹ", "ɻ", "s", "ʃ", "t", "tʃ", "θ", "v", "w", "z", "ʒ",
]);
const VOWEL_PHONEMES = new Set([
  "a", "e", "i", "iː", "ɪ", "eɪ", "ɛ", "æ", "ɑ", "ɑː", "ɔ", "ɔː", "oʊ", "ʊ", "u", "uː",
  "ʌ", "ə", "ɚ", "ɝ", "aɪ", "aʊ", "ɔɪ",
]);
const SAFE_OBSERVED_PHONEMES = new Set([
  ...CONSONANT_PHONEMES,
  ...VOWEL_PHONEMES,
  "β", "ç", "es", "ɣ", "ɦ", "ɾ", "ɽ", "ʔ", "ʋ", "x",
]);
const FINAL_ENDING_PHONEMES = new Set(["s", "z", "t", "d"]);
const ACTIONABLE_SCORE = 70;
const MAX_OBSERVED_LENGTH = 32;
const MAX_VALID_ATTEMPTS = 10_000;
const MAX_PERSONAL_EVIDENCE_ATTEMPTS = 80;

function record(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

function attemptFeature(candidate: UnknownRecord): LatamPronunciationFeature | undefined {
  if (isLatamPronunciationFeature(candidate.weakestPhoneme)) return candidate.weakestPhoneme;
  if (typeof candidate.itemId === "string") {
    const metadata = PRONUNCIATION_TARGET_METADATA[candidate.itemId];
    if (metadata?.kind === "flap") return "flap";
    if (metadata?.kind === "final-ending") return "final-endings";
  }
  if (candidate.phoneme === "flap") return "flap";
  if (typeof candidate.phoneme === "string" && /^(?:s[ptk]|str)$/.test(candidate.phoneme)) return "initial-s-cluster";
  return typeof candidate.phoneme === "string" ? PHONEME_FEATURE[candidate.phoneme] : undefined;
}

/** Aggregate a bounded recent history using only valid, measured Task 5 evidence. */
export function derivePersonalWeaknesses(attempts: readonly unknown[]): SoundWeakness[] {
  if (!Array.isArray(attempts)) return [];
  const aggregates = new Map<LatamPronunciationFeature, { total: number; count: number }>();
  for (const value of attempts.slice(0, MAX_PERSONAL_EVIDENCE_ATTEMPTS)) {
    const candidate = record(value);
    if (
      !candidate ||
      candidate.providerStatus !== "valid" ||
      candidate.policyVersion !== "latam-v1" ||
      typeof candidate.targetPhonemeScore !== "number" ||
      !Number.isFinite(candidate.targetPhonemeScore) ||
      candidate.targetPhonemeScore < 0 ||
      candidate.targetPhonemeScore > 100
    ) continue;
    const feature = attemptFeature(candidate);
    if (!feature) continue;
    const aggregate = aggregates.get(feature) ?? { total: 0, count: 0 };
    aggregate.total += candidate.targetPhonemeScore;
    aggregate.count += 1;
    aggregates.set(feature, aggregate);
  }
  return [...aggregates.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([feature, aggregate]) => ({
      feature,
      evidenceStatus: "valid" as const,
      score: aggregate.total / aggregate.count,
      validAttempts: aggregate.count,
    }));
}

function isSafeObserved(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_OBSERVED_LENGTH) return false;
  if (value === "∅") return true;
  const slashWrapped = value.startsWith("/") && value.endsWith("/");
  const bracketWrapped = value.startsWith("[") && value.endsWith("]");
  if (!slashWrapped && !bracketWrapped) return false;
  const body = value.slice(1, -1);
  if (SAFE_OBSERVED_PHONEMES.has(body)) return true;
  const symbols = [...body.normalize("NFD")];
  return (
    symbols.length >= 2 &&
    symbols.length <= 3 &&
    SAFE_OBSERVED_PHONEMES.has(symbols[0]) &&
    symbols.slice(1).every((symbol) => /^\p{M}$/u.test(symbol))
  );
}

export function isSoundWeakness(value: unknown): value is SoundWeakness {
  const candidate = record(value);
  if (!candidate || candidate.evidenceStatus !== "valid") return false;
  if (!isLatamPronunciationFeature(candidate.feature)) return false;
  if (typeof candidate.score !== "number" || !Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 100) return false;
  if (
    typeof candidate.validAttempts !== "number" ||
    !Number.isSafeInteger(candidate.validAttempts) ||
    candidate.validAttempts < 1 ||
    candidate.validAttempts > MAX_VALID_ATTEMPTS
  ) return false;
  if (candidate.observed !== undefined && !isSafeObserved(candidate.observed)) return false;
  return true;
}

function providerCandidateRank(candidate: Candidate): readonly number[] {
  const prior = LATAM_PRONUNCIATION_PRIOR[candidate.feature];
  return [IMPACT_RANK[prior.impact], candidate.score];
}

function selectProviderCandidate(
  candidates: readonly Candidate[],
  historyFeatures: ReadonlySet<LatamPronunciationFeature>,
): { candidate: Candidate; source: PronunciationDiagnosis["source"] } | null {
  if (candidates.length === 0) return null;
  const bestImpact = Math.min(...candidates.map((candidate) => providerCandidateRank(candidate)[0]));
  const impactGroup = candidates.filter((candidate) => providerCandidateRank(candidate)[0] === bestImpact);
  const bestScore = Math.min(...impactGroup.map(({ score }) => score));
  const tiedGroup = impactGroup.filter(({ score }) => score === bestScore);
  if (tiedGroup.length === 1) return { candidate: tiedGroup[0], source: "provider" };

  const historyAware = tiedGroup.some(({ feature }) => historyFeatures.has(feature));
  const orderedGroup = [...tiedGroup].sort((left, right) => {
    if (historyAware) {
      if (left.feature === right.feature) return 0;
      return left.feature < right.feature ? -1 : 1;
    }
    return LATAM_PRONUNCIATION_PRIOR[left.feature].priorOrder - LATAM_PRONUNCIATION_PRIOR[right.feature].priorOrder;
  });
  return { candidate: orderedGroup[0], source: historyAware ? "provider" : "latam-prior" };
}

function isConsonant(phoneme: string | undefined): boolean {
  return phoneme !== undefined && CONSONANT_PHONEMES.has(phoneme);
}

function terminalConsonantRunStart(phonemes: readonly { phoneme: string }[]): number {
  let index = phonemes.length - 1;
  while (index >= 0 && isConsonant(phonemes[index]?.phoneme)) index -= 1;
  return index + 1;
}

function structureCandidates(
  word: AssessedWord,
  phonemeIndex: number,
  score: number,
  metadata?: PronunciationTargetMetadata,
): Candidate[] {
  const candidates: Candidate[] = [];
  const phonemes = word.phonemes;
  const current = phonemes[phonemeIndex]?.phoneme;

  if (
    (phonemeIndex === 0 || phonemeIndex === 1) &&
    phonemes[0]?.phoneme === "s" &&
    isConsonant(phonemes[1]?.phoneme)
  ) {
    candidates.push({ feature: "initial-s-cluster", score, validAttempts: 1 });
  }

  if (phonemeIndex === phonemes.length - 1) {
    if (
      metadata?.kind === "final-ending" &&
      metadata.finalEnding.index === phonemeIndex &&
      metadata.finalEnding.phoneme === current &&
      FINAL_ENDING_PHONEMES.has(current)
    ) {
      candidates.push({ feature: "final-endings", score, validAttempts: 1 });
    }
  }
  const terminalRunStart = terminalConsonantRunStart(phonemes);
  if (phonemes.length - terminalRunStart >= 2 && phonemeIndex >= terminalRunStart) {
    candidates.push({ feature: "final-clusters", score, validAttempts: 1 });
  }

  if (
    metadata?.kind === "flap" &&
    metadata.flap.index === phonemeIndex &&
    metadata.flap.phoneme === current &&
    metadata.flap.left === phonemes[phonemeIndex - 1]?.phoneme &&
    metadata.flap.right === phonemes[phonemeIndex + 1]?.phoneme
  ) {
    candidates.push({ feature: "flap", score, validAttempts: 1 });
  }
  return candidates;
}

function comparePersonalCandidates(left: Candidate, right: Candidate): number {
  const leftPrior = LATAM_PRONUNCIATION_PRIOR[left.feature];
  const rightPrior = LATAM_PRONUNCIATION_PRIOR[right.feature];
  const measuredRank = [IMPACT_RANK[leftPrior.impact], left.score, -left.validAttempts];
  const otherMeasuredRank = [IMPACT_RANK[rightPrior.impact], right.score, -right.validAttempts];
  for (let index = 0; index < measuredRank.length; index += 1) {
    if (measuredRank[index] !== otherMeasuredRank[index]) return measuredRank[index] - otherMeasuredRank[index];
  }
  if (left.feature === right.feature) return 0;
  return left.feature < right.feature ? -1 : 1;
}

function diagnosis(candidate: Candidate, source: PronunciationDiagnosis["source"]): PronunciationDiagnosis {
  const prior = LATAM_PRONUNCIATION_PRIOR[candidate.feature];
  return {
    target: prior.target,
    ...(candidate.observed === undefined ? {} : { observed: candidate.observed }),
    cueKey: prior.cueKey,
    contrast: { target: prior.target, likelySubstitution: prior.likelySubstitution },
    source,
  };
}

function personalCandidates(personalWeaknesses: readonly SoundWeakness[]): Candidate[] {
  return personalWeaknesses
    .filter(isSoundWeakness)
    .filter(({ score }) => score < ACTIONABLE_SCORE)
    .map(({ feature, score, validAttempts, observed }) => ({
      feature,
      score,
      validAttempts,
      ...(observed === undefined ? {} : { observed }),
    }));
}

function metadataForWord(targetItemId: string | undefined, word: AssessedWord): PronunciationTargetMetadata | undefined {
  if (!targetItemId) return undefined;
  const metadata = PRONUNCIATION_TARGET_METADATA[targetItemId];
  return metadata?.text === word.word.trim().toLowerCase() ? metadata : undefined;
}

function currentActionableFeatures(
  evidence: AssessmentResult,
  targetItemId: string | undefined,
): ReadonlySet<LatamPronunciationFeature> {
  const features = new Set<LatamPronunciationFeature>();
  for (const word of evidence.words) {
    const metadata = metadataForWord(targetItemId, word);
    for (const phoneme of word.phonemes) {
      const feature = PHONEME_FEATURE[phoneme.phoneme];
      if (feature) features.add(feature);
    }
    if (word.phonemes[0]?.phoneme === "s" && isConsonant(word.phonemes[1]?.phoneme)) {
      features.add("initial-s-cluster");
    }
    if (word.phonemes.length - terminalConsonantRunStart(word.phonemes) >= 2) {
      features.add("final-clusters");
    }
    if (metadata?.kind === "final-ending") features.add("final-endings");
    if (metadata?.kind === "flap") features.add("flap");
  }
  return features;
}

function providerCandidates(evidence: AssessmentResult, targetItemId?: string): Candidate[] {
  const candidates: Candidate[] = [];

  for (const word of evidence.words) {
    const errorType = word.errorType?.toLowerCase();
    if (errorType === "omission" || errorType === "insertion") continue;
    const metadata = metadataForWord(targetItemId, word);
    for (let phonemeIndex = 0; phonemeIndex < word.phonemes.length; phonemeIndex += 1) {
      const phoneme = word.phonemes[phonemeIndex];
      if (phoneme.accuracyScore === undefined || phoneme.accuracyScore >= ACTIONABLE_SCORE) continue;

      candidates.push(...structureCandidates(word, phonemeIndex, phoneme.accuracyScore, metadata)
        .map((candidate) => ({ ...candidate, word: word.word })));

      const feature = PHONEME_FEATURE[phoneme.phoneme];
      if (feature) candidates.push({ feature, score: phoneme.accuracyScore, validAttempts: 1, word: word.word });
    }
  }

  const bestByFeature = new Map<LatamPronunciationFeature, Candidate>();
  for (const candidate of candidates) {
    const current = bestByFeature.get(candidate.feature);
    if (!current || candidate.score < current.score) bestByFeature.set(candidate.feature, candidate);
  }
  return [...bestByFeature.values()];
}

interface PronunciationDiagnosisInput {
  evidence: AssessmentResult;
  personalWeaknesses: SoundWeakness[];
  /** Current authored target identity; used for flap/ending metadata, never spelling inference. */
  targetItemId?: string;
}

function selectDiagnosis(input: PronunciationDiagnosisInput): {
  candidate: Candidate;
  source: PronunciationDiagnosis["source"];
} | null {
  if (!Array.isArray(input.personalWeaknesses)) return null;
  if (!isAssessmentResult(input.evidence)) return null;
  if (input.evidence.providerStatus !== "valid" || input.evidence.recognitionReason !== undefined) return null;

  const currentFeatures = currentActionableFeatures(input.evidence, input.targetItemId);
  const validHistory = input.personalWeaknesses
    .filter(isSoundWeakness)
    .filter(({ feature }) => currentFeatures.has(feature));
  const historyFeatures = new Set(validHistory.map(({ feature }) => feature));
  const personal = personalCandidates(validHistory).sort(comparePersonalCandidates);
  if (personal.length > 0) return { candidate: personal[0], source: "personal-evidence" };

  return selectProviderCandidate(providerCandidates(input.evidence, input.targetItemId), historyFeatures);
}

/** Select at most one supportive, evidence-backed coaching correction. */
export function diagnosePronunciation(input: PronunciationDiagnosisInput): PronunciationDiagnosis | null {
  const selected = selectDiagnosis(input);
  return selected ? diagnosis(selected.candidate, selected.source) : null;
}

/** Same approved selection, with the exact assessed word for a bounded call retry. */
export function diagnosePronunciationTarget(
  input: PronunciationDiagnosisInput,
): (PronunciationDiagnosis & { word: string }) | null {
  const selected = selectDiagnosis(input);
  if (!selected?.candidate.word) return null;
  return { ...diagnosis(selected.candidate, selected.source), word: selected.candidate.word };
}
