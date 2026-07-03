import type { ItemProgress } from "./db/types";

/**
 * Lightweight Leitner-box spaced repetition.
 *
 * - A pass promotes an item one box (longer wait before it resurfaces).
 * - A fail knocks it back toward box 0 (it comes back soon).
 * - Items at MASTERED_BOX are considered learned and space out to weeks.
 *
 * Intervals are deliberately short at the low boxes so a missed word reappears
 * within the same practice session — that's the "misses resurface sooner" goal.
 */

export const MASTERED_BOX = 5;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Wait time before an item in each box is due again.
const BOX_INTERVALS = [
  0, // box 0 — due immediately (still in the active rotation)
  1 * MINUTE, // box 1 — comes back almost right away
  10 * MINUTE,
  1 * HOUR,
  1 * DAY,
  4 * DAY, // box 5 (mastered)
  10 * DAY,
];

export function intervalForBox(box: number): number {
  const i = Math.min(Math.max(box, 0), BOX_INTERVALS.length - 1);
  return BOX_INTERVALS[i];
}

export function isMastered(p: Pick<ItemProgress, "box">): boolean {
  return p.box >= MASTERED_BOX;
}

export function freshProgress(
  seed: Pick<ItemProgress, "itemId" | "lessonId" | "categoryId" | "phoneme">,
  now: number,
): ItemProgress {
  return {
    ...seed,
    attempts: 0,
    passes: 0,
    box: 0,
    dueAt: now,
    lastResult: null,
    lastScore: 0,
    updatedAt: now,
  };
}

/**
 * Apply one attempt result to an item's SRS state and return the updated row.
 */
export function applyResult(prev: ItemProgress, passed: boolean, score: number, now: number): ItemProgress {
  const box = passed ? Math.min(prev.box + 1, MASTERED_BOX + 1) : Math.max(prev.box - 1, 0);
  return {
    ...prev,
    attempts: prev.attempts + 1,
    passes: prev.passes + (passed ? 1 : 0),
    box,
    dueAt: now + intervalForBox(box),
    lastResult: passed ? "pass" : "fail",
    lastScore: score,
    updatedAt: now,
  };
}

/**
 * Order practice items for a session: due-and-overdue first (most overdue and
 * lowest box win), then never-seen items, then everything else. `progressByItem`
 * may be missing entries for items never attempted.
 */
export function orderForSession<T extends { id: string }>(
  items: T[],
  progressByItem: Map<string, ItemProgress>,
  now: number,
): T[] {
  return [...items].sort((a, b) => weight(a) - weight(b));

  function weight(item: T): number {
    const p = progressByItem.get(item.id);
    if (!p) return 1_000; // unseen — practice after due review items, before mastered
    if (p.dueAt <= now) {
      // Overdue review: the more overdue and the lower the box, the sooner.
      return -(now - p.dueAt) / 1000 - (MASTERED_BOX - p.box) * 100;
    }
    if (isMastered(p)) return 1_000_000 + p.dueAt; // mastered — last
    return 2_000 + p.dueAt; // not due yet
  }
}
