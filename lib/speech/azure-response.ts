import type { PronunciationEvidence } from "./pronunciation-policy";

export interface AssessedPhoneme {
  phoneme: string;
  accuracyScore?: number;
}

export interface AssessedWord {
  word: string;
  accuracyScore?: number;
  errorType?: string;
  phonemes: AssessedPhoneme[];
}

export interface AssessmentResult extends PronunciationEvidence {
  provider: "azure";
  recognitionReason?: RecognitionReason;
  recognizedText: string;
  words: AssessedWord[];
}

export type AssessmentKind = "word" | "phrase" | "free";
export type RecognitionReason = "no-match" | "initial-silence-timeout" | "babble-timeout";

type UnknownRecord = Record<string, unknown>;

/** Defensive provider-boundary caps; short-audio assessments never need more. */
export const AZURE_RESPONSE_LIMITS = {
  recognizedTextLength: 512,
  hypothesisCount: 5,
  wordCount: 100,
  wordLength: 80,
  phonemesPerWord: 16,
  phonemeLength: 16,
  errorTypeLength: 32,
} as const;

const technicalSkip = (): AssessmentResult => ({
  provider: "azure",
  providerStatus: "technical-skip",
  recognizedText: "",
  words: [],
});

function record(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function optionalRecord(parent: UnknownRecord, field: string): UnknownRecord | undefined {
  const value = parent[field];
  if (value === undefined) return undefined;
  const result = record(value);
  if (!result) throw new TypeError("Malformed provider evidence");
  return result;
}

function optionalArray(parent: UnknownRecord, field: string, maxLength: number): unknown[] {
  const value = parent[field];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxLength) throw new TypeError("Malformed provider evidence");
  return value;
}

function optionalText(
  parent: UnknownRecord,
  field: string,
  maxLength: number,
  requireNonEmpty = false,
): string | undefined {
  const value = parent[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new TypeError("Malformed provider evidence");
  const text = value.trim();
  if (text.length > maxLength || (requireNonEmpty && text.length === 0)) {
    throw new TypeError("Malformed provider evidence");
  }
  return text;
}

function optionalScore(parent: UnknownRecord | undefined, field: string): number | undefined {
  if (!parent || parent[field] === undefined) return undefined;
  const value = parent[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError("Malformed provider score");
  }
  return value;
}

function scoreWithFallback(
  preferred: UnknownRecord | undefined,
  fallback: UnknownRecord,
  field: string,
): number | undefined {
  return optionalScore(preferred, field) ?? optionalScore(fallback, field);
}

function normalizePhoneme(value: unknown): AssessedPhoneme {
  const source = record(value);
  if (!source) throw new TypeError("Malformed provider evidence");
  const assessment = optionalRecord(source, "PronunciationAssessment");
  const accuracyScore = scoreWithFallback(assessment, source, "AccuracyScore");
  return {
    phoneme: optionalText(source, "Phoneme", AZURE_RESPONSE_LIMITS.phonemeLength, true) ?? "",
    ...(accuracyScore === undefined ? {} : { accuracyScore }),
  };
}

function normalizeWord(value: unknown): AssessedWord {
  const source = record(value);
  if (!source) throw new TypeError("Malformed provider evidence");
  const assessment = optionalRecord(source, "PronunciationAssessment");
  const accuracyScore = scoreWithFallback(assessment, source, "AccuracyScore");
  const errorType = optionalText(assessment ?? {}, "ErrorType", AZURE_RESPONSE_LIMITS.errorTypeLength, true)
    ?? optionalText(source, "ErrorType", AZURE_RESPONSE_LIMITS.errorTypeLength, true);
  return {
    word: optionalText(source, "Word", AZURE_RESPONSE_LIMITS.wordLength, true) ?? "",
    ...(accuracyScore === undefined ? {} : { accuracyScore }),
    ...(errorType === undefined ? {} : { errorType }),
    phonemes: optionalArray(source, "Phonemes", AZURE_RESPONSE_LIMITS.phonemesPerWord).map(normalizePhoneme),
  };
}

const RESULT_SCORE_FIELDS = [
  "pronunciationScore",
  "accuracyScore",
  "fluencyScore",
  "completenessScore",
  "prosodyScore",
  "targetPhonemeScore",
  "lowestTargetWordScore",
] as const;

function validScore(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100);
}

/** Shared deep runtime guard for the server response and every client consumer. */
export function isAssessmentResult(value: unknown): value is AssessmentResult {
  const result = record(value);
  if (!result || result.provider !== "azure") return false;
  if (result.providerStatus !== "valid" && result.providerStatus !== "technical-skip" && result.providerStatus !== "unavailable") return false;
  if (typeof result.recognizedText !== "string" || result.recognizedText.length > AZURE_RESPONSE_LIMITS.recognizedTextLength) return false;
  if (!Array.isArray(result.words) || result.words.length > AZURE_RESPONSE_LIMITS.wordCount) return false;
  if (!RESULT_SCORE_FIELDS.every((field) => validScore(result[field]))) return false;
  if (result.targetRecognized !== undefined && typeof result.targetRecognized !== "boolean") return false;
  if (result.minimalPairSubstitution !== undefined && typeof result.minimalPairSubstitution !== "boolean") return false;
  if (
    result.recognitionReason !== undefined &&
    result.recognitionReason !== "no-match" &&
    result.recognitionReason !== "initial-silence-timeout" &&
    result.recognitionReason !== "babble-timeout"
  ) return false;

  const wordsValid = result.words.every((candidate) => {
    const word = record(candidate);
    if (!word || typeof word.word !== "string") return false;
    const identifier = word.word.trim();
    if (!identifier || word.word.length > AZURE_RESPONSE_LIMITS.wordLength) return false;
    if (!validScore(word.accuracyScore)) return false;
    if (word.errorType !== undefined && (
      typeof word.errorType !== "string" ||
      !word.errorType.trim() ||
      word.errorType.length > AZURE_RESPONSE_LIMITS.errorTypeLength
    )) return false;
    if (!Array.isArray(word.phonemes) || word.phonemes.length > AZURE_RESPONSE_LIMITS.phonemesPerWord) return false;
    return word.phonemes.every((candidatePhoneme) => {
      const phoneme = record(candidatePhoneme);
      return Boolean(
        phoneme &&
        typeof phoneme.phoneme === "string" &&
        phoneme.phoneme.trim() &&
        phoneme.phoneme.length <= AZURE_RESPONSE_LIMITS.phonemeLength &&
        validScore(phoneme.accuracyScore),
      );
    });
  });
  if (!wordsValid) return false;

  if (result.recognitionReason !== undefined) {
    return result.providerStatus === "valid"
      && result.recognizedText === ""
      && result.words.length === 0
      && RESULT_SCORE_FIELDS.every((field) => result[field] === undefined)
      && result.targetRecognized === undefined
      && result.minimalPairSubstitution === undefined;
  }

  if (result.providerStatus !== "valid") {
    return result.recognizedText === "" && result.words.length === 0;
  }
  return result.recognizedText.trim().length > 0 && result.words.length > 0;
}

/**
 * Convert Azure's detailed response into the stable evidence contract used by
 * the grading policy. Unknown or malformed responses become an explicit
 * technical skip; missing measurements remain absent and are never zero-filled.
 */
export function normalizeAzureAssessment(payload: unknown): AssessmentResult {
  try {
    const response = record(payload);
    if (!response) return technicalSkip();
    const recognitionReason: RecognitionReason | undefined =
      response.RecognitionStatus === "NoMatch"
        ? "no-match"
        : response.RecognitionStatus === "InitialSilenceTimeout"
          ? "initial-silence-timeout"
          : response.RecognitionStatus === "BabbleTimeout"
            ? "babble-timeout"
            : undefined;
    if (recognitionReason) {
      return {
        provider: "azure",
        providerStatus: "valid",
        recognitionReason,
        recognizedText: "",
        words: [],
      };
    }
    if (response.RecognitionStatus !== "Success") return technicalSkip();

    const hypotheses = optionalArray(response, "NBest", AZURE_RESPONSE_LIMITS.hypothesisCount);
    const best = record(hypotheses[0]);
    if (!best) return technicalSkip();

    const assessment = optionalRecord(best, "PronunciationAssessment");
    const pronunciationScore = scoreWithFallback(assessment, best, "PronScore");
    const accuracyScore = scoreWithFallback(assessment, best, "AccuracyScore");
    const fluencyScore = scoreWithFallback(assessment, best, "FluencyScore");
    const completenessScore = scoreWithFallback(assessment, best, "CompletenessScore");
    const prosodyScore = scoreWithFallback(assessment, best, "ProsodyScore");

    const result: AssessmentResult = {
      provider: "azure",
      providerStatus: "valid",
      recognizedText:
        optionalText(best, "Display", AZURE_RESPONSE_LIMITS.recognizedTextLength)
        ?? optionalText(response, "DisplayText", AZURE_RESPONSE_LIMITS.recognizedTextLength)
        ?? "",
      ...(pronunciationScore === undefined ? {} : { pronunciationScore }),
      ...(accuracyScore === undefined ? {} : { accuracyScore }),
      ...(fluencyScore === undefined ? {} : { fluencyScore }),
      ...(completenessScore === undefined ? {} : { completenessScore }),
      ...(prosodyScore === undefined ? {} : { prosodyScore }),
      words: optionalArray(best, "Words", AZURE_RESPONSE_LIMITS.wordCount).map(normalizeWord),
    };
    return isAssessmentResult(result) ? result : technicalSkip();
  } catch {
    return technicalSkip();
  }
}
