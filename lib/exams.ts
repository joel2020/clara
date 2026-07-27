import type { ItemProgress } from "@/lib/db/types";
import { type Level, levelUp } from "@/lib/placement";
import { isMastered } from "@/lib/srs";

// Stage exams — the gate between levels.
//
// A band is only cleared by passing its exam, so the level Clara shows a student
// (and that a student might show a recruiter) is always earned rather than
// self-reported. Rules, from the spec:
//
//   - An attempt UNLOCKS at 80% mastery of the current band's pool. Without a
//     gate on the gate, students would spam the exam and it would mean nothing.
//   - Passing promotes a stage and unlocks the next band's content.
//   - Failing names the weakest section and costs nothing but a day.
//   - One attempt per calendar day, pass or fail.
//
// This module is pure: no Dexie, no React, no clock of its own.

/** Share of the current band's items that must be mastered to attempt the exam. */
export const UNLOCK_RATIO = 0.8;

/** Section score needed to clear a stage. Content difficulty scales with band, so
 *  the threshold itself stays fixed. */
export const PASS_SCORE = 70;

export type SectionKey = "readAloud" | "repeat" | "build" | "shortAnswer" | "retell" | "openResponse";

/** The six sections, mirroring the format employers screen with. Each maps to a
 *  primitive Clara already has, so the exam reuses verified machinery. */
export const SECTIONS: { key: SectionKey; weight: number; items: number }[] = [
  { key: "readAloud", weight: 1, items: 4 },
  { key: "repeat", weight: 1, items: 4 },
  { key: "build", weight: 1, items: 3 },
  { key: "shortAnswer", weight: 1, items: 3 },
  { key: "retell", weight: 1.5, items: 1 },
  { key: "openResponse", weight: 1.5, items: 2 },
];

export interface Eligibility {
  eligible: boolean;
  /** Mastered items in the current band's pool. */
  mastered: number;
  /** Items in the pool in total. */
  total: number;
  /** How many more must be mastered before the exam unlocks. */
  remaining: number;
  ratio: number;
}

/**
 * Whether the stage exam is available.
 *
 * `poolItemIds` is the set of item ids belonging to the current band — the caller
 * resolves that from `levelLessonPool(level)` so this module stays free of
 * content imports and is trivially testable.
 */
export function examEligibility(progress: ItemProgress[], poolItemIds: string[]): Eligibility {
  const total = poolItemIds.length;
  if (total === 0) return { eligible: false, mastered: 0, total: 0, remaining: 0, ratio: 0 };

  const pool = new Set(poolItemIds);
  const byId = new Map(progress.map((p) => [p.itemId, p]));
  let mastered = 0;
  for (const id of pool) {
    const p = byId.get(id);
    if (p && isMastered(p)) mastered += 1;
  }
  const need = Math.ceil(total * UNLOCK_RATIO);
  return {
    eligible: mastered >= need,
    mastered,
    total,
    remaining: Math.max(0, need - mastered),
    ratio: mastered / total,
  };
}

export interface SectionResult {
  key: SectionKey;
  /** 0..100 for the section. */
  score: number;
}

export interface ExamResult {
  score: number;
  passed: boolean;
  /** The level she holds after this attempt — promoted only on a pass. */
  level: Level;
  /** The weakest section, always named so a fail is actionable. */
  weakest: SectionKey | null;
  sections: SectionResult[];
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Score an attempt and decide promotion.
 *
 * Sections are weighted (the two open-ended ones count for more, because
 * unscripted speech is what the level actually claims). A missing section scores
 * zero rather than being skipped — an abandoned exam must not pass.
 */
export function scoreExam(results: SectionResult[], level: Level): ExamResult {
  const byKey = new Map(results.map((r) => [r.key, clamp(r.score)]));
  const sections: SectionResult[] = SECTIONS.map((s) => ({ key: s.key, score: byKey.get(s.key) ?? 0 }));

  const totalWeight = SECTIONS.reduce((a, s) => a + s.weight, 0);
  const weighted = SECTIONS.reduce((a, s) => a + (byKey.get(s.key) ?? 0) * s.weight, 0);
  const score = clamp(weighted / totalWeight);
  const passed = score >= PASS_SCORE;

  const weakest = sections.reduce((a, b) => (b.score < a.score ? b : a));

  return {
    score,
    passed,
    level: passed ? levelUp(level) : level,
    weakest: sections.length ? weakest.key : null,
    sections,
  };
}

/** One attempt per calendar day, pass or fail. `today`/`lastDay` are dayKeys. */
export function canAttemptToday(lastAttemptDay: string | null | undefined, today: string): boolean {
  return !lastAttemptDay || lastAttemptDay !== today;
}
