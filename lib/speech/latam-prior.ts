/**
 * Initial curriculum ordering for pronunciation features that are often useful
 * to adult LATAM learners. This is a tie-breaker, never a claim about a learner.
 */
export const LATAM_PRONUNCIATION_FEATURES = [
  "short-i-long-ee",
  "foot-goose",
  "trap-dress",
  "strut-lot",
  "b-v",
  "dzh-y",
  "sh-ch",
  "th",
  "initial-s-cluster",
  "final-endings",
  "final-clusters",
  "h",
  "rhotic-r",
  "schwa",
  "word-stress",
  "sentence-rhythm",
  "connected-speech",
  "flap",
] as const;

export type LatamPronunciationFeature = (typeof LATAM_PRONUNCIATION_FEATURES)[number];
export type PronunciationCueKey = `pronunciation.cue.es.${LatamPronunciationFeature}`;
export type PronunciationImpact = "word-identity" | "omitted-ending" | "intelligibility" | "rhythm-fluency";

export type PronunciationTargetMetadata =
  | {
      kind: "final-ending";
      text: string;
      lessonIpa: string;
      phonemes: readonly string[];
      finalEnding: { index: number; phoneme: "s" | "z" | "t" | "d" };
    }
  | {
      kind: "flap";
      text: string;
      lessonIpa: string;
      phonemes: readonly string[];
      flap: { index: number; phoneme: "t" | "d"; left: string; right: string };
    };

/**
 * Explicit en-US target metadata for every shipped ending/flap curriculum word.
 * Keys are real lesson item ids so lesson drift fails the diagnosis contract test.
 */
export const PRONUNCIATION_TARGET_METADATA: Readonly<Record<string, PronunciationTargetMetadata>> = Object.freeze({
  "ed-endings:walked": { kind: "final-ending", text: "walked", lessonIpa: "/wɔːkt/", phonemes: ["w", "ɔ", "k", "t"], finalEnding: { index: 3, phoneme: "t" } },
  "ed-endings:helped": { kind: "final-ending", text: "helped", lessonIpa: "/hɛlpt/", phonemes: ["h", "ɛ", "l", "p", "t"], finalEnding: { index: 4, phoneme: "t" } },
  "ed-endings:asked": { kind: "final-ending", text: "asked", lessonIpa: "/æskt/", phonemes: ["æ", "s", "k", "t"], finalEnding: { index: 3, phoneme: "t" } },
  "ed-endings:watched": { kind: "final-ending", text: "watched", lessonIpa: "/wɑːtʃt/", phonemes: ["w", "ɑ", "tʃ", "t"], finalEnding: { index: 3, phoneme: "t" } },
  "ed-endings:played": { kind: "final-ending", text: "played", lessonIpa: "/pleɪd/", phonemes: ["p", "l", "eɪ", "d"], finalEnding: { index: 3, phoneme: "d" } },
  "ed-endings:lived": { kind: "final-ending", text: "lived", lessonIpa: "/lɪvd/", phonemes: ["l", "ɪ", "v", "d"], finalEnding: { index: 3, phoneme: "d" } },
  "ed-endings:called": { kind: "final-ending", text: "called", lessonIpa: "/kɔːld/", phonemes: ["k", "ɔ", "l", "d"], finalEnding: { index: 3, phoneme: "d" } },
  "ed-endings:used": { kind: "final-ending", text: "used", lessonIpa: "/juːzd/", phonemes: ["j", "u", "z", "d"], finalEnding: { index: 3, phoneme: "d" } },
  "ed-endings:wanted": { kind: "final-ending", text: "wanted", lessonIpa: "/ˈwɑːntɪd/", phonemes: ["w", "ɑ", "n", "t", "ɪ", "d"], finalEnding: { index: 5, phoneme: "d" } },
  "ed-endings:needed": { kind: "final-ending", text: "needed", lessonIpa: "/ˈniːdɪd/", phonemes: ["n", "i", "d", "ɪ", "d"], finalEnding: { index: 4, phoneme: "d" } },
  "ed-endings:started": { kind: "final-ending", text: "started", lessonIpa: "/ˈstɑːrtɪd/", phonemes: ["s", "t", "ɑ", "ɻ", "t", "ɪ", "d"], finalEnding: { index: 6, phoneme: "d" } },
  "ed-endings:decided": { kind: "final-ending", text: "decided", lessonIpa: "/dɪˈsaɪdɪd/", phonemes: ["d", "ɪ", "s", "aɪ", "d", "ɪ", "d"], finalEnding: { index: 6, phoneme: "d" } },
  "flap-t:water": { kind: "flap", text: "water", lessonIpa: "/ˈwɔːtər/", phonemes: ["w", "ɔ", "t", "ɚ"], flap: { index: 2, phoneme: "t", left: "ɔ", right: "ɚ" } },
  "flap-t:better": { kind: "flap", text: "better", lessonIpa: "/ˈbɛtər/", phonemes: ["b", "ɛ", "t", "ɚ"], flap: { index: 2, phoneme: "t", left: "ɛ", right: "ɚ" } },
  "flap-t:letter": { kind: "flap", text: "letter", lessonIpa: "/ˈlɛtər/", phonemes: ["l", "ɛ", "t", "ɚ"], flap: { index: 2, phoneme: "t", left: "ɛ", right: "ɚ" } },
  "flap-t:city": { kind: "flap", text: "city", lessonIpa: "/ˈsɪti/", phonemes: ["s", "ɪ", "t", "i"], flap: { index: 2, phoneme: "t", left: "ɪ", right: "i" } },
  "flap-t:party": { kind: "flap", text: "party", lessonIpa: "/ˈpɑːrti/", phonemes: ["p", "ɑ", "ɻ", "t", "i"], flap: { index: 3, phoneme: "t", left: "ɻ", right: "i" } },
  "flap-t:later": { kind: "flap", text: "later", lessonIpa: "/ˈleɪtər/", phonemes: ["l", "eɪ", "t", "ɚ"], flap: { index: 2, phoneme: "t", left: "eɪ", right: "ɚ" } },
  "flap-t:pretty": { kind: "flap", text: "pretty", lessonIpa: "/ˈprɪti/", phonemes: ["p", "ɻ", "ɪ", "t", "i"], flap: { index: 3, phoneme: "t", left: "ɪ", right: "i" } },
  "flap-t:daughter": { kind: "flap", text: "daughter", lessonIpa: "/ˈdɔːtər/", phonemes: ["d", "ɔ", "t", "ɚ"], flap: { index: 2, phoneme: "t", left: "ɔ", right: "ɚ" } },
  "flap-t:computer": { kind: "flap", text: "computer", lessonIpa: "/kəmˈpjuːtər/", phonemes: ["k", "ə", "m", "p", "j", "u", "t", "ɚ"], flap: { index: 6, phoneme: "t", left: "u", right: "ɚ" } },
  "flap-t:thirty": { kind: "flap", text: "thirty", lessonIpa: "/ˈθɜːrti/", phonemes: ["θ", "ɝ", "t", "i"], flap: { index: 2, phoneme: "t", left: "ɝ", right: "i" } },
});

export interface LatamPriorEntry {
  feature: LatamPronunciationFeature;
  target: string;
  likelySubstitution: string;
  cueKey: PronunciationCueKey;
  impact: PronunciationImpact;
  priorOrder: number;
}

const entries: readonly LatamPriorEntry[] = [
  { feature: "short-i-long-ee", target: "/ɪ/ – /iː/", likelySubstitution: "/i/", cueKey: "pronunciation.cue.es.short-i-long-ee", impact: "word-identity", priorOrder: 0 },
  { feature: "foot-goose", target: "/ʊ/ – /uː/", likelySubstitution: "/u/", cueKey: "pronunciation.cue.es.foot-goose", impact: "word-identity", priorOrder: 1 },
  { feature: "trap-dress", target: "/æ/ – /ɛ/", likelySubstitution: "/a/ or /e/", cueKey: "pronunciation.cue.es.trap-dress", impact: "word-identity", priorOrder: 2 },
  { feature: "strut-lot", target: "/ʌ/ – /ɑ/", likelySubstitution: "/a/", cueKey: "pronunciation.cue.es.strut-lot", impact: "word-identity", priorOrder: 3 },
  { feature: "b-v", target: "/b/ – /v/", likelySubstitution: "/b/", cueKey: "pronunciation.cue.es.b-v", impact: "word-identity", priorOrder: 4 },
  { feature: "dzh-y", target: "/dʒ/ – /j/", likelySubstitution: "/j/", cueKey: "pronunciation.cue.es.dzh-y", impact: "word-identity", priorOrder: 5 },
  { feature: "sh-ch", target: "/ʃ/ – /tʃ/", likelySubstitution: "/tʃ/", cueKey: "pronunciation.cue.es.sh-ch", impact: "word-identity", priorOrder: 6 },
  { feature: "th", target: "/θ/ and /ð/", likelySubstitution: "/t/, /d/, or /s/", cueKey: "pronunciation.cue.es.th", impact: "word-identity", priorOrder: 7 },
  { feature: "initial-s-cluster", target: "initial /s/ + consonant", likelySubstitution: "/es/ + consonant", cueKey: "pronunciation.cue.es.initial-s-cluster", impact: "intelligibility", priorOrder: 8 },
  { feature: "final-endings", target: "final /s/, /z/, /t/, or /d/", likelySubstitution: "∅", cueKey: "pronunciation.cue.es.final-endings", impact: "omitted-ending", priorOrder: 9 },
  { feature: "final-clusters", target: "final consonant cluster", likelySubstitution: "reduced cluster", cueKey: "pronunciation.cue.es.final-clusters", impact: "omitted-ending", priorOrder: 10 },
  { feature: "h", target: "/h/", likelySubstitution: "omitted /h/ or /x/", cueKey: "pronunciation.cue.es.h", impact: "intelligibility", priorOrder: 11 },
  { feature: "rhotic-r", target: "/ɹ/", likelySubstitution: "/r/ or omitted /ɹ/", cueKey: "pronunciation.cue.es.rhotic-r", impact: "intelligibility", priorOrder: 12 },
  { feature: "schwa", target: "/ə/", likelySubstitution: "full vowel", cueKey: "pronunciation.cue.es.schwa", impact: "rhythm-fluency", priorOrder: 13 },
  { feature: "word-stress", target: "/ˈ/ word stress", likelySubstitution: "equal stress", cueKey: "pronunciation.cue.es.word-stress", impact: "rhythm-fluency", priorOrder: 14 },
  { feature: "sentence-rhythm", target: "stressed and reduced syllables", likelySubstitution: "syllable-timed rhythm", cueKey: "pronunciation.cue.es.sentence-rhythm", impact: "rhythm-fluency", priorOrder: 15 },
  { feature: "connected-speech", target: "/‿/ linking", likelySubstitution: "separated words", cueKey: "pronunciation.cue.es.connected-speech", impact: "rhythm-fluency", priorOrder: 16 },
  { feature: "flap", target: "/ɾ/", likelySubstitution: "/t/", cueKey: "pronunciation.cue.es.flap", impact: "rhythm-fluency", priorOrder: 17 },
];

export const LATAM_PRONUNCIATION_PRIOR: Readonly<Record<LatamPronunciationFeature, LatamPriorEntry>> =
  Object.freeze(Object.fromEntries(entries.map((entry) => [entry.feature, Object.freeze(entry)]))) as Readonly<Record<LatamPronunciationFeature, LatamPriorEntry>>;

export function isLatamPronunciationFeature(value: unknown): value is LatamPronunciationFeature {
  return typeof value === "string" && Object.hasOwn(LATAM_PRONUNCIATION_PRIOR, value);
}
