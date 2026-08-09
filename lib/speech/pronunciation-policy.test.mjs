import strictAssert from "node:assert/strict";

import {
  PRONUNCIATION_POLICY_VERSION,
  gradePronunciation,
} from "./pronunciation-policy.ts";

let checks = 0;
const assert = {
  equal(...args) {
    strictAssert.equal(...args);
    checks += 1;
  },
  deepEqual(...args) {
    strictAssert.deepEqual(...args);
    checks += 1;
  },
  ok(...args) {
    strictAssert.ok(...args);
    checks += 1;
  },
  throws(...args) {
    strictAssert.throws(...args);
    checks += 1;
  },
};

const wordEvidence = (overrides = {}) => ({
  providerStatus: "valid",
  pronunciationScore: 82,
  targetPhonemeScore: 75,
  targetRecognized: true,
  minimalPairSubstitution: false,
  ...overrides,
});

const phraseEvidence = (overrides = {}) => ({
  providerStatus: "valid",
  pronunciationScore: 78,
  accuracyScore: 78,
  completenessScore: 90,
  lowestTargetWordScore: 70,
  prosodyScore: 65,
  ...overrides,
});

const stageEvidence = (overrides = {}) => ({
  providerStatus: "valid",
  pronunciationScore: 85,
  accuracyScore: 85,
  completenessScore: 95,
  targetPhonemeScore: 80,
  prosodyScore: 70,
  ...overrides,
});

const grade = (context, evidence, cefr = "A2") =>
  gradePronunciation({ context, cefr, evidence });

for (const [field, boundary] of [
  ["pronunciationScore", 82],
  ["targetPhonemeScore", 75],
]) {
  assert.equal(grade("word", wordEvidence({ [field]: boundary - 1 })).outcome, "retry", `word ${field} rejects one below`);
  assert.equal(grade("word", wordEvidence({ [field]: boundary })).outcome, "mastered", `word ${field} accepts boundary`);
  assert.equal(grade("word", wordEvidence({ [field]: boundary + 1 })).outcome, "mastered", `word ${field} accepts one above`);
}

assert.deepEqual(
  grade("word", wordEvidence({ pronunciationScore: 81 })),
  {
    policyVersion: "latam-v1",
    outcome: "retry",
    reasons: ["below-threshold-pronunciation-score"],
  },
  "threshold failures expose a stable reason code",
);

assert.deepEqual(
  grade("word", wordEvidence({ minimalPairSubstitution: true })),
  {
    policyVersion: "latam-v1",
    outcome: "retry",
    reasons: ["minimal-pair-substitution"],
  },
  "a minimal-pair substitution fails a target word",
);
assert.deepEqual(
  grade("word", wordEvidence({ targetRecognized: false })),
  {
    policyVersion: "latam-v1",
    outcome: "retry",
    reasons: ["target-not-recognized"],
  },
  "an unrecognized target fails a target word",
);

for (const [field, boundary] of [
  ["pronunciationScore", 78],
  ["accuracyScore", 78],
  ["completenessScore", 90],
  ["lowestTargetWordScore", 70],
  ["prosodyScore", 65],
]) {
  assert.equal(grade("daily-phrase", phraseEvidence({ [field]: boundary - 1 })).outcome, "retry", `daily phrase ${field} rejects one below`);
  assert.equal(grade("daily-phrase", phraseEvidence({ [field]: boundary })).outcome, "mastered", `daily phrase ${field} accepts boundary`);
  assert.equal(grade("daily-phrase", phraseEvidence({ [field]: boundary + 1 })).outcome, "mastered", `daily phrase ${field} accepts one above`);
}

for (const cefr of ["A0", "A1"]) {
  assert.deepEqual(
    grade("daily-phrase", phraseEvidence({ prosodyScore: 0 }), cefr),
    {
      policyVersion: "latam-v1",
      outcome: "mastered",
      reasons: ["prosody-diagnostic"],
    },
    `${cefr} phrase prosody remains diagnostic`,
  );
}
assert.deepEqual(
  grade("daily-phrase", phraseEvidence({ prosodyScore: undefined })),
  {
    policyVersion: "latam-v1",
    outcome: "diagnostic",
    reasons: ["missing-prosody-score"],
  },
  "A2+ phrase cannot master when prosody availability is unknown",
);

for (const [overrides, reason] of [
  [{ targetRecognized: false }, "target-not-recognized"],
  [{ minimalPairSubstitution: true }, "minimal-pair-substitution"],
]) {
  assert.deepEqual(
    grade("daily-phrase", phraseEvidence(overrides)),
    {
      policyVersion: "latam-v1",
      outcome: "retry",
      reasons: [reason],
    },
    `daily phrase applies ${reason}`,
  );
}

assert.deepEqual(
  grade("daily-phrase", phraseEvidence({
    pronunciationScore: 77,
    accuracyScore: 77,
    completenessScore: 89,
    lowestTargetWordScore: 69,
    prosodyScore: 64,
    targetRecognized: false,
    minimalPairSubstitution: true,
  })),
  {
    policyVersion: "latam-v1",
    outcome: "retry",
    reasons: [
      "below-threshold-pronunciation-score",
      "below-threshold-accuracy-score",
      "below-threshold-completeness-score",
      "below-threshold-lowest-target-word-score",
      "below-threshold-prosody-score",
      "target-not-recognized",
      "minimal-pair-substitution",
    ],
  },
  "simultaneous hard failures preserve deterministic policy order",
);

for (const [field, boundary] of [
  ["pronunciationScore", 85],
  ["accuracyScore", 85],
  ["completenessScore", 95],
  ["targetPhonemeScore", 80],
  ["prosodyScore", 70],
]) {
  assert.equal(grade("stage", stageEvidence({ [field]: boundary - 1 })).outcome, "retry", `stage ${field} rejects one below`);
  assert.equal(grade("stage", stageEvidence({ [field]: boundary })).outcome, "mastered", `stage ${field} accepts boundary`);
  assert.equal(grade("stage", stageEvidence({ [field]: boundary + 1 })).outcome, "mastered", `stage ${field} accepts one above`);
}

for (const cefr of ["A0", "A1"]) {
  assert.deepEqual(
    grade("stage", stageEvidence({ prosodyScore: 0 }), cefr),
    {
      policyVersion: "latam-v1",
      outcome: "mastered",
      reasons: ["prosody-diagnostic"],
    },
    `${cefr} stage prosody remains diagnostic`,
  );
}
assert.deepEqual(
  grade("stage", stageEvidence({ prosodyScore: undefined })),
  {
    policyVersion: "latam-v1",
    outcome: "diagnostic",
    reasons: ["missing-prosody-score"],
  },
  "A2+ stage cannot master when prosody availability is unknown",
);

for (const [overrides, reason] of [
  [{ targetRecognized: false }, "target-not-recognized"],
  [{ minimalPairSubstitution: true }, "minimal-pair-substitution"],
]) {
  assert.deepEqual(
    grade("stage", stageEvidence(overrides)),
    {
      policyVersion: "latam-v1",
      outcome: "retry",
      reasons: [reason],
    },
    `stage applies ${reason}`,
  );
}

for (const [context, completeEvidence, requiredFields] of [
  ["word", wordEvidence(), ["pronunciationScore", "targetPhonemeScore", "targetRecognized"]],
  ["daily-phrase", phraseEvidence(), ["pronunciationScore", "accuracyScore", "completenessScore", "lowestTargetWordScore", "prosodyScore"]],
  ["stage", stageEvidence(), ["pronunciationScore", "accuracyScore", "completenessScore", "targetPhonemeScore", "prosodyScore"]],
]) {
  for (const field of requiredFields) {
    const evidence = { ...completeEvidence };
    delete evidence[field];
    const verdict = grade(context, evidence);
    assert.equal(verdict.outcome, "diagnostic", `${context} does not convert absent ${field} to zero`);
    assert.ok(verdict.reasons.includes(`missing-${field.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`));
  }
}

assert.deepEqual(
  grade("free", phraseEvidence()),
  {
    policyVersion: "latam-v1",
    outcome: "diagnostic",
    reasons: ["free-speech-diagnostic"],
  },
  "free speech never returns mastered",
);

for (const [providerStatus, reason] of [
  ["technical-skip", "provider-technical-skip"],
  ["unavailable", "provider-unavailable"],
]) {
  assert.deepEqual(
    grade("word", { providerStatus }),
    {
      policyVersion: "latam-v1",
      outcome: "technical-skip",
      reasons: [reason],
    },
    `${providerStatus} cannot pass or fail`,
  );
}

for (const field of [
  "pronunciationScore",
  "accuracyScore",
  "fluencyScore",
  "completenessScore",
  "prosodyScore",
  "targetPhonemeScore",
  "lowestTargetWordScore",
]) {
  for (const invalid of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => grade("free", { providerStatus: "valid", [field]: invalid }),
      new RegExp(`Invalid ${field}`),
      `${field} rejects ${String(invalid)}`,
    );
  }
}

assert.equal(PRONUNCIATION_POLICY_VERSION, "latam-v1");
console.log(`${checks} ok, 0 failed`);
