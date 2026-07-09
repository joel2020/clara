"use client";

import { useRef, useState } from "react";
import { Volume2, ArrowRight, ArrowLeft, Lightbulb, Puzzle, ListOrdered, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lesson } from "@/lib/db/types";
import { ITEM_BY_ID } from "@/lib/content/lessons";
import { playPronunciation } from "@/lib/speech/player";
import { useSettings } from "@/lib/hooks/useSettings";
import { sfx } from "@/lib/sfx";
import { t } from "@/lib/i18n";
import { introFor } from "@/lib/content/es";
import { Lumi, type LumiMood } from "@/components/lumi";

// The "Learn" stage as a mini-class card deck: Lumi presents one idea per
// card (idea → why it's tricky → how to make it → hear it), swipeable and
// tappable, so the lesson opener feels like part of the game instead of an
// article. The last card carries the "let's practice" CTA.

type Card =
  | { kind: "idea"; title: string; body: string }
  | { kind: "why"; title: string; body: string }
  | { kind: "how"; title: string; steps: string[] }
  | { kind: "hear"; title: string };

const CARD_ART: Record<Card["kind"], { mood: LumiMood; icon: typeof Lightbulb }> = {
  idea: { mood: "wave", icon: Lightbulb },
  why: { mood: "think", icon: Puzzle },
  how: { mood: "idle", icon: ListOrdered },
  hear: { mood: "cheer", icon: Headphones },
};

export function LearnIntro({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const intro = introFor(lesson.id, lesson.intro, lang);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [playing, setPlaying] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);

  if (!intro) return null;

  const examples = intro.exampleIds
    .map((id) => ITEM_BY_ID.get(id) ?? lesson.items.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  const cards: Card[] = [
    { kind: "idea", title: t("introIdea", lang), body: intro.summary },
    { kind: "why", title: t("whyTricky", lang), body: intro.whyTricky },
    { kind: "how", title: t("howToMakeIt", lang), steps: intro.how },
    ...(examples.length > 0 ? [{ kind: "hear", title: t("hearIt", lang) } as Card] : []),
  ];
  const card = cards[idx];
  const last = idx === cards.length - 1;
  const art = CARD_ART[card.kind];
  const Icon = art.icon;

  const go = (next: number) => {
    if (next < 0 || next >= cards.length) return;
    setDir(next > idx ? 1 : -1);
    setIdx(next);
    sfx.tap();
  };

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
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2" aria-label={`${idx + 1} ${t("introCardOf", lang)} ${cards.length}`}>
        {cards.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`${i + 1}`}
            className={cn(
              "h-2 rounded-full transition-all",
              i === idx ? "w-6 bg-primary" : "w-2 bg-muted-foreground/25 hover:bg-muted-foreground/40",
            )}
          />
        ))}
      </div>

      {/* The card */}
      <div
        key={idx}
        className={cn("mt-5", dir === 1 ? "intro-card-in" : "intro-card-in-back")}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) < 48) return;
          go(dx < 0 ? idx + 1 : idx - 1);
        }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-hairline bg-card p-6 shadow-[0_18px_44px_-24px_rgba(18,58,147,0.25)] sm:p-8">
          {/* soft corner glow so each card feels like a game panel */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full opacity-25"
            style={{ background: "radial-gradient(circle, var(--co-yellow), transparent 70%)" }}
          />

          <div className="flex items-center gap-4">
            <Lumi frame="bust" mood={art.mood} className="size-16 shrink-0" />
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <Icon className="size-3.5" />
                {card.title}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                {idx + 1} {t("introCardOf", lang)} {cards.length}
              </p>
            </div>
          </div>

          <div className="mt-5">
            {(card.kind === "idea" || card.kind === "why") && (
              <p className={cn("leading-relaxed text-foreground/90", card.kind === "idea" ? "font-display text-xl" : "text-[16px]")}>
                {card.body}
              </p>
            )}

            {card.kind === "how" && (
              <ol className="space-y-3">
                {card.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 rounded-2xl bg-secondary/60 px-4 py-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[12px] tabular-nums text-primary">
                      {i + 1}
                    </span>
                    <span className="text-[15px] leading-relaxed text-foreground/90">{step}</span>
                  </li>
                ))}
              </ol>
            )}

            {card.kind === "hear" && (
              <div className="flex flex-wrap gap-2.5">
                {examples.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => play(item.id, item.text)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-5 py-3 text-[15px] font-medium",
                      "transition-all hover:border-foreground/30 active:scale-[0.97]",
                      playing === item.id
                        ? "border-primary/50 bg-primary/[0.07] text-primary"
                        : "border-border bg-background",
                    )}
                  >
                    <Volume2 className={cn("size-4", playing === item.id && "animate-pulse")} />
                    {item.text}
                    {item.note && <span className="text-[10px] uppercase text-muted-foreground">({item.note})</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deck controls */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(idx - 1)}
          disabled={idx === 0}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98]",
            idx === 0 ? "invisible" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-4" />
          {t("introBack", lang)}
        </button>

        {last ? (
          <button
            type="button"
            onClick={() => {
              sfx.tap();
              onStart();
            }}
            className="sheen inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {t("letsPractice", lang)}
            <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(idx + 1)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {t("introNext", lang)}
            <ArrowRight className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
