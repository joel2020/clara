"use client";

import { ContextVisual } from "@/components/visual-learning/context-visual";
import type { PracticeItem } from "@/lib/db/types";
import { meaningFor } from "@/lib/content/word-es";
import { resolveVisualObject } from "@/lib/visual-learning/resolve";
import type { VisualLanguage, VisualTopicPack } from "@/lib/visual-learning/types";

export function ContextPhraseScene({
  pack,
  item,
  language,
}: {
  pack: VisualTopicPack;
  item: PracticeItem;
  language: VisualLanguage;
}): React.ReactNode {
  const object = resolveVisualObject(pack, item.visualObjectId);
  if (!object) return null;

  const meaning = meaningFor(item.text, item.meaning);

  return (
    <section
      role="group"
      aria-label={`${object.label.en} phrase scene`}
      data-context-phrase-scene
      className="w-full overflow-hidden rounded-[2rem] border border-hairline bg-background text-left shadow-sm"
    >
      <ContextVisual
        pack={pack}
        moment="speak"
        objectId={object.id}
        language={language}
      />

      <div data-phrase-copy className="relative z-40 border-t border-hairline bg-card px-6 py-7 sm:px-8 sm:py-8">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-foreground">{object.label.en}</span>
          <span lang="es" className="text-muted-foreground">
            {object.label.es}
          </span>
        </p>
        <h1
          lang="en"
          className="mt-3 font-display text-3xl font-medium leading-tight tracking-[-0.03em] text-foreground sm:text-4xl"
        >
          {item.text}
        </h1>
        <p className="mt-4 font-ipa text-base text-muted-foreground">{item.ipa}</p>
        {meaning && (
          <p lang="es" className="mt-3 text-base italic text-primary/90">
            {meaning}
          </p>
        )}
      </div>
    </section>
  );
}
