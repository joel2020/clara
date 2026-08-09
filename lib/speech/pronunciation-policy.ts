export const PRONUNCIATION_POLICY_VERSION = "latam-v1";

export type PronunciationContext = "word" | "daily-phrase" | "stage" | "free";
export type ProviderStatus = "valid" | "technical-skip" | "unavailable";
export type CefrLevel = "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface PronunciationEvidence {
  providerStatus: ProviderStatus;
  pronunciationScore?: number;
  accuracyScore?: number;
  fluencyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  targetPhonemeScore?: number;
  lowestTargetWordScore?: number;
  targetRecognized?: boolean;
  minimalPairSubstitution?: boolean;
}

export interface PronunciationVerdict {
  policyVersion: typeof PRONUNCIATION_POLICY_VERSION;
  outcome: "mastered" | "retry" | "diagnostic" | "technical-skip";
  reasons: string[];
}

const THRESHOLDS = {
  word: {
    pronunciationScore: 82,
    targetPhonemeScore: 75,
  },
  dailyPhrase: {
    pronunciationScore: 78,
    accuracyScore: 78,
    completenessScore: 90,
    lowestTargetWordScore: 70,
    prosodyScoreA2Plus: 65,
  },
  stage: {
    pronunciationScore: 85,
    accuracyScore: 85,
    completenessScore: 95,
    targetPhonemeScore: 80,
    prosodyScoreA2Plus: 70,
  },
} as const;

const NUMERIC_EVIDENCE_FIELDS = [
  "pronunciationScore",
  "accuracyScore",
  "fluencyScore",
  "completenessScore",
  "prosodyScore",
  "targetPhonemeScore",
  "lowestTargetWordScore",
] as const satisfies readonly (keyof PronunciationEvidence)[];

type NumericEvidenceField = (typeof NUMERIC_EVIDENCE_FIELDS)[number];

const reasonForField = (prefix: "missing" | "below-threshold", field: string): string =>
  `${prefix}-${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

function verdict(
  outcome: PronunciationVerdict["outcome"],
  reasons: string[],
): PronunciationVerdict {
  return { policyVersion: PRONUNCIATION_POLICY_VERSION, outcome, reasons };
}

function validateNumericEvidence(evidence: PronunciationEvidence): void {
  for (const field of NUMERIC_EVIDENCE_FIELDS) {
    const value = evidence[field];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100)) {
      throw new RangeError(`Invalid ${field}: expected a finite score from 0 to 100`);
    }
  }
}

function missingFields(
  evidence: PronunciationEvidence,
  fields: readonly (NumericEvidenceField | "targetRecognized")[],
): string[] {
  return fields
    .filter((field) => evidence[field] === undefined)
    .map((field) => reasonForField("missing", field));
}

interface PolicyCheck {
  reasons: string[];
  hardFailure: boolean;
}

function checkThresholds(
  evidence: PronunciationEvidence,
  thresholds: Readonly<Partial<Record<NumericEvidenceField, number>>>,
): PolicyCheck {
  const reasons: string[] = [];
  for (const [field, threshold] of Object.entries(thresholds) as [NumericEvidenceField, number][]) {
    const score = evidence[field];
    if (score !== undefined && score < threshold) {
      reasons.push(reasonForField("below-threshold", field));
    }
  }
  return { reasons, hardFailure: reasons.length > 0 };
}

function checkProsody(
  cefr: CefrLevel,
  prosodyScore: number | undefined,
  threshold: number,
): PolicyCheck {
  if (cefr === "A0" || cefr === "A1") {
    return {
      reasons: prosodyScore === undefined ? [] : ["prosody-diagnostic"],
      hardFailure: false,
    };
  }
  if (prosodyScore === undefined) {
    return { reasons: ["missing-prosody-score"], hardFailure: false };
  }
  const reasons = prosodyScore < threshold ? ["below-threshold-prosody-score"] : [];
  return { reasons, hardFailure: reasons.length > 0 };
}

function checkTargetIdentity(evidence: PronunciationEvidence): PolicyCheck {
  const reasons: string[] = [];
  if (evidence.targetRecognized === false) reasons.push("target-not-recognized");
  if (evidence.minimalPairSubstitution === true) reasons.push("minimal-pair-substitution");
  return { reasons, hardFailure: reasons.length > 0 };
}

function gradeWord(evidence: PronunciationEvidence): PronunciationVerdict {
  const missing = missingFields(evidence, [
    "pronunciationScore",
    "targetPhonemeScore",
    "targetRecognized",
  ]);
  if (missing.length > 0) return verdict("diagnostic", missing);

  const thresholds = checkThresholds(evidence, THRESHOLDS.word);
  const identity = checkTargetIdentity(evidence);
  return verdict(
    thresholds.hardFailure || identity.hardFailure ? "retry" : "mastered",
    [...thresholds.reasons, ...identity.reasons],
  );
}

function gradeDailyPhrase(evidence: PronunciationEvidence, cefr: CefrLevel): PronunciationVerdict {
  const requiredFields: (NumericEvidenceField | "targetRecognized")[] = [
    "pronunciationScore",
    "accuracyScore",
    "completenessScore",
    "lowestTargetWordScore",
  ];
  if (cefr !== "A0" && cefr !== "A1") requiredFields.push("prosodyScore");
  const missing = missingFields(evidence, requiredFields);
  if (missing.length > 0) return verdict("diagnostic", missing);

  const thresholds = checkThresholds(evidence, {
    pronunciationScore: THRESHOLDS.dailyPhrase.pronunciationScore,
    accuracyScore: THRESHOLDS.dailyPhrase.accuracyScore,
    completenessScore: THRESHOLDS.dailyPhrase.completenessScore,
    lowestTargetWordScore: THRESHOLDS.dailyPhrase.lowestTargetWordScore,
  });
  const prosody = checkProsody(cefr, evidence.prosodyScore, THRESHOLDS.dailyPhrase.prosodyScoreA2Plus);
  const identity = checkTargetIdentity(evidence);
  return verdict(
    thresholds.hardFailure || prosody.hardFailure || identity.hardFailure ? "retry" : "mastered",
    [...thresholds.reasons, ...prosody.reasons, ...identity.reasons],
  );
}

function gradeStage(evidence: PronunciationEvidence, cefr: CefrLevel): PronunciationVerdict {
  const requiredFields: (NumericEvidenceField | "targetRecognized")[] = [
    "pronunciationScore",
    "accuracyScore",
    "completenessScore",
    "targetPhonemeScore",
  ];
  if (cefr !== "A0" && cefr !== "A1") requiredFields.push("prosodyScore");
  const missing = missingFields(evidence, requiredFields);
  if (missing.length > 0) return verdict("diagnostic", missing);

  const thresholds = checkThresholds(evidence, {
    pronunciationScore: THRESHOLDS.stage.pronunciationScore,
    accuracyScore: THRESHOLDS.stage.accuracyScore,
    completenessScore: THRESHOLDS.stage.completenessScore,
    targetPhonemeScore: THRESHOLDS.stage.targetPhonemeScore,
  });
  const prosody = checkProsody(cefr, evidence.prosodyScore, THRESHOLDS.stage.prosodyScoreA2Plus);
  const identity = checkTargetIdentity(evidence);
  return verdict(
    thresholds.hardFailure || prosody.hardFailure || identity.hardFailure ? "retry" : "mastered",
    [...thresholds.reasons, ...prosody.reasons, ...identity.reasons],
  );
}

export function gradePronunciation(input: {
  context: PronunciationContext;
  cefr: CefrLevel;
  evidence: PronunciationEvidence;
}): PronunciationVerdict {
  const { context, cefr, evidence } = input;
  validateNumericEvidence(evidence);

  if (evidence.providerStatus === "technical-skip") {
    return verdict("technical-skip", ["provider-technical-skip"]);
  }
  if (evidence.providerStatus === "unavailable") {
    return verdict("technical-skip", ["provider-unavailable"]);
  }
  if (context === "free") {
    return verdict("diagnostic", ["free-speech-diagnostic"]);
  }
  if (context === "word") return gradeWord(evidence);
  if (context === "daily-phrase") return gradeDailyPhrase(evidence, cefr);
  return gradeStage(evidence, cefr);
}
