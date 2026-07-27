import { LESSONS } from "@/lib/content/lessons";
import { SCENARIOS } from "@/lib/content/scenarios";
import { isMastered } from "@/lib/srs";
import { levelLessonPool } from "@/lib/onboarding";
import { SUPPORT_UNIT_IDS } from "@/lib/content/conversation-support";
import type { LearningPath } from "@/lib/paths";
import type { Level } from "@/lib/placement";
import type { ItemProgress, Lesson } from "@/lib/db/types";
import type { Scenario } from "@/lib/content/scenarios";

// "Today's session" — the guided daily routine. With no live coach, the app has
// to play that role: decide what she should do today and walk her through it in
// order (warm up → learn → talk). This picks the next thing in each track.

function hasUnmastered(lesson: Lesson, progressById: Map<string, ItemProgress> | undefined): boolean {
  return lesson.items.some((it) => {
    const p = progressById?.get(it.id);
    return !p || !isMastered(p);
  });
}

/** The next lesson to work on. With a placement `level`, it walks the learner's
 *  level-appropriate pool first (so a beginner and a B1 learner diverge), then
 *  falls back to the global order: conversation track first, then sounds. */
export function pickNextLesson(
  progressById: Map<string, ItemProgress> | undefined,
  level?: Level,
  path: LearningPath = "general",
): Lesson {
  const ordered = [...LESSONS].sort((a, b) => {
    const ta = a.track === "conversation" ? 0 : 1;
    const tb = b.track === "conversation" ? 0 : 1;
    return ta - tb || a.order - b.order;
  });

  // On the job path the support units come first: they are the reason she is
  // here, and the general conversation ladder is support material for them. They
  // are NOT added to levelLessonPool, because that pool is what gates the stage
  // exam and folding 90 items into it would push the gate out of reach.
  if (path === "job") {
    const byId = new Map(LESSONS.map((l) => [l.id, l]));
    for (const id of SUPPORT_UNIT_IDS) {
      const lesson = byId.get(id);
      if (lesson && hasUnmastered(lesson, progressById)) return lesson;
    }
  }

  if (level) {
    const byId = new Map(LESSONS.map((l) => [l.id, l]));
    for (const id of levelLessonPool(level)) {
      const lesson = byId.get(id);
      if (lesson && hasUnmastered(lesson, progressById)) return lesson;
    }
    // everything in her band is mastered — fall through to the global next.
  }

  for (const lesson of ordered) {
    if (hasUnmastered(lesson, progressById)) return lesson;
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
