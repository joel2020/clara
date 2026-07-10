import type { ItemProgress } from "@/lib/db/types";
import { ITEM_BY_ID } from "@/lib/content/lessons";
import { isMastered } from "@/lib/srs";

// The items she's struggling with most — used to personalize the AI
// conversation (Joel weaves them into the roleplay) and to weight the radio
// playlist. Weakness = practiced but not mastered, sorted by how badly it's
// going: recent misses first, then low pass rate, then low SRS box.

export interface WeakItem {
  itemId: string;
  text: string;
  meaning?: string;
}

export function weakestItems(progress: ItemProgress[], limit = 5): WeakItem[] {
  return progress
    .filter((p) => p.attempts > 0 && !isMastered(p) && ITEM_BY_ID.has(p.itemId))
    .sort((a, b) => weakness(a) - weakness(b))
    .slice(0, limit)
    .map((p) => {
      const item = ITEM_BY_ID.get(p.itemId)!;
      return { itemId: p.itemId, text: item.text, meaning: item.meaning };
    });
}

/** Lower = weaker. */
function weakness(p: ItemProgress): number {
  const passRate = p.attempts > 0 ? p.passes / p.attempts : 0;
  return (p.lastResult ? 3 : 0) + p.box * 2 + passRate * 4;
}
