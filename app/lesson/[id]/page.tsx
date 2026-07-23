"use client";

import { use } from "react";
import Link from "next/link";
import { PracticeSession } from "@/components/practice/practice-session";
import { SceneVideo } from "@/components/scene-video";
import { useLesson } from "@/lib/hooks/useLessons";

// A dim cinematic backdrop for the real-world conversation units, so a lesson
// about the cafe/airport/work feels like you're there. Sound & phonics lessons
// keep the clean canvas.
const SCENE_FOR_LESSON: Record<string, string> = {
  "conv-cafe": "loop-cafe-9x16",
  "conv-travel": "loop-travel-9x16",
  "conv-hotel": "loop-travel-9x16",
  "conv-work": "loop-work-9x16",
  "conv-transport": "loop-citywalk-9x16",
  "conv-directions": "loop-citywalk-9x16",
  "conv-shopping": "loop-citywalk-9x16",
  "conv-smalltalk": "loop-social-9x16",
  "conv-plans": "loop-restaurant-9x16",
};

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

  const scene = SCENE_FOR_LESSON[lesson.id];
  return (
    <>
      {scene && (
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
          <SceneVideo base={`/scenes/${scene}`} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/88 backdrop-blur-[2px]" />
        </div>
      )}
      <PracticeSession lesson={lesson} />
    </>
  );
}
