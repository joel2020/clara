import { LESSONS } from "@/lib/content/lessons";
import { SCENARIOS } from "@/lib/content/scenarios";
import { isMastered } from "@/lib/srs";
import type { ItemProgress, Lesson } from "@/lib/db/types";
import type { Scenario } from "@/lib/content/scenarios";

// "Today's session" — the guided daily routine. With no live coach, the app has
// to play that role: decide what she should do today and walk her through it in
// order (warm up → learn → talk). This picks the next thing in each track.

/** The next lesson to work on: conversation track first, then sounds, in order,
 *  choosing the first lesson that still has an un-mastered item. */
export function pickNextLesson(progressById: Map<string, ItemProgress> | undefined): Lesson {
  const ordered = [...LESSONS].sort((a, b) => {
    const ta = a.track === "conversation" ? 0 : 1;
    const tb = b.track === "conversation" ? 0 : 1;
    return ta - tb || a.order - b.order;
  });
  for (const lesson of ordered) {
    const unfinished = lesson.items.some((it) => {
      const p = progressById?.get(it.id);
      return !p || !isMastered(p);
    });
    if (unfinished) return lesson;
  }
  return ordered[0];
}

/** A deterministic scenario for the day, so "today's conversation" is stable
 *  within a day but rotates across days. */
export function pickScenario(day: string): Scenario {
  let h = 0;
  for (let i = 0; i < day.length; i++) h = (h * 31 + day.charCodeAt(i)) >>> 0;
  return SCENARIOS[h % SCENARIOS.length];
}
