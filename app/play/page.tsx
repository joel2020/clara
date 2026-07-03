"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Zap } from "lucide-react";
import { SpeedRound } from "@/components/practice/speed-round";
import { useLessons } from "@/lib/hooks/useLessons";
import type { PracticeItem } from "@/lib/db/types";

export default function PlayPage() {
  const lessons = useLessons();
  const [items, setItems] = useState<PracticeItem[] | null>(null);

  if (items) {
    return (
      <div className="pt-6">
        <SpeedRound items={items} onExit={() => setItems(null)} />
      </div>
    );
  }

  const everything = lessons.flatMap((l) => l.items);

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-8 sm:px-6">
      <Link
        href="/"
        className="group mb-8 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Lessons
      </Link>

      <div className="animate-fade-up">
        <div className="mb-1 flex items-center gap-2 text-primary">
          <Zap className="size-5" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Speed round</p>
        </div>
        <h1 className="font-display text-4xl font-medium tracking-[-0.03em] sm:text-5xl">Go fast.</h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Fifteen words, back to back. Keep your combo alive and stack up XP. Pick a sound — or take on everything.
        </p>
      </div>

      <div className="mt-10">
        <button
          onClick={() => setItems(everything)}
          className="group flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-primary/[0.04] px-5 py-4 text-left transition-colors hover:bg-primary/[0.08]"
        >
          <div>
            <p className="font-display text-lg font-medium">Everything</p>
            <p className="text-sm text-muted-foreground">A mix from every sound</p>
          </div>
          <Zap className="size-5 text-primary transition-transform group-hover:scale-110" />
        </button>
      </div>

      <div className="mt-6 border-t border-hairline pt-4">
        <p className="mb-1 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Or one sound</p>
        <ul>
          {lessons.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setItems(l.items)}
                className="group flex w-full items-center justify-between border-b border-hairline py-4 text-left transition-colors"
              >
                <div>
                  <p className="font-display text-base font-medium transition-colors group-hover:text-primary">{l.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{l.subtitle}</p>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{l.items.length}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
