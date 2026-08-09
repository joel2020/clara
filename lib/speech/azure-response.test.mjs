import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isAssessmentResult, normalizeAzureAssessment } from "./azure-response.ts";
import { gradePronunciation } from "./pronunciation-policy.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(join(HERE, "fixtures", name), "utf8"));

let checks = 0;
const eq = (actual, expected, message) => {
  checks += 1;
  assert.deepEqual(actual, expected, message);
};

const word = normalizeAzureAssessment(fixture("azure-word.json"));
eq(word, {
  provider: "azure",
  providerStatus: "valid",
  recognizedText: "very",
  pronunciationScore: 84.4,
  accuracyScore: 82.6,
  fluencyScore: 88.1,
  completenessScore: 100,
  words: [
    {
      word: "very",
      accuracyScore: 82.6,
      errorType: "Mispronunciation",
      phonemes: [
        { phoneme: "v", accuracyScore: 68.2 },
        { phoneme: "ɛ", accuracyScore: 91.4 },
      ],
    },
  ],
}, "word evidence is complete while missing prosody stays absent");
eq(Object.hasOwn(word, "prosodyScore"), false, "missing prosody is not invented as zero");

const phrase = normalizeAzureAssessment(fixture("azure-phrase.json"));
eq(phrase.providerStatus, "valid", "successful phrase is valid evidence");
eq(phrase.recognizedText, "I'd like a coffee.", "recognized text comes from the selected hypothesis");
eq(
  {
    pronunciationScore: phrase.pronunciationScore,
    accuracyScore: phrase.accuracyScore,
    fluencyScore: phrase.fluencyScore,
    completenessScore: phrase.completenessScore,
    prosodyScore: phrase.prosodyScore,
  },
  {
    pronunciationScore: 86.8,
    accuracyScore: 85.2,
    fluencyScore: 83.7,
    completenessScore: 96.4,
    prosodyScore: 78.9,
  },
  "all overall provider measurements are normalized",
);
eq(phrase.words[1], {
  word: "coffee",
  accuracyScore: 72.1,
  errorType: "None",
  phonemes: [
    { phoneme: "k", accuracyScore: 92.1 },
    { phoneme: "ɔ", accuracyScore: 64.7 },
  ],
}, "word error types and IPA phonemes are normalized");

const fallback = normalizeAzureAssessment({
  RecognitionStatus: "Success",
  DisplayText: "Water.",
  NBest: [{
    PronScore: 81,
    AccuracyScore: 79,
    FluencyScore: 77,
    Words: [{ Word: "water", AccuracyScore: 75, ErrorType: "None", Phonemes: [{ Phoneme: "w", AccuracyScore: 73 }] }],
  }],
});
eq(fallback, {
  provider: "azure",
  providerStatus: "valid",
  recognizedText: "Water.",
  pronunciationScore: 81,
  accuracyScore: 79,
  fluencyScore: 77,
  words: [{
    word: "water",
    accuracyScore: 75,
    errorType: "None",
    phonemes: [{ phoneme: "w", accuracyScore: 73 }],
  }],
}, "documented top-level score fallbacks remain supported without inventing missing fields");

for (const [payload, label] of [
  [null, "null payload"],
  [{}, "empty payload"],
  [{ RecognitionStatus: "Success", NBest: [] }, "success without a hypothesis"],
  [{ RecognitionStatus: "Success", NBest: ["not-an-object"] }, "malformed hypothesis"],
  [{ RecognitionStatus: "Success", NBest: [{ PronScore: 101 }] }, "out-of-range score"],
]) {
  eq(normalizeAzureAssessment(payload), {
    provider: "azure",
    providerStatus: "technical-skip",
    recognizedText: "",
    words: [],
  }, `${label} is safely marshalled as ungraded evidence`);
}

for (const [recognitionStatus, recognitionReason] of [
  ["NoMatch", "no-match"],
  ["InitialSilenceTimeout", "initial-silence-timeout"],
  ["BabbleTimeout", "babble-timeout"],
]) {
  eq(normalizeAzureAssessment({ RecognitionStatus: recognitionStatus, NBest: [] }), {
    provider: "azure",
    providerStatus: "valid",
    recognitionReason,
    recognizedText: "",
    words: [],
  }, `${recognitionStatus} remains a bounded learner capture outcome`);
}
eq(
  isAssessmentResult(normalizeAzureAssessment({ RecognitionStatus: "NoMatch", NBest: [] })),
  true,
  "the shared client guard preserves a bounded no-match outcome",
);

const missingWordScores = normalizeAzureAssessment({
  RecognitionStatus: "Success",
  NBest: [{ Display: "hello", PronunciationAssessment: { PronScore: 80 }, Words: [{ Word: "hello", Phonemes: [{ Phoneme: "h" }] }] }],
});
eq(missingWordScores.words[0], {
  word: "hello",
  phonemes: [{ phoneme: "h" }],
}, "missing word and phoneme scores remain missing rather than becoming zero");

const thresholdEvidence = normalizeAzureAssessment({
  RecognitionStatus: "Success",
  NBest: [{
    Display: "ship",
    PronunciationAssessment: {
      PronScore: 81.6,
      AccuracyScore: 77.6,
      CompletenessScore: 89.6,
      ProsodyScore: 64.6,
    },
    Words: [{
      Word: "ship",
      PronunciationAssessment: { AccuracyScore: 69.6, ErrorType: "None" },
      Phonemes: [{ Phoneme: "ɪ", PronunciationAssessment: { AccuracyScore: 74.6 } }],
    }],
  }],
});
eq(thresholdEvidence.pronunciationScore, 81.6, "provider score precision is preserved at the word threshold");
eq(thresholdEvidence.words[0].phonemes[0].accuracyScore, 74.6, "phoneme precision is preserved at the word threshold");
eq(
  gradePronunciation({
    context: "word",
    cefr: "A1",
    evidence: {
      ...thresholdEvidence,
      targetRecognized: true,
      targetPhonemeScore: thresholdEvidence.words[0].phonemes[0].accuracyScore,
    },
  }).outcome,
  "retry",
  "81.6/74.6 cannot round into 82/75 word mastery",
);
eq(
  gradePronunciation({
    context: "daily-phrase",
    cefr: "A2",
    evidence: {
      ...thresholdEvidence,
      targetRecognized: true,
      lowestTargetWordScore: thresholdEvidence.words[0].accuracyScore,
    },
  }).outcome,
  "retry",
  "77.6/89.6/69.6/64.6 cannot round into daily-phrase mastery",
);

const stageThresholds = normalizeAzureAssessment({
  RecognitionStatus: "Success",
  NBest: [{
    Display: "ship",
    PronunciationAssessment: {
      PronScore: 84.6,
      AccuracyScore: 84.6,
      CompletenessScore: 94.6,
      ProsodyScore: 69.6,
    },
    Words: [{ Word: "ship", Phonemes: [{ Phoneme: "ɪ", AccuracyScore: 79.6 }] }],
  }],
});
eq(
  gradePronunciation({
    context: "stage",
    cefr: "A2",
    evidence: {
      ...stageThresholds,
      targetRecognized: true,
      targetPhonemeScore: stageThresholds.words[0].phonemes[0].accuracyScore,
    },
  }).outcome,
  "retry",
  "84.6/94.6/79.6/69.6 cannot round into stage mastery",
);

const tooManyWords = Array.from({ length: 101 }, (_, index) => ({
  Word: `word-${index}`,
  Phonemes: [{ Phoneme: "w" }],
}));
for (const [payload, label] of [
  [{ RecognitionStatus: "Success", NBest: [{ Display: "x".repeat(513), Words: [{ Word: "x", Phonemes: [] }] }] }, "recognized-text cap"],
  [{ RecognitionStatus: "Success", NBest: [{ Display: "hello", Words: tooManyWords }] }, "word-count cap"],
  [{ RecognitionStatus: "Success", NBest: [{ Display: "hello", Words: [{ Word: "hello", Phonemes: Array.from({ length: 17 }, () => ({ Phoneme: "h" })) }] }] }, "phoneme-count cap"],
  [{ RecognitionStatus: "Success", NBest: [{ Display: "hello", Words: [{ Word: "", Phonemes: [] }] }] }, "empty word identifier"],
  [{ RecognitionStatus: "Success", NBest: [{ Display: "hello", Words: [{ Word: "hello", Phonemes: [{ Phoneme: "" }] }] }] }, "empty phoneme identifier"],
  [{ RecognitionStatus: "Success", NBest: [{ Display: "hello", Words: [{ Word: "w".repeat(81), Phonemes: [] }] }] }, "word identifier cap"],
  [{ RecognitionStatus: "Success", NBest: [{ Display: "hello", Words: [{ Word: "hello", Phonemes: [{ Phoneme: "p".repeat(17) }] }] }] }, "phoneme identifier cap"],
]) {
  eq(normalizeAzureAssessment(payload).providerStatus, "technical-skip", `${label} fails closed`);
}

eq(isAssessmentResult(phrase), true, "the shared deep validator accepts normalized evidence");
for (const [candidate, label] of [
  [{ ...phrase, providerStatus: "other" }, "unknown provider status"],
  [{ ...phrase, pronunciationScore: "86" }, "non-numeric score"],
  [{ ...phrase, words: [{ word: "coffee", phonemes: [{ phoneme: "", accuracyScore: 80 }] }] }, "bad nested identifier"],
]) {
  eq(isAssessmentResult(candidate), false, `the shared deep validator rejects ${label}`);
}

console.log(`azure response: ${checks} checks passed`);
