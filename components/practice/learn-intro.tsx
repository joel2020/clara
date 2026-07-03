"use client";

import { useState } from "react";
import { Volume2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/lib/db/types";
import { ITEM_BY_ID } from "@/lib/content/lessons";
import { playPronunciation } from "@/lib/speech/player";
import { useSettings } from "@/lib/hooks/useSettings";
import { sfx } from "@/lib/sfx";
import { t } from "@/lib/i18n";
import { introFor } from "@/lib/content/es";

// The "Learn" stage: a short, warm mini-class before any drilling. What the
// sound is, why Spanish speakers trip on it, how to physically make it — with
// tappable examples in Joel's voice.

export function LearnIntro({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const intro = introFor(lesson.id, lesson.intro, lang);
  const [playing, setPlaying] = useState<string | null>(null);

  if (!intro) return null;

  const examples = intro.exampleIds
    .map((id) => ITEM_BY_ID.get(id) ?? lesson.items.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const play = (id: string, text: string) => {
    setPlaying(id);
    playPronunciation({
      id,
      text,
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
      onEnd: () => setPlaying((p) => (p === id ? null : p)),
    });
  };

  return (
    <div className="animate-fade-up">
      <p className="mx-auto max-w-md text-center text-lg leading-relaxed text-foreground/90">{intro.summary}</p>

      {/* Why it's tricky */}
      <div className="mt-10 border-t border-hairline pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("whyTricky", lang)}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">{intro.whyTricky}</p>
      </div>

      {/* How to make it */}
      <div className="mt-8 border-t border-hairline pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("howToMakeIt", lang)}</p>
        <ol className="mt-3 space-y-3">
          {intro.how.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 font-mono text-[13px] tabular-nums text-primary">{i + 1}</span>
              <span className="text-[15px] leading-relaxed text-foreground/85">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Hear it */}
      {examples.length > 0 && (
        <div className="mt-8 border-t border-hairline pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("hearIt", lang)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {examples.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => play(item.id, item.text)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium",
                  "transition-all hover:border-foreground/30 active:scale-[0.97]",
                  playing === item.id && "border-primary/50 bg-primary/[0.06] text-primary",
                )}
              >
                <Volume2 className={cn("size-3.5", playing === item.id && "animate-pulse")} />
                {item.text}
                {item.note && <span className="text-[10px] uppercase text-muted-foreground">({item.note})</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={() => {
            sfx.tap();
            onStart();
          }}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {t("letsPractice", lang)}
          <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
