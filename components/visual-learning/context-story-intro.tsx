"use client";

import { ArrowRight } from "lucide-react";
import { ContextVisual } from "@/components/visual-learning/context-visual";
import type { VisualLanguage, VisualTopicPack } from "@/lib/visual-learning/types";

export function ContextStoryIntro({
  pack,
  language,
  onStart,
}: {
  pack: VisualTopicPack;
  language: VisualLanguage;
  onStart: () => void;
}) {
  const titleId = `context-story-${pack.id}-title`;

  return (
    <section
      aria-labelledby={titleId}
      lang={language}
      className="grid overflow-hidden rounded-[2rem] border border-hairline bg-background shadow-sm lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]"
    >
      <ContextVisual pack={pack} moment="story" language={language} priority />

      <div className="relative z-40 flex flex-col justify-center bg-card px-6 py-8 sm:px-9 sm:py-10 lg:px-10">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {pack.story.eyebrow[language]}
        </p>
        <h1 id={titleId} className="type-display mt-3 max-w-[14ch] text-foreground">
          {pack.story.title[language]}
        </h1>
        <p className="type-body mt-4 max-w-[38ch] text-muted-foreground">
          {pack.story.body[language]}
        </p>
        <button
          type="button"
          onClick={onStart}
          style={{ minHeight: "44px" }}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground shadow-sm transition-[background-color,transform] duration-200 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98] motion-reduce:transition-none sm:w-fit"
        >
          {pack.story.cta[language]}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
