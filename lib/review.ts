import { repo } from "@/lib/db";
import { ITEM_BY_ID } from "@/lib/content/lessons";
import { isMastered } from "@/lib/srs";
import type { ItemProgress, PracticeItem } from "@/lib/db/types";

// Builds the review queue. Two sources feed it: the normal spaced-repetition
// deck (curriculum words that have come due) AND phrases she stumbled on in a
// live conversation — those are added as "homework" the moment they're mined,
// so real conversation gaps become the very next thing she practices.

/** Ordered list of everything due to review right now. Conversation phrases first. */
export async function getDueReviewItems(now = Date.now()): Promise<PracticeItem[]> {
  const [progress, convItems] = await Promise.all([repo.getAllProgress(), repo.getConvItems()]);
  const progById = new Map(progress.map((p) => [p.itemId, p]));

  // Conversation homework: due until mastered. A freshly mined phrase (no
  // progress yet) is due immediately.
  const convDue: PracticeItem[] = convItems.filter((ci) => {
    const p = progById.get(ci.id);
    return p ? !isMastered(p) && p.dueAt <= now : true;
  });

  // Curriculum SRS: attempted items that have come due again.
  const curriculumDue: PracticeItem[] = progress
    .filter((p) => p.attempts > 0 && p.dueAt <= now && ITEM_BY_ID.has(p.itemId))
    .sort((a, b) => a.dueAt - b.dueAt)
    .map((p) => ITEM_BY_ID.get(p.itemId) as PracticeItem);

  return [...convDue, ...curriculumDue];
}

/**
 * Count due items reactively from already-loaded rows (for the home callout, so
 * it doesn't need to re-query). Mirrors the logic in getDueReviewItems.
 */
export function countDueReview(
  progress: ItemProgress[],
  convItems: PracticeItem[],
  now = Date.now(),
): number {
  const progById = new Map(progress.map((p) => [p.itemId, p]));
  const convDue = convItems.filter((ci) => {
    const p = progById.get(ci.id);
    return p ? !isMastered(p) && p.dueAt <= now : true;
  }).length;
  const curriculumDue = progress.filter(
    (p) => p.attempts > 0 && p.dueAt <= now && ITEM_BY_ID.has(p.itemId),
  ).length;
  return convDue + curriculumDue;
}
