import type { Lesson, PracticeItem } from "./db/types";

export interface LessonFocus { item: PracticeItem; stage: "produce" | "phrases" }

/** A focus id is accepted only when the exact authored item belongs to this lesson. */
export function resolveLessonFocus(lesson: Lesson, requested: string | null | undefined): LessonFocus | null {
  if (!requested || requested.length > 128) return null;
  const item = lesson.items.find((candidate) => candidate.id === requested);
  return item ? { item, stage: item.kind === "phrase" ? "phrases" : "produce" } : null;
}
