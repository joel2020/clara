// Scoring turns "what the recognizer heard" into a pass/retry verdict.
//
// The signal we trust most: did the speech recognizer transcribe the target word
// (or something very close), or did it hear something else — often the
// minimal-pair partner? That mismatch is exactly what we want to show her.

export type FeedbackKey = "perfect" | "pass" | "close" | "notQuite" | "partner";

export interface ScoreResult {
  score: number; // 0–100
  passed: boolean;
  heard: string; // best-matching transcript we compared against
  heardPartner: boolean; // true if she landed on the minimal-pair twin instead
  feedback: string;
  /** Which feedback case fired — lets the UI translate the coaching line. */
  feedbackKey: FeedbackKey;
}

const WORD_PASS = 80;
const PHRASE_PASS = 70;

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        prevDiag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prevDiag = tmp;
    }
  }
  return prev[b.length];
}

/** Similarity of two strings as a 0–100 score. */
export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 100;
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return Math.round((1 - dist / maxLen) * 100);
}

/** Word-overlap score for phrases (order-independent, forgiving of small misses). */
function phraseScore(target: string, heard: string): number {
  const t = normalize(target).split(" ").filter(Boolean);
  const h = normalize(heard).split(" ").filter(Boolean);
  if (!t.length) return 0;
  const hPool = [...h];
  let hit = 0;
  for (const word of t) {
    // Best fuzzy match for this target word among remaining heard words.
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < hPool.length; i++) {
      const sim = similarity(word, hPool[i]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestSim >= 80 && bestIdx >= 0) {
      hit += 1;
      hPool.splice(bestIdx, 1);
    } else if (bestSim >= 60) {
      hit += 0.5;
      if (bestIdx >= 0) hPool.splice(bestIdx, 1);
    }
  }
  return Math.round((hit / t.length) * 100);
}

export interface ScoreInput {
  target: string;
  transcript: string;
  alternatives?: string[];
  kind: "word" | "phrase";
  /** The minimal-pair partner's text, if any (e.g. target "sheep" → "ship"). */
  partnerText?: string;
}

export function scoreAttempt(input: ScoreInput): ScoreResult {
  const { target, transcript, alternatives = [], kind, partnerText } = input;
  const candidates = [transcript, ...alternatives].filter(Boolean);
  const threshold = kind === "phrase" ? PHRASE_PASS : WORD_PASS;

  const scoreOne = (heard: string) =>
    kind === "phrase" ? phraseScore(target, heard) : similarity(target, heard);

  // Best candidate against the target — the recognizer's alternatives often
  // include the right word even when its top pick was off.
  let best = { heard: transcript, score: 0 };
  for (const c of candidates) {
    const s = scoreOne(c);
    if (s > best.score) best = { heard: c, score: s };
  }

  // Did she land on the minimal-pair twin? Only flag it when the partner is a
  // clearly better match than the target — that's the teachable mismatch.
  let heardPartner = false;
  if (partnerText && kind === "word") {
    const partnerBest = Math.max(...candidates.map((c) => similarity(partnerText, c)), 0);
    if (partnerBest >= 80 && partnerBest > best.score) {
      heardPartner = true;
    }
  }

  const passed = best.score >= threshold && !heardPartner;
  const feedbackKey = pickFeedbackKey(passed, best.score, heardPartner);

  return {
    score: best.score,
    passed,
    heard: best.heard || transcript,
    heardPartner,
    feedback: buildFeedback(feedbackKey, target, partnerText),
    feedbackKey,
  };
}

function pickFeedbackKey(passed: boolean, score: number, heardPartner: boolean): FeedbackKey {
  if (heardPartner) return "partner";
  if (passed && score === 100) return "perfect";
  if (passed) return "pass";
  if (score >= 60) return "close";
  return "notQuite";
}

function buildFeedback(key: FeedbackKey, target: string, partnerText?: string): string {
  switch (key) {
    case "partner":
      return `That sounded like "${partnerText}". Aim for "${target}" — notice the difference and try again.`;
    case "perfect":
      return "Perfect — that's exactly it.";
    case "pass":
      return "Nice — that's clear. Keep it up.";
    case "close":
      return "Close. Listen once more, then try again.";
    case "notQuite":
      return "Not quite. Tap Listen, watch the mouth hint, and give it another go.";
  }
}
