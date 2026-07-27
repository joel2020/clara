import type { ItemProgress } from "@/lib/db/types";
import { ITEM_BY_ID, trackOfItem } from "@/lib/content/lessons";
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

export interface WeakItemOptions {
  /**
   * Only consider items from this curriculum track.
   *
   * The AI conversation partner MUST pass "conversation". Sounds-track items are
   * isolated minimal-pair drill words ("vase", "base", "boat") and tongue-twister
   * sentences — mouth-shape targets, not things anyone says. Handing them to the
   * chat model made it bend the scene to fit them (it once asked a student if she
   * had "a vase for her books"). Conversation-track items are real phrases with a
   * Spanish gloss, so weaving them in reads naturally.
   */
  track?: "sounds" | "conversation";
}

export function weakestItems(progress: ItemProgress[], limit = 5, opts: WeakItemOptions = {}): WeakItem[] {
  return progress
    .filter((p) => p.attempts > 0 && !isMastered(p) && ITEM_BY_ID.has(p.itemId))
    .filter((p) => !opts.track || trackOfItem(p.itemId) === opts.track)
    .sort((a, b) => weakness(a) - weakness(b))
    .slice(0, limit)
    .map((p) => {
      const item = ITEM_BY_ID.get(p.itemId)!;
      return { itemId: p.itemId, text: item.text, meaning: item.meaning };
    });
}

/**
 * Lower = weaker, so the sort puts the shakiest item first.
 *
 * `lastResult` is "pass" | "fail" | null, NOT a boolean. The original check was
 * `p.lastResult ? 3 : 0`, which scored a miss and a pass identically (both
 * truthy) and gave a never-resolved item the *lowest* score — so the words she
 * had just gotten wrong were ranked as her strongest. Only a miss may earn the
 * penalty-free 0.
 */
export function weakness(p: ItemProgress): number {
  const passRate = p.attempts > 0 ? p.passes / p.attempts : 0;
  return (p.lastResult === "fail" ? 0 : 3) + p.box * 2 + passRate * 4;
}
