import type { PracticeItem } from "@/lib/db/types";
import { SECTIONS, type SectionKey } from "@/lib/exams";

// Composing a sitting from curriculum that already exists.
//
// Every section draws on items the app already ships with recorded Joel audio and
// Spanish glosses, so an exam needs no new content and no new voice generation.
// Composition is pure and deterministic given a seed, which means a sitting can be
// reproduced exactly when debugging a disputed result.

export interface ExamItem {
  itemId: string;
  text: string;
  meaning?: string;
}

export interface ExamSection {
  key: SectionKey;
  items: ExamItem[];
  /** Open sections carry a question or passage rather than a target phrase. */
  prompt?: string;
}

export interface Exam {
  level: string;
  sections: ExamSection[];
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
  return [...items].sort((a, b) => hash(seed + key(a)) - hash(seed + key(b)));
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
  const ordered = seededOrder(usable, (i) => i.id, seed);
  const band = bandKey(level);

  let cursor = 0;
  const take = (n: number): ExamItem[] => {
    const out: ExamItem[] = [];
    while (out.length < n && cursor < ordered.length) {
      const it = ordered[cursor++];
      out.push({ itemId: it.id, text: it.text, meaning: it.meaning });
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
    return { key: spec.key, items: take(spec.items) };
  });

  return { level, sections };
}

/** The keywords a retell answer is measured against, for the level's passage. */
export function retellKeywords(level: string): string[] {
  return RETELL_PROMPTS[bandKey(level)].keywords;
}

/**
 * Score a retell by keyword coverage — measurable, and honest about what it
 * checks: did the content survive, not whether the grammar was elegant.
 */
export function scoreRetell(transcript: string, keywords: string[]): number {
  if (!keywords.length) return 0;
  const said = transcript.toLowerCase();
  const hits = keywords.filter((k) => said.includes(k.toLowerCase())).length;
  return Math.max(0, Math.min(100, Math.round((hits / keywords.length) * 100)));
}
