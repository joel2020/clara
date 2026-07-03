"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLessons } from "@/lib/hooks/useLessons";
import { useProgressMap } from "@/lib/hooks/useData";
import { isMastered } from "@/lib/srs";
import type { Lesson, ItemProgress } from "@/lib/db/types";

const KIND_LABEL: Record<Lesson["kind"], string> = {
  "minimal-pairs": "Minimal pairs",
  "sound-focus": "Sound focus",
  phrase: "Phrases",
};

export function LessonList({ track }: { track?: "sounds" | "conversation" }) {
  const lessons = useLessons();
  const progress = useProgressMap();
  const shown = track ? lessons.filter((l) => (l.track ?? "sounds") === track) : lessons;

  return (
    <ul className="stagger">
      {shown.map((lesson, i) => (
        <LessonRow key={lesson.id} lesson={lesson} index={i + 1} progress={progress} />
      ))}
    </ul>
  );
}

function LessonRow({
  lesson,
  index,
  progress,
}: {
  lesson: Lesson;
  index: number;
  progress: Map<string, ItemProgress> | undefined;
}) {
  const total = lesson.items.length;
  const words = lesson.items.filter((i) => i.kind === "word").length;
  const sentences = total - words;
  let practiced = 0;
  let mastered = 0;
  if (progress) {
    for (const item of lesson.items) {
      const p = progress.get(item.id);
      if (p && p.attempts > 0) practiced += 1;
      if (p && isMastered(p)) mastered += 1;
    }
  }
  const pct = total ? Math.round((mastered / total) * 100) : 0;
  const started = practiced > 0;
  const contents =
    words && sentences
      ? `${words} words · ${sentences} sentences`
      : words
        ? `${words} words`
        : `${sentences} sentences`;

  return (
    <li>
      <Link
        href={`/lesson/${lesson.id}`}
        className="group flex items-center gap-5 border-b border-hairline py-6 transition-colors"
      >
        <span className="w-7 shrink-0 font-mono text-[13px] tabular-nums text-muted-foreground/70">
          {String(index).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display text-xl font-medium leading-tight tracking-[-0.01em] transition-colors group-hover:text-primary">
              {lesson.title}
            </h3>
            {lesson.custom && (
              <span className="rounded-full border border-hairline px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                custom
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="font-mono">{lesson.subtitle}</span>
            <span className="text-hairline">·</span>
            <span>{KIND_LABEL[lesson.kind]}</span>
          </div>

          {/* Hairline progress track */}
          <div className="mt-3 flex items-center gap-3">
            <div className="h-px max-w-[180px] flex-1 bg-hairline">
              <div
                className="h-px bg-primary transition-all duration-700"
                style={{ width: `${started ? Math.max(pct, 3) : 0}%` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/80">
              {started ? `${mastered}/${total}` : contents}
            </span>
          </div>
        </div>

        <ArrowUpRight
          className={cn(
            "size-5 shrink-0 text-muted-foreground/50 transition-all",
            "group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary",
          )}
        />
      </Link>
    </li>
  );
}
