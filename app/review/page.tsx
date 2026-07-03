"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PracticeSession } from "@/components/practice/practice-session";
import { repo } from "@/lib/db";
import { ITEM_BY_ID } from "@/lib/content/lessons";
import type { Lesson, PracticeItem } from "@/lib/db/types";

// A review session pulls every due item across all lessons into one focused
// pass — the spaced-repetition payoff. Built as a synthetic sound-focus lesson.

export default function ReviewPage() {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    repo.getAllProgress().then((all) => {
      if (!active) return;
      const now = Date.now();
      const dueItems: PracticeItem[] = all
        .filter((p) => p.attempts > 0 && p.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt)
        .map((p) => ITEM_BY_ID.get(p.itemId))
        .filter((i): i is PracticeItem => Boolean(i));

      if (dueItems.length > 0) {
        setLesson({
          id: "review",
          title: "Review",
          subtitle: "Words to refresh",
          description: "A focused pass over the sounds you've been missing.",
          kind: "sound-focus",
          categoryIds: [],
          items: dueItems,
          order: -1,
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-xl px-5 py-24 text-center text-muted-foreground">Loading review…</div>;
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <CheckCircle2 className="mx-auto mb-5 size-10 text-success" />
        <p className="font-display text-3xl font-medium tracking-[-0.02em]">All caught up</p>
        <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
          Nothing&apos;s due right now. Practice a lesson to keep building.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          Back to lessons
        </Link>
      </div>
    );
  }

  return <PracticeSession lesson={lesson} />;
}
