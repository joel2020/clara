"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { LESSONS, LESSON_BY_ID } from "@/lib/content/lessons";
import type { Lesson } from "@/lib/db/types";

// All lessons = built-in curriculum + instructor-authored custom lessons.
// Components read lessons through here so custom content shows up everywhere.

export function useLessons(): Lesson[] {
  const custom = useLiveQuery(() => {
    if (typeof window === "undefined" || !db) return [] as Lesson[];
    return db.customLessons.orderBy("order").toArray();
  }, []);

  return [...LESSONS, ...(custom ?? [])].sort((a, b) => a.order - b.order);
}

export function useLesson(id: string): Lesson | undefined {
  const builtIn = LESSON_BY_ID.get(id);
  const custom = useLiveQuery(() => {
    if (typeof window === "undefined" || !db || builtIn) return undefined;
    return db.customLessons.get(id);
  }, [id]);
  return builtIn ?? custom ?? undefined;
}
