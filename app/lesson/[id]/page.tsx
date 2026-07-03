"use client";

import { use } from "react";
import Link from "next/link";
import { PracticeSession } from "@/components/practice/practice-session";
import { useLesson } from "@/lib/hooks/useLessons";

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const lesson = useLesson(id);

  if (!lesson) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <p className="font-display text-2xl font-medium tracking-[-0.01em]">That lesson isn&apos;t here</p>
        <p className="mt-2 text-muted-foreground">It may still be loading, or the link is wrong.</p>
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
