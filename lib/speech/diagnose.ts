import { normalize, similarity } from "./scoring";

// Pinpoint feedback: when an attempt misses, figure out WHICH word went wrong
// and — when the miss matches a known Spanish-speaker error pattern — WHICH
// sound to fix, so the result card can say "'three' sonó como 'tree' — el
// sonido TH" and link the lesson that fixes it. This is a rule-based
// approximation of phoneme-level assessment built purely from the transcript;
// a paid phoneme API (Azure/Speechace) could later replace `detect` without
// touching the UI.

export interface WordMiss {
  expected: string;
  heard: string | null; // null = the word was dropped entirely
  /** True when acoustic assessment flagged the word as mispronounced (not dropped). */
  mispronounced?: boolean;
}

export interface SoundDiagnosis {
  /** Sound category AND lesson id (they match for the sounds track). */
  categoryId: string;
  wrong: WordMiss;
  tip: { es: string; en: string };
}

export interface Diagnosis {
  misses: WordMiss[];
  sound: SoundDiagnosis | null;
}

const TIPS: Record<string, { es: string; en: string }> = {
  th: {
    es: "El sonido TH — pon la punta de la lengua entre los dientes, no digas t, d ni s.",
    en: "The TH sound — tongue tip between your teeth; not t, d, or s.",
  },
  "b-vs-v": {
    es: "B vs V — para la v, dientes sobre el labio y que vibre; para la b, los labios se tocan.",
    en: "B vs V — for v, teeth on lip with a buzz; for b, the lips touch.",
  },
  "dj-vs-y": {
    es: "J vs Y — la j inglesa vibra (como en 'gym'); la y es suave, sin fricción.",
    en: "J vs Y — English j buzzes (like 'gym'); y glides softly with no friction.",
  },
  "s-clusters": {
    es: "No pongas una 'e' antes de la s: empieza en el siseo — sss-peak, no 'espeak'.",
    en: "No 'e' before the s — start on the hiss: sss-peak, not 'espeak'.",
  },
  "ed-endings": {
    es: "La terminación -ed se perdió — termina la palabra: 'walkt', 'playd'.",
    en: "The -ed ending got dropped — finish the word: 'walkt', 'playd'.",
  },
  "final-clusters": {
    es: "Las consonantes finales se cortaron — di cada una hasta el final.",
    en: "The final consonants got chopped — land every one of them.",
  },
  "i-vs-ii": {
    es: "I corta vs ii larga — relajada y rapidita (ship) o sonriente y larga (sheep).",
    en: "Short i vs long ee — quick and lazy (ship) or wide and long (sheep).",
  },
  h: {
    es: "La H — un soplido suave al inicio, sin raspar la garganta (y no te la comas).",
    en: "The H — a soft breath at the start; don't scrape it, don't drop it.",
  },
  schwa: {
    es: "La schwa — relaja las vocales sin acento en un 'uh' perezoso: a-BOUT, ba-NA-na.",
    en: "The schwa — relax unstressed vowels into a lazy 'uh': a-BOUT, ba-NA-na.",
  },
  "american-r": {
    es: "La R americana — curva la lengua hacia atrás sin tocar nada, y dila hasta al final.",
    en: "The American R — curl the tongue back touching nothing, and say it even at the end.",
  },
  "flap-t": {
    es: "La T americana — entre vocales es una d suave y rápida: 'water' → 'GUA-der'.",
    en: "The American T — between vowels it's a quick soft d: 'water' → 'wah-der'.",
  },
};

// Azure returns IPA phonemes; map the ones with a dedicated lesson.
const PHONEME_CATEGORY: Record<string, string> = {
  "θ": "th",
  "ð": "th",
  v: "b-vs-v",
  b: "b-vs-v",
  "dʒ": "dj-vs-y",
  j: "dj-vs-y",
  "ɪ": "i-vs-ii",
  i: "i-vs-ii",
  "iː": "i-vs-ii",
  h: "h",
  "ə": "schwa",
  "ɹ": "american-r",
  r: "american-r",
  "ɾ": "flap-t",
};

interface AssessedWordLike {
  word: string;
  accuracy: number;
  errorType: string;
  phonemes: { p: string; accuracy: number }[];
}

/**
 * Turn phoneme-level assessment into pinpoint feedback: the worst-scoring word,
 * and — when its weakest phoneme has a dedicated lesson — the sound to fix.
 */
export function diagnoseAssessment(words: AssessedWordLike[], targetText: string): Diagnosis {
  const problems = words
    .filter((w) => w.errorType === "Omission" || w.errorType === "Mispronunciation" || w.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy);
  if (!problems.length) return { misses: [], sound: null };

  const misses: WordMiss[] = problems.map((w) => ({
    expected: w.word,
    heard: null,
    mispronounced: w.errorType !== "Omission",
  }));

  for (const w of problems) {
    if (w.errorType === "Omission") {
      const textual = detect(w.word, null);
      if (textual) return { misses, sound: textual };
      continue;
    }
    const worst = [...w.phonemes].sort((a, b) => a.accuracy - b.accuracy).find((p) => p.accuracy < 60);
    const categoryId = worst ? PHONEME_CATEGORY[worst.p] : undefined;
    if (categoryId && TIPS[categoryId]) {
      return {
        misses,
        sound: { categoryId, wrong: { expected: w.word, heard: null, mispronounced: true }, tip: TIPS[categoryId] },
      };
    }
  }
  // No lesson-mapped phoneme — fall back to naming the worst word only.
  void targetText;
  return { misses, sound: null };
}

function d(categoryId: string, wrong: WordMiss): SoundDiagnosis {
  return { categoryId, wrong, tip: TIPS[categoryId] };
}

const CONSONANT = /[bcdfghjklmnpqrstvwxz]/;

function endsInCluster(w: string): boolean {
  return w.length >= 3 && CONSONANT.test(w[w.length - 1]) && CONSONANT.test(w[w.length - 2]);
}

/** Try to identify the Spanish-speaker error pattern in one word substitution. */
export function detect(expectedRaw: string, heardRaw: string | null): SoundDiagnosis | null {
  const e = normalize(expectedRaw);
  if (!e) return null;
  const miss: WordMiss = { expected: expectedRaw, heard: heardRaw };
  const h = heardRaw ? normalize(heardRaw) : null;

  if (h) {
    // "espeak" — an e sneaked in before an s-cluster.
    if (/^s[bcdfgklmnpqtvw]/.test(e) && (h === `e${e}` || (h.startsWith("es") && similarity(h, `e${e}`) >= 85))) {
      return d("s-clusters", miss);
    }
    // TH became t / d / s / f (tink, dis, sank, free).
    if (e.includes("th")) {
      for (const sub of ["t", "d", "s", "f"]) {
        if (similarity(e.replaceAll("th", sub), h) >= 85 && similarity(e, h) < 100) return d("th", miss);
      }
    }
    // b ↔ v swap (berry/very). 80 because the swap often lands next to other
    // spelling drift in the transcript (bery vs berry).
    if (e.includes("v") && similarity(e.replaceAll("v", "b"), h) >= 80 && similarity(e, h) < 100) {
      return d("b-vs-v", miss);
    }
    if (e.includes("b") && similarity(e.replaceAll("b", "v"), h) >= 80 && similarity(e, h) < 100) {
      return d("b-vs-v", miss);
    }
    // j ↔ y swap (jet/yet, jello/yellow).
    if (e.startsWith("j") && h.startsWith("y") && similarity(`y${e.slice(1)}`, h) >= 80) return d("dj-vs-y", miss);
    if (e.startsWith("y") && h.startsWith("j") && similarity(`j${e.slice(1)}`, h) >= 80) return d("dj-vs-y", miss);
    // H dropped (hat→at) or added (old→hold).
    if (e.startsWith("h") && !h.startsWith("h") && similarity(e.slice(1), h) >= 85) return d("h", miss);
    if (!e.startsWith("h") && h.startsWith("h") && similarity(e, h.slice(1)) >= 85) return d("h", miss);
    // Short i ↔ long ee (ship/sheep, live/leave).
    if (e.includes("ee") && similarity(e.replaceAll("ee", "i"), h) >= 85) return d("i-vs-ii", miss);
    if (e.includes("ea") && similarity(e.replaceAll("ea", "i"), h) >= 85) return d("i-vs-ii", miss);
    if (e.includes("i") && (similarity(e.replaceAll("i", "ee"), h) >= 85 || similarity(e.replaceAll("i", "ea"), h) >= 85)) {
      return d("i-vs-ii", miss);
    }
    // -ed ending dropped (walked→walk).
    if (e.endsWith("ed") && (h === e.slice(0, -2) || h === e.slice(0, -1))) return d("ed-endings", miss);
    // Final consonant cluster chopped (texts→tex, asked→ask… caught above; world→worl).
    if (endsInCluster(e) && e.startsWith(h) && e.length - h.length >= 1 && e.length - h.length <= 3) {
      return d("final-clusters", miss);
    }
  } else {
    // The word vanished entirely — only diagnose patterns that commonly delete
    // whole small words; otherwise stay silent rather than guess.
    if (e.endsWith("ed")) return d("ed-endings", miss);
  }
  return null;
}

/**
 * Align target vs heard word sequences (edit-distance DP with fuzzy substitution
 * cost) and return the mismatched words plus the first confident sound
 * diagnosis. Short phrases only — sequences here are ≤ ~10 words.
 */
export function diagnose(target: string, heard: string): Diagnosis {
  const t = normalize(target).split(" ").filter(Boolean);
  const hWords = normalize(heard).split(" ").filter(Boolean);
  const n = t.length;
  const m = hWords.length;
  if (!n) return { misses: [], sound: null };

  // DP over word sequences: cost 0–1 per cell, substitution cost = 1 - sim.
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i;
  for (let j = 0; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = similarity(t[i - 1], hWords[j - 1]) / 100;
      cost[i][j] = Math.min(cost[i - 1][j] + 1, cost[i][j - 1] + 1, cost[i - 1][j - 1] + (1 - sim));
    }
  }

  // Trace back to collect per-target-word outcomes.
  const misses: WordMiss[] = [];
  let i = n;
  let j = m;
  while (i > 0) {
    const sim = j > 0 ? similarity(t[i - 1], hWords[j - 1]) / 100 : 0;
    if (j > 0 && Math.abs(cost[i][j] - (cost[i - 1][j - 1] + (1 - sim))) < 1e-9) {
      // 0.85: catches teachable near-misses like think→tink (0.80) and
      // speak→espeak (0.83) that the pass threshold forgives.
      if (sim < 0.85) misses.unshift({ expected: t[i - 1], heard: hWords[j - 1] });
      i--;
      j--;
    } else if (Math.abs(cost[i][j] - (cost[i - 1][j] + 1)) < 1e-9) {
      misses.unshift({ expected: t[i - 1], heard: null });
      i--;
    } else {
      j--; // extra heard word — not a target miss
    }
  }

  let sound: SoundDiagnosis | null = null;
  for (const miss of misses) {
    sound = detect(miss.expected, miss.heard);
    if (sound) break;
  }
  return { misses, sound };
}
