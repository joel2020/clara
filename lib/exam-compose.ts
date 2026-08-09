import type { ItemKind, PracticeItem } from "@/lib/db/types";
import { SECTIONS, type SectionKey } from "@/lib/exams";
import type { LatamPronunciationFeature } from "@/lib/speech/latam-prior";
import type { CefrLevel } from "@/lib/speech/pronunciation-policy";

// Composing a sitting from curriculum that already exists.
//
// Every section draws on items the app already ships with recorded Joel audio and
// Spanish glosses, so an exam needs no new content and no new voice generation.
// Composition is pure and deterministic given a seed, which means a sitting can be
// reproduced exactly when debugging a disputed result.

export interface ExamItem {
  itemId: string;
  text: string;
  kind: ItemKind;
  meaning?: string;
  categoryId: string;
  phoneme: string;
  mouthHint: string;
  assessmentRole?: "stage-acoustic";
  targetFeature?: LatamPronunciationFeature;
  lessonId?: string;
}

export interface ExamSection {
  key: SectionKey;
  items: ExamItem[];
  /** Open sections carry a question or passage rather than a target phrase. */
  prompt?: string;
}

export interface Exam {
  level: string;
  status: "ready" | "unavailable";
  reason?: "duplicate-item-id" | "insufficient-authored-targets" | "insufficient-item-pool";
  contentVersion: typeof STAGE_CONTENT_VERSION;
  contentHash: string;
  sections: ExamSection[];
}

export const STAGE_CONTENT_VERSION = "stage-content-v1";

const CATEGORY_FEATURE: Readonly<Record<string, LatamPronunciationFeature>> = Object.freeze({
  "i-vs-ii": "short-i-long-ee",
  "b-vs-v": "b-v",
  "dj-vs-y": "dzh-y",
  th: "th",
  "s-clusters": "initial-s-cluster",
  "ed-endings": "final-endings",
  "final-clusters": "final-clusters",
  h: "h",
  "american-r": "rhotic-r",
  schwa: "schwa",
});

const LEVEL_REQUIRED_FEATURES: Readonly<Record<CefrLevel, readonly LatamPronunciationFeature[]>> = {
  A0: ["short-i-long-ee", "b-v", "th", "initial-s-cluster", "final-endings"],
  A1: ["short-i-long-ee", "b-v", "th", "initial-s-cluster", "final-endings"],
  A2: ["b-v", "th", "initial-s-cluster", "final-clusters", "final-endings"],
  B1: ["b-v", "th", "initial-s-cluster", "final-clusters", "final-endings"],
  B2: ["b-v", "th", "initial-s-cluster", "final-clusters", "final-endings"],
  C1: ["rhotic-r", "schwa", "th", "final-clusters", "final-endings"],
  C2: ["rhotic-r", "schwa", "th", "final-clusters", "final-endings"],
};

const FEATURE_LESSON: Readonly<Partial<Record<LatamPronunciationFeature, string>>> = Object.freeze({
  "short-i-long-ee": "i-vs-ii", "b-v": "b-vs-v", "dzh-y": "dj-vs-y", th: "th",
  "initial-s-cluster": "s-clusters", "final-endings": "ed-endings", "final-clusters": "final-clusters",
  h: "h", "rhotic-r": "american-r", schwa: "schwa",
});

export function requiredStageFeatures(level: string): readonly LatamPronunciationFeature[] {
  return LEVEL_REQUIRED_FEATURES[level as CefrLevel] ?? LEVEL_REQUIRED_FEATURES.C2;
}

function examItem(item: PracticeItem, targetFeature?: LatamPronunciationFeature): ExamItem {
  return {
    itemId: item.id,
    text: item.text,
    kind: item.kind,
    meaning: item.meaning,
    categoryId: item.categoryId,
    phoneme: item.phoneme,
    mouthHint: item.mouthHint,
    ...(targetFeature ? { assessmentRole: "stage-acoustic" as const, targetFeature, lessonId: FEATURE_LESSON[targetFeature] } : {}),
  };
}

/** Deterministic 32-bit hash, so a seed string yields a stable ordering. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Stable shuffle: orders by a hash of (seed + item id) rather than Math.random,
 * so the same seed always produces the same sitting and nothing impure runs.
 */
export function seededOrder<T>(items: T[], key: (t: T) => string, seed: string): T[] {
  return [...items].sort((a, b) => hash(seed + key(a)) - hash(seed + key(b)) || key(a).localeCompare(key(b)));
}

function contentHash(level: string, sections: ExamSection[]): string {
  const content = JSON.stringify({ version: STAGE_CONTENT_VERSION, level, sections });
  return `${hash(`a:${content}`).toString(16).padStart(8, "0")}${hash(`b:${content}`).toString(16).padStart(8, "0")}`;
}

/** Open-response prompts, pitched at the band rather than at a fixed level. */
const OPEN_PROMPTS: Record<string, string[]> = {
  low: [
    "Tell me about your family.",
    "What did you do yesterday?",
    "Describe where you live.",
  ],
  mid: [
    "Tell me about a job you would like to have, and why.",
    "Describe a problem you solved recently.",
    "What do you usually do on a difficult day at work?",
  ],
  high: [
    "Some people think working remotely is better than working in an office. What do you think, and why?",
    "Describe a time you disagreed with someone and how you handled it.",
    "What would you change about how companies hire people?",
  ],
};

const RETELL_PROMPTS: Record<string, { passage: string; keywords: string[] }> = {
  low: {
    passage:
      "Ana works at a coffee shop near her house. Every morning she opens at seven and makes coffee for the neighbors. On Sundays the shop is closed, so she visits her mother.",
    keywords: ["coffee", "morning", "seven", "neighbors", "sunday", "mother"],
  },
  mid: {
    passage:
      "Carlos ordered a laptop online, but the company sent the wrong model. He called support twice and nobody called him back. Finally he wrote an email, and the next day they agreed to replace it and pay for the shipping.",
    keywords: ["laptop", "wrong", "called", "support", "email", "replace", "shipping"],
  },
  high: {
    passage:
      "A small company decided to let everyone work from home permanently. Productivity went up at first, but after a few months managers noticed that new employees felt isolated and were leaving faster. The company now asks teams to meet in person twice a month.",
    keywords: ["work from home", "productivity", "managers", "new employees", "isolated", "leaving", "in person"],
  },
};

function bandKey(level: string): "low" | "mid" | "high" {
  if (level === "A0" || level === "A1" || level === "A2") return "low";
  if (level === "B1" || level === "B2") return "mid";
  return "high";
}

/**
 * Build a sitting for a level from the items in that band's pool.
 *
 * Sections that need a spoken target take phrases; the two open sections take a
 * prompt instead. Items are never reused across sections within one sitting, so a
 * strong performance on one section cannot be recycled into another.
 */
export function composeExam(level: string, pool: PracticeItem[], seed: string): Exam {
  const usable = pool.filter((i) => i.text.trim().length > 0);
  const band = bandKey(level);
  if (new Set(usable.map((item) => item.id)).size !== usable.length) {
    return { level, status: "unavailable", reason: "duplicate-item-id", contentVersion: STAGE_CONTENT_VERSION, contentHash: "", sections: [] };
  }

  const priorities = requiredStageFeatures(level);
  const targetPool = usable.filter((item) =>
    priorities.includes(CATEGORY_FEATURE[item.categoryId]) &&
    (item.kind === "word" || item.kind === "phrase") &&
    item.ipa.trim().length > 0 && item.mouthHint.trim().length > 0 && item.phoneme.trim().length > 0,
  );
  const byFeature = new Map<LatamPronunciationFeature, PracticeItem[]>();
  for (const feature of priorities) {
    byFeature.set(feature, seededOrder(targetPool.filter((item) => CATEGORY_FEATURE[item.categoryId] === feature), (item) => item.id, `${seed}:${feature}`));
  }
  const speaking: PracticeItem[] = [];
  for (const feature of priorities) {
    const candidate = byFeature.get(feature)?.shift();
    if (candidate) speaking.push(candidate);
  }
  const remainingTargets = seededOrder(
    [...byFeature.values()].flat(),
    (item) => item.id,
    `${seed}:speaking`,
  );
  while (speaking.length < 8 && remainingTargets.length) speaking.push(remainingTargets.shift()!);
  const covered = new Set(speaking.map((item) => CATEGORY_FEATURE[item.categoryId]));
  if (speaking.length < 8 || priorities.some((feature) => !covered.has(feature))) {
    return { level, status: "unavailable", reason: "insufficient-authored-targets", contentVersion: STAGE_CONTENT_VERSION, contentHash: "", sections: [] };
  }

  const spokenIds = new Set(speaking.map((item) => item.id));
  const ordered = seededOrder(usable.filter((item) => !spokenIds.has(item.id)), (i) => i.id, `${seed}:general`);
  if (ordered.length < 6) return { level, status: "unavailable", reason: "insufficient-item-pool", contentVersion: STAGE_CONTENT_VERSION, contentHash: "", sections: [] };

  let cursor = 0;
  const take = (n: number): ExamItem[] => {
    const out: ExamItem[] = [];
    while (out.length < n && cursor < ordered.length) {
      const it = ordered[cursor++];
      out.push(examItem(it));
    }
    return out;
  };

  const sections: ExamSection[] = SECTIONS.map((spec) => {
    if (spec.key === "openResponse") {
      const prompts = OPEN_PROMPTS[band];
      const picked = seededOrder(prompts, (p) => p, seed).slice(0, spec.items);
      return { key: spec.key, items: [], prompt: picked.join(" | ") };
    }
    if (spec.key === "retell") {
      return { key: spec.key, items: [], prompt: RETELL_PROMPTS[band].passage };
    }
    if (spec.key === "readAloud") {
      return { key: spec.key, items: speaking.slice(0, spec.items).map((item) => examItem(item, CATEGORY_FEATURE[item.categoryId])) };
    }
    if (spec.key === "repeat") {
      return { key: spec.key, items: speaking.slice(SECTIONS[0].items, SECTIONS[0].items + spec.items).map((item) => examItem(item, CATEGORY_FEATURE[item.categoryId])) };
    }
    return { key: spec.key, items: take(spec.items) };
  });

  return { level, status: "ready", contentVersion: STAGE_CONTENT_VERSION, contentHash: contentHash(level, sections), sections };
}

/** The keywords a retell answer is measured against, for the level's passage. */
export function retellKeywords(level: string): string[] {
  return RETELL_PROMPTS[bandKey(level)].keywords;
}

/**
 * NO LONGER USED FOR EXAMS. The exam grades retells with the CEFR-aware model
 * (/api/grade) and VOIDS the sitting when the grader is unavailable — keyword
 * coverage accepts word salad ("mother sunday seven" scores 100), which is
 * fine as a practice signal but must never decide a band (audit P1).
 *
 * Score a retell by keyword coverage — measurable, and honest about what it
 * checks: did the content survive, not whether the grammar was elegant.
 */
export function scoreRetell(transcript: string, keywords: string[]): number {
  if (!keywords.length) return 0;
  const said = transcript.toLowerCase();
  const hits = keywords.filter((k) => said.includes(k.toLowerCase())).length;
  return Math.max(0, Math.min(100, Math.round((hits / keywords.length) * 100)));
}
