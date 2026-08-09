import assert from "node:assert/strict";
import {
  derivePersonalWeaknesses,
  diagnosePronunciation,
  isSoundWeakness,
} from "./pronunciation-diagnosis.ts";
import {
  LATAM_PRONUNCIATION_PRIOR,
  PRONUNCIATION_TARGET_METADATA,
} from "./latam-prior.ts";
import { LESSON_BY_ID } from "../content/lessons.ts";

let checks = 0;
const eq = (actual, expected, message) => {
  checks += 1;
  assert.deepEqual(actual, expected, message);
};

const validEvidence = (overrides = {}) => ({
  provider: "azure",
  providerStatus: "valid",
  recognizedText: "The message was clear.",
  pronunciationScore: 92,
  accuracyScore: 93,
  fluencyScore: 90,
  completenessScore: 100,
  prosodyScore: 84,
  words: [{
    word: "clear",
    accuracyScore: 92,
    errorType: "None",
    phonemes: [{ phoneme: "k", accuracyScore: 92 }],
  }],
  ...overrides,
});

const weakness = (feature, overrides = {}) => ({
  feature,
  evidenceStatus: "valid",
  score: 58,
  validAttempts: 3,
  ...overrides,
});

const permutations = (values) => {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, candidateIndex) => candidateIndex !== index))
    .map((tail) => [value, ...tail]));
};

for (const [lessonId, kind, expectedCount] of [
  ["ed-endings", "final-ending", 12],
  ["flap-t", "flap", 10],
]) {
  const lesson = LESSON_BY_ID.get(lessonId);
  assert.ok(lesson, `${lessonId} lesson must exist`);
  const shippedWordItems = lesson.items.filter((item) => item.kind === "word");
  const metadataEntries = Object.entries(PRONUNCIATION_TARGET_METADATA)
    .filter(([, metadata]) => metadata.kind === kind);
  eq(shippedWordItems.length, expectedCount, `${lessonId} has the reviewed shipped target count`);
  eq(
    metadataEntries.map(([itemId]) => itemId).sort(),
    shippedWordItems.map(({ id }) => id).sort(),
    `${lessonId} metadata covers every real shipped word and has no stale extras`,
  );
  for (const item of shippedWordItems) {
    const metadata = PRONUNCIATION_TARGET_METADATA[item.id];
    eq(metadata?.text, item.text.toLowerCase(), `${item.id} metadata is bound to the real lesson target`);
    eq(metadata?.lessonIpa, item.ipa, `${item.id} metadata is bound to the shipped lesson IPA`);
    eq(metadata?.phonemes.length > 0, true, `${item.id} has an explicit ordered IPA sequence`);
    if (metadata?.kind === "final-ending") {
      eq(metadata.finalEnding.index, metadata.phonemes.length - 1, `${item.id} ending metadata points to the actual final IPA position`);
      eq(metadata.phonemes[metadata.finalEnding.index], metadata.finalEnding.phoneme, `${item.id} ending metadata matches its actual final IPA`);
    } else if (metadata?.kind === "flap") {
      const { index, phoneme, left, right } = metadata.flap;
      eq(metadata.phonemes[index], phoneme, `${item.id} flap metadata points to the actual target phoneme`);
      eq(metadata.phonemes[index - 1], left, `${item.id} flap metadata records its actual left context`);
      eq(metadata.phonemes[index + 1], right, `${item.id} flap metadata records its actual right context`);
    }
  }
}

const expectedFeatures = [
  ["short-i-long-ee", "/ɪ/ – /iː/", "/i/", "pronunciation.cue.es.short-i-long-ee"],
  ["foot-goose", "/ʊ/ – /uː/", "/u/", "pronunciation.cue.es.foot-goose"],
  ["trap-dress", "/æ/ – /ɛ/", "/a/ or /e/", "pronunciation.cue.es.trap-dress"],
  ["strut-lot", "/ʌ/ – /ɑ/", "/a/", "pronunciation.cue.es.strut-lot"],
  ["b-v", "/b/ – /v/", "/b/", "pronunciation.cue.es.b-v"],
  ["dzh-y", "/dʒ/ – /j/", "/j/", "pronunciation.cue.es.dzh-y"],
  ["sh-ch", "/ʃ/ – /tʃ/", "/tʃ/", "pronunciation.cue.es.sh-ch"],
  ["th", "/θ/ and /ð/", "/t/, /d/, or /s/", "pronunciation.cue.es.th"],
  ["initial-s-cluster", "initial /s/ + consonant", "/es/ + consonant", "pronunciation.cue.es.initial-s-cluster"],
  ["final-endings", "final /s/, /z/, /t/, or /d/", "∅", "pronunciation.cue.es.final-endings"],
  ["final-clusters", "final consonant cluster", "reduced cluster", "pronunciation.cue.es.final-clusters"],
  ["h", "/h/", "omitted /h/ or /x/", "pronunciation.cue.es.h"],
  ["rhotic-r", "/ɹ/", "/r/ or omitted /ɹ/", "pronunciation.cue.es.rhotic-r"],
  ["schwa", "/ə/", "full vowel", "pronunciation.cue.es.schwa"],
  ["word-stress", "/ˈ/ word stress", "equal stress", "pronunciation.cue.es.word-stress"],
  ["sentence-rhythm", "stressed and reduced syllables", "syllable-timed rhythm", "pronunciation.cue.es.sentence-rhythm"],
  ["connected-speech", "/‿/ linking", "separated words", "pronunciation.cue.es.connected-speech"],
  ["flap", "/ɾ/", "/t/", "pronunciation.cue.es.flap"],
];

for (const [feature, target, likelySubstitution, cueKey] of expectedFeatures) {
  eq(
    LATAM_PRONUNCIATION_PRIOR[feature],
    {
      ...LATAM_PRONUNCIATION_PRIOR[feature],
      feature,
      target,
      likelySubstitution,
      cueKey,
    },
    `${feature} has an American-English target, likely contrast, and Spanish articulation cue key`,
  );
}

const threeEvidence = validEvidence({
  recognizedText: "tree",
  words: [{
    word: "three",
    accuracyScore: 54,
    errorType: "Mispronunciation",
    phonemes: [
      { phoneme: "θ", accuracyScore: 42 },
      { phoneme: "ɹ", accuracyScore: 88 },
      { phoneme: "iː", accuracyScore: 91 },
    ],
  }],
});
eq(
  diagnosePronunciation({
    evidence: threeEvidence,
    targetItemId: "th:three",
    personalWeaknesses: [weakness("b-v", { score: 22, validAttempts: 12 })],
  })?.cueKey,
  "pronunciation.cue.es.th",
  "unrelated b-v history cannot outrank the current actionable /th/ target in three",
);
eq(
  diagnosePronunciation({
    evidence: threeEvidence,
    targetItemId: "th:three",
    personalWeaknesses: [weakness("th", { score: 58, validAttempts: 4 })],
  })?.source,
  "personal-evidence",
  "matching personal /th/ weakness outranks provider evidence for the current target",
);

for (const [targetItemId, feature, word, phonemes, message] of [
  ["s-clusters:stop", "initial-s-cluster", "stop", ["s", "t", "ɑ", "p"], "provider IPA exposes the current initial-cluster feature"],
  ["ed-endings:walked", "final-endings", "walked", ["w", "ɔ", "k", "t"], "explicit target metadata exposes the current final-ending feature"],
  ["flap-t:water", "flap", "water", ["w", "ɔ", "t", "ɚ"], "explicit target metadata exposes the current flap feature"],
]) {
  const result = diagnosePronunciation({
    targetItemId,
    evidence: validEvidence({
      recognizedText: word,
      words: [{
        word,
        accuracyScore: 82,
        errorType: "Mispronunciation",
        phonemes: phonemes.map((phoneme) => ({ phoneme, accuracyScore: 82 })),
      }],
    }),
    personalWeaknesses: [weakness(feature, { score: 45, validAttempts: 5 })],
  });
  eq(result?.source, "personal-evidence", message);
  eq(result?.cueKey, `pronunciation.cue.es.${feature}`, `${message} without inferring from spelling`);
}

const providerV = diagnosePronunciation({
  evidence: validEvidence({
    recognizedText: "very",
    words: [{
      word: "very",
      accuracyScore: 55,
      errorType: "Mispronunciation",
      phonemes: [
        { phoneme: "v", accuracyScore: 42 },
        { phoneme: "ɛ", accuracyScore: 88 },
      ],
    }],
  }),
  personalWeaknesses: [],
});
eq(providerV, {
  target: "/b/ – /v/",
  cueKey: "pronunciation.cue.es.b-v",
  contrast: { target: "/b/ – /v/", likelySubstitution: "/b/" },
  source: "provider",
}, "a measured provider phoneme selects a correction without inventing an observed sound");
eq(Object.hasOwn(providerV, "observed"), false, "provider evidence never fabricates the sound the learner produced");

const personalOverProvider = diagnosePronunciation({
  evidence: validEvidence({
    recognizedText: "very",
    words: [{
      word: "very",
      accuracyScore: 20,
      errorType: "Mispronunciation",
      phonemes: [{ phoneme: "v", accuracyScore: 10 }],
    }],
  }),
  personalWeaknesses: [weakness("b-v", { score: 69, validAttempts: 2, observed: "/b/" })],
});
eq(personalOverProvider, {
  target: "/b/ – /v/",
  observed: "/b/",
  cueKey: "pronunciation.cue.es.b-v",
  contrast: { target: "/b/ – /v/", likelySubstitution: "/b/" },
  source: "personal-evidence",
}, "valid measured personal evidence for the current feature outranks the provider and regional prior");

const tieEvidence = validEvidence({
  recognizedText: "very think",
  words: [
    { word: "think", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "θ", accuracyScore: 40 }] },
    { word: "very", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "v", accuracyScore: 40 }] },
  ],
});
const tied = diagnosePronunciation({ evidence: tieEvidence, personalWeaknesses: [] });
eq(tied?.target, "/b/ – /v/", "the LATAM prior breaks an exact provider-evidence tie deterministically");
eq(tied?.source, "latam-prior", "tie-breaking is identified as prior-sourced instead of personal evidence");
eq(
  diagnosePronunciation({ evidence: { ...tieEvidence, words: [...tieEvidence.words].reverse() }, personalWeaknesses: [] }),
  tied,
  "provider input order does not change an exact-tie diagnosis",
);

const historySensitiveTie = validEvidence({
  recognizedText: "foot very",
  words: [
    { word: "foot", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "ʊ", accuracyScore: 40 }] },
    { word: "very", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "v", accuracyScore: 40 }] },
  ],
});
eq(
  diagnosePronunciation({ evidence: historySensitiveTie, personalWeaknesses: [] })?.target,
  "/ʊ/ – /uː/",
  "the regional prior may break an exact provider tie before personal history exists",
);
const historyDisablesPrior = diagnosePronunciation({
  evidence: historySensitiveTie,
  personalWeaknesses: [weakness("foot-goose", { score: 100, validAttempts: 8 })],
});
eq(historyDisablesPrior?.target, "/b/ – /v/", "even non-actionable valid history disables prior tie-breaking for that sound");
eq(historyDisablesPrior?.source, "provider", "a history-aware neutral tie remains provider-sourced, not prior-sourced");

const threeWayTiedWords = [
  { word: "foot", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "ʊ", accuracyScore: 40 }] },
  { word: "very", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "v", accuracyScore: 40 }] },
  { word: "yet", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "j", accuracyScore: 40 }] },
];
for (const words of permutations(threeWayTiedWords)) {
  eq(
    diagnosePronunciation({
      evidence: validEvidence({ recognizedText: "foot very yet", words }),
      personalWeaknesses: [],
    }),
    {
      target: "/ʊ/ – /uː/",
      cueKey: "pronunciation.cue.es.foot-goose",
      contrast: { target: "/ʊ/ – /uː/", likelySubstitution: "/u/" },
      source: "latam-prior",
    },
    "every three-way provider-tie permutation uses one complete-group prior order and source",
  );
  eq(
    diagnosePronunciation({
      evidence: validEvidence({ recognizedText: "foot very yet", words }),
      personalWeaknesses: [weakness("dzh-y", { score: 100, validAttempts: 4 })],
    }),
    {
      target: "/b/ – /v/",
      cueKey: "pronunciation.cue.es.b-v",
      contrast: { target: "/b/ – /v/", likelySubstitution: "/b/" },
      source: "provider",
    },
    "history on any member makes every three-way tie permutation use one neutral group order and provider source",
  );
}

const strongerProviderSignal = diagnosePronunciation({
  evidence: validEvidence({
    recognizedText: "very think",
    words: [
      { word: "very", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [{ phoneme: "v", accuracyScore: 45 }] },
      { word: "think", accuracyScore: 30, errorType: "Mispronunciation", phonemes: [{ phoneme: "θ", accuracyScore: 20 }] },
    ],
  }),
  personalWeaknesses: [],
});
eq(strongerProviderSignal?.target, "/θ/ and /ð/", "stronger provider evidence wins when scores do not tie");
eq(strongerProviderSignal?.source, "provider", "the prior does not override unequal provider evidence");

const identityBeforeEnding = diagnosePronunciation({
  targetItemId: "ed-endings:walked",
  evidence: validEvidence({
    recognizedText: "very walked",
    words: [
      { word: "walked", accuracyScore: 15, errorType: "Mispronunciation", phonemes: [
        { phoneme: "w", accuracyScore: 90 },
        { phoneme: "ɔ", accuracyScore: 90 },
        { phoneme: "k", accuracyScore: 90 },
        { phoneme: "t", accuracyScore: 5 },
      ] },
      { word: "very", accuracyScore: 65, errorType: "Mispronunciation", phonemes: [{ phoneme: "v", accuracyScore: 59 }] },
    ],
  }),
  personalWeaknesses: [],
});
eq(identityBeforeEnding?.target, "/b/ – /v/", "word-identity and minimal-pair errors rank ahead of omitted endings");

const endingBeforeIntelligibility = diagnosePronunciation({
  targetItemId: "ed-endings:walked",
  evidence: validEvidence({
    recognizedText: "walked home",
    words: [
      { word: "home", accuracyScore: 10, errorType: "Mispronunciation", phonemes: [{ phoneme: "h", accuracyScore: 2 }] },
      { word: "walked", accuracyScore: 50, errorType: "Mispronunciation", phonemes: [
        { phoneme: "w", accuracyScore: 90 },
        { phoneme: "ɔ", accuracyScore: 90 },
        { phoneme: "k", accuracyScore: 90 },
        { phoneme: "t", accuracyScore: 49 },
      ] },
    ],
  }),
  personalWeaknesses: [],
});
eq(endingBeforeIntelligibility?.target, "final /s/, /z/, /t/, or /d/", "omitted endings rank ahead of other intelligibility errors");

const intelligibilityBeforeRhythm = diagnosePronunciation({
  evidence: validEvidence({
    fluencyScore: 20,
    recognizedText: "home",
    words: [{ word: "home", accuracyScore: 60, errorType: "Mispronunciation", phonemes: [{ phoneme: "h", accuracyScore: 59 }] }],
  }),
  personalWeaknesses: [],
});
eq(intelligibilityBeforeRhythm?.target, "/h/", "intelligibility errors rank ahead of rhythm and fluency refinements");

const rhythmOnly = diagnosePronunciation({
  evidence: validEvidence({ fluencyScore: 54, prosodyScore: 88 }),
  personalWeaknesses: [],
});
eq(rhythmOnly, null, "aggregate fluency alone does not invent a specific connected-speech defect");
eq(
  diagnosePronunciation({
    evidence: validEvidence({ fluencyScore: 88, prosodyScore: 40 }),
    personalWeaknesses: [],
  }),
  null,
  "aggregate prosody alone does not invent a specific sentence-rhythm defect",
);

const initialS = diagnosePronunciation({
  evidence: validEvidence({
    recognizedText: "stop",
    words: [{ word: "stop", accuracyScore: 55, errorType: "Mispronunciation", phonemes: [
      { phoneme: "s", accuracyScore: 42 },
      { phoneme: "t", accuracyScore: 91 },
      { phoneme: "ɑ", accuracyScore: 90 },
      { phoneme: "p", accuracyScore: 90 },
    ] }],
  }),
  personalWeaknesses: [],
});
eq(initialS?.target, "initial /s/ + consonant", "a measured weak /s/ in an actual initial cluster creates a supported correction");
eq(Object.hasOwn(initialS, "observed"), false, "a cluster score does not prove the learner inserted /e/");
eq(
  diagnosePronunciation({
    evidence: validEvidence({
      recognizedText: "stop",
      words: [{ word: "stop", accuracyScore: 55, errorType: "Mispronunciation", phonemes: [
        { phoneme: "s", accuracyScore: 91 },
        { phoneme: "t", accuracyScore: 42 },
        { phoneme: "ɑ", accuracyScore: 90 },
        { phoneme: "p", accuracyScore: 90 },
      ] }],
    }),
    personalWeaknesses: [],
  })?.target,
  "initial /s/ + consonant",
  "a weak adjacent consonant in an actual initial /s/ cluster is diagnosed from ordered IPA",
);

for (const errorType of ["Omission", "Insertion"]) {
  eq(
    diagnosePronunciation({
      evidence: validEvidence({
        recognizedText: errorType === "Insertion" ? "very extra" : "very",
        words: [{ word: "very", accuracyScore: 10, errorType, phonemes: [{ phoneme: "v", accuracyScore: 5 }] }],
      }),
      personalWeaknesses: [],
    }),
    null,
    `${errorType} word evidence is not reinterpreted as a measured target-sound substitution`,
  );
}

const finalCluster = diagnosePronunciation({
  evidence: validEvidence({
    recognizedText: "world",
    words: [{ word: "world", accuracyScore: 54, errorType: "Mispronunciation", phonemes: [
      { phoneme: "w", accuracyScore: 90 },
      { phoneme: "ɹ", accuracyScore: 90 },
      { phoneme: "l", accuracyScore: 55 },
      { phoneme: "d", accuracyScore: 44 },
    ] }],
  }),
  personalWeaknesses: [],
});
eq(finalCluster?.target, "final consonant cluster", "a measured weak final cluster creates a final-cluster correction");

for (const [word, phonemes, expectedTarget, message] of [
  ["scent", [
    { phoneme: "s", accuracyScore: 90 },
    { phoneme: "ɛ", accuracyScore: 90 },
    { phoneme: "n", accuracyScore: 90 },
    { phoneme: "t", accuracyScore: 42 },
  ], "final consonant cluster", "ordered IPA detects the pronounced final cluster despite irregular spelling"],
  ["autumn", [
    { phoneme: "ɔ", accuracyScore: 90 },
    { phoneme: "t", accuracyScore: 90 },
    { phoneme: "ə", accuracyScore: 90 },
    { phoneme: "m", accuracyScore: 42 },
  ], undefined, "silent spelling letters do not invent a final cluster"],
  ["house", [
    { phoneme: "h", accuracyScore: 90 },
    { phoneme: "aʊ", accuracyScore: 90 },
    { phoneme: "s", accuracyScore: 42 },
  ], undefined, "a written final e does not turn actual final /s/ into a cluster or morphology claim"],
  ["island", [
    { phoneme: "aɪ", accuracyScore: 42 },
    { phoneme: "l", accuracyScore: 90 },
    { phoneme: "ə", accuracyScore: 90 },
    { phoneme: "n", accuracyScore: 90 },
    { phoneme: "d", accuracyScore: 90 },
  ], undefined, "written initial s is ignored when ordered IPA does not begin with /s/"],
]) {
  const result = diagnosePronunciation({
    evidence: validEvidence({
      recognizedText: word,
      words: [{ word, accuracyScore: 55, errorType: "Mispronunciation", phonemes }],
    }),
    personalWeaknesses: [],
  });
  eq(result?.target, expectedTarget, message);
}
eq(
  diagnosePronunciation({
    evidence: validEvidence({
      recognizedText: "hand",
      words: [{ word: "hand", accuracyScore: 55, errorType: "Mispronunciation", phonemes: [
        { phoneme: "h", accuracyScore: 90 },
        { phoneme: "æ", accuracyScore: 90 },
        { phoneme: "n", accuracyScore: 42 },
        { phoneme: "d", accuracyScore: 90 },
      ] }],
    }),
    personalWeaknesses: [],
  })?.target,
  "final consonant cluster",
  "a weak member of an actual ordered final consonant cluster is actionable even when the last member scored well",
);
for (const weakIndex of [2, 3, 4, 5]) {
  const phones = ["t", "ɛ", "k", "s", "t", "s"].map((phoneme, index) => ({
    phoneme,
    accuracyScore: index === weakIndex ? 42 : 91,
  }));
  eq(
    diagnosePronunciation({
      evidence: validEvidence({
        recognizedText: "texts",
        words: [{ word: "texts", accuracyScore: 55, errorType: "Mispronunciation", phonemes: phones }],
      }),
      personalWeaknesses: [],
    })?.target,
    "final consonant cluster",
    `maximal terminal /ksts/ run diagnoses its weak member at IPA index ${weakIndex}`,
  );
}

const realAzureRhotic = diagnosePronunciation({
  evidence: validEvidence({
    recognizedText: "right",
    words: [{ word: "right", accuracyScore: 52, errorType: "Mispronunciation", phonemes: [
      { phoneme: "ɻ", accuracyScore: 40 },
      { phoneme: "aɪ", accuracyScore: 91 },
      { phoneme: "t", accuracyScore: 92 },
    ] }],
  }),
  personalWeaknesses: [],
});
eq(realAzureRhotic?.target, "/ɹ/", "Azure en-US retroflex /ɻ/ maps to the American rhotic coaching target");

const knownFlapTarget = diagnosePronunciation({
  targetItemId: "flap-t:water",
  evidence: validEvidence({
    recognizedText: "water",
    words: [{ word: "water", accuracyScore: 54, errorType: "Mispronunciation", phonemes: [
      { phoneme: "w", accuracyScore: 92 },
      { phoneme: "ɔ", accuracyScore: 91 },
      { phoneme: "t", accuracyScore: 43 },
      { phoneme: "ɚ", accuracyScore: 90 },
    ] }],
  }),
  personalWeaknesses: [],
});
eq(knownFlapTarget?.target, "/ɾ/", "a bounded known target plus intervocalic Azure /t/ can select flap coaching");
eq(
  diagnosePronunciation({
    evidence: validEvidence({
      recognizedText: "unknown",
      words: [{ word: "unknown", accuracyScore: 55, errorType: "Mispronunciation", phonemes: [
        { phoneme: "ə", accuracyScore: 90 },
        { phoneme: "t", accuracyScore: 42 },
        { phoneme: "ə", accuracyScore: 90 },
      ] }],
    }),
    personalWeaknesses: [],
  }),
  null,
  "intervocalic /t/ without explicit reliable target metadata does not invent flap coaching",
);
eq(
  diagnosePronunciation({
    evidence: validEvidence({
      recognizedText: "water",
      words: [{ word: "water", accuracyScore: 55, errorType: "Mispronunciation", phonemes: [{ phoneme: "ɾ", accuracyScore: 42 }] }],
    }),
    personalWeaknesses: [],
  }),
  null,
  "literal provider /ɾ/ alone is not treated as reliable target metadata",
);

for (const [targetItemId, metadata] of Object.entries(PRONUNCIATION_TARGET_METADATA)) {
  const weakIndex = metadata.kind === "final-ending" ? metadata.finalEnding.index : metadata.flap.index;
  const words = [{
    word: metadata.text,
    accuracyScore: 55,
    errorType: "Mispronunciation",
    phonemes: metadata.phonemes.map((phoneme, index) => ({ phoneme, accuracyScore: index === weakIndex ? 42 : 91 })),
  }];
  eq(
    diagnosePronunciation({
      targetItemId,
      evidence: validEvidence({ recognizedText: metadata.text, words }),
      personalWeaknesses: [],
    })?.target,
    metadata.kind === "final-ending" ? "final /s/, /z/, /t/, or /d/" : "/ɾ/",
    `${metadata.text} uses its explicit shipped ${metadata.kind} IPA metadata in provider diagnosis`,
  );
}

for (const evidence of [
  { provider: "azure", providerStatus: "technical-skip", recognizedText: "", words: [] },
  { provider: "azure", providerStatus: "unavailable", recognizedText: "", words: [] },
  { provider: "azure", providerStatus: "valid", recognitionReason: "no-match", recognizedText: "", words: [] },
  { provider: "azure", providerStatus: "valid", recognizedText: "ok", words: [{ word: "ok", phonemes: [{ phoneme: "v", accuracyScore: -1 }] }] },
  { provider: "other", providerStatus: "valid", recognizedText: "very", words: [] },
]) {
  eq(
    diagnosePronunciation({ evidence, personalWeaknesses: [weakness("b-v")] }),
    null,
    "invalid, unavailable, or technical provider data cannot create a learner correction",
  );
}

eq(
  diagnosePronunciation({
    evidence: validEvidence({
      pronunciationScore: undefined,
      words: [{ word: "very", errorType: "Mispronunciation", phonemes: [{ phoneme: "v" }] }],
    }),
    personalWeaknesses: [],
  }),
  null,
  "missing word and phoneme scores remain missing rather than becoming zero-strength errors",
);
eq(
  diagnosePronunciation({
    evidence: validEvidence(),
    personalWeaknesses: [
      weakness("b-v", { evidenceStatus: "technical-skip", score: 5 }),
      weakness("th", { score: Number.NaN }),
      weakness("h", { validAttempts: 0 }),
      weakness("unknown-feature"),
      weakness("flap", { observed: "" }),
    ],
  }),
  null,
  "invalid personal weaknesses are ignored and do not become corrections",
);
eq(
  diagnosePronunciation({ evidence: validEvidence(), personalWeaknesses: [] }),
  null,
  "valid evidence with no actionable issue produces no correction",
);
for (const malformedWeaknesses of [null, undefined, {}, "b-v", 7]) {
  eq(
    diagnosePronunciation({ evidence: validEvidence(), personalWeaknesses: malformedWeaknesses }),
    null,
    "a malformed personalWeaknesses container returns null instead of throwing",
  );
}
eq(
  diagnosePronunciation({
    evidence: validEvidence(),
    personalWeaknesses: [weakness("b-v", { score: 100, validAttempts: 8 })],
  }),
  null,
  "a runtime-valid high personal accuracy record is not treated as an actionable weakness",
);

for (const candidate of [
  weakness("b-v"),
  weakness("b-v", { score: 0, validAttempts: 1 }),
  weakness("b-v", { score: 100, validAttempts: 20, observed: "/β/" }),
  weakness("th", { observed: "[t̪]" }),
  weakness("dzh-y", { observed: "/dʒ/" }),
  weakness("foot-goose", { observed: "/aʊ/" }),
  weakness("final-endings", { observed: "∅" }),
  weakness("b-v", { validAttempts: 10_000 }),
]) {
  eq(isSoundWeakness(candidate), true, "bounded measured weakness evidence passes the runtime guard");
}
for (const candidate of [
  null,
  weakness("b-v", { evidenceStatus: "technical-skip" }),
  weakness("b-v", { score: -1 }),
  weakness("b-v", { score: 101 }),
  weakness("b-v", { validAttempts: 1.5 }),
  weakness("b-v", { validAttempts: 10_001 }),
  weakness("b-v", { validAttempts: Number.MAX_SAFE_INTEGER }),
  weakness("b-v", { observed: " " }),
  weakness("b-v", { observed: "student@example.com" }),
  weakness("b-v", { observed: "María" }),
  weakness("b-v", { observed: "/Joel/" }),
  weakness("b-v", { observed: "/maria/" }),
  weakness("b-v", { observed: "/john/" }),
  weakness("b-v", { observed: "<script>alert(1)</script>" }),
  weakness("b-v", { observed: "/v/\nstudent@example.com" }),
  weakness("not-real"),
]) {
  eq(isSoundWeakness(candidate), false, "malformed or non-valid weakness evidence fails the runtime guard");
}

for (const entry of Object.values(LATAM_PRONUNCIATION_PRIOR)) {
  const ipaSubstitutions = [...entry.likelySubstitution.matchAll(/\/[^/]+\//g)].map(([token]) => token);
  if (entry.likelySubstitution === "∅") ipaSubstitutions.push("∅");
  for (const observed of ipaSubstitutions) {
    eq(
      isSoundWeakness(weakness(entry.feature, { observed })),
      true,
      `${entry.feature} catalog substitution ${observed} is accepted by the bounded observation grammar`,
    );
  }
}

const personalOrderA = [
  weakness("connected-speech", { score: 5, validAttempts: 8 }),
  weakness("th", { score: 60, validAttempts: 2 }),
  weakness("b-v", { score: 60, validAttempts: 2 }),
];
const personalOrderB = [...personalOrderA].reverse();
const personalOrderEvidence = validEvidence({
  recognizedText: "very think",
  words: [
    { word: "very", accuracyScore: 85, phonemes: [{ phoneme: "v", accuracyScore: 85 }] },
    { word: "think", accuracyScore: 85, phonemes: [{ phoneme: "θ", accuracyScore: 85 }] },
  ],
});
eq(
  diagnosePronunciation({ evidence: personalOrderEvidence, personalWeaknesses: personalOrderA }),
  diagnosePronunciation({ evidence: personalOrderEvidence, personalWeaknesses: personalOrderB }),
  "multiple personal errors have deterministic category, score, attempt, and neutral-key tie-breaking",
);
eq(
  diagnosePronunciation({ evidence: personalOrderEvidence, personalWeaknesses: personalOrderA })?.target,
  "/b/ – /v/",
  "personal ranking applies impact tier before severity",
);
eq(
  diagnosePronunciation({
    evidence: validEvidence({ words: [{ word: "bit", accuracyScore: 85, phonemes: [{ phoneme: "ɪ", accuracyScore: 85 }, { phoneme: "v", accuracyScore: 85 }] }] }),
    personalWeaknesses: [weakness("short-i-long-ee"), weakness("b-v")],
  })?.target,
  "/b/ – /v/",
  "an exact tie between measured personal weaknesses uses a neutral stable key, not the regional prior",
);

const frozenEvidence = validEvidence({
  recognizedText: "ship",
  words: [Object.freeze({
    word: "ship",
    accuracyScore: 55,
    errorType: "Mispronunciation",
    phonemes: Object.freeze([{ phoneme: "ɪ", accuracyScore: 40 }]),
  })],
});
Object.freeze(frozenEvidence.words);
Object.freeze(frozenEvidence);
const frozenWeaknesses = Object.freeze([Object.freeze(weakness("rhotic-r"))]);
const beforeEvidence = JSON.stringify(frozenEvidence);
const beforeWeaknesses = JSON.stringify(frozenWeaknesses);
const frozenResult = diagnosePronunciation({ evidence: frozenEvidence, personalWeaknesses: frozenWeaknesses });
eq(frozenResult?.target, "/ɪ/ – /iː/", "the selector accepts immutable inputs and ignores unrelated personal evidence");
eq(JSON.stringify(frozenEvidence), beforeEvidence, "assessment evidence is not mutated");
eq(JSON.stringify(frozenWeaknesses), beforeWeaknesses, "personal weakness evidence is not mutated");

const safeOutputs = expectedFeatures.map(([feature]) => diagnosePronunciation({
  evidence: validEvidence(),
  personalWeaknesses: [weakness(feature)],
}));
const serializedSafeOutputs = JSON.stringify(safeOutputs).toLowerCase();
for (const unsafe of ["bad accent", "accento malo", "all spanish", "todos los hispanohablantes", "native-like", "identity"]) {
  eq(serializedSafeOutputs.includes(unsafe), false, `diagnoses avoid accent-shaming or group-wide identity claims: ${unsafe}`);
}
eq(
  Object.keys(providerV).sort(),
  ["contrast", "cueKey", "source", "target"].sort(),
  "the result allowlists coaching fields and does not leak transcripts, words, scores, or raw provider data",
);

eq(
  derivePersonalWeaknesses([
    { providerStatus: "valid", policyVersion: "latam-v1", phoneme: "b", targetPhonemeScore: 40 },
    { providerStatus: "valid", policyVersion: "latam-v1", phoneme: "v", targetPhonemeScore: 60 },
    { providerStatus: "technical-skip", policyVersion: "latam-v1", phoneme: "h", targetPhonemeScore: 0 },
    { providerStatus: "valid", policyVersion: "latam-v1", phoneme: "θ" },
  ]),
  [{ feature: "b-v", evidenceStatus: "valid", score: 50, validAttempts: 2 }],
  "personal weaknesses aggregate only bounded valid measured Task 5 evidence",
);

console.log(`pronunciation diagnosis: ${checks} checks passed`);
