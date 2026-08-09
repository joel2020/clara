"use client";

import { useEffect, useRef } from "react";
import { Volume2 } from "lucide-react";
import { t, type CoachLang } from "@/lib/i18n";
import { shouldShowInline, type CallState } from "@/lib/virtual-call/session";
import { CorrectionCard } from "./correction-card";
import type { CallEntry } from "./use-virtual-call";

// The running conversation.
//
// The guide's reply is ALWAYS rendered as text, whether or not the audio played,
// so a learner on a muted phone, a failed TTS call, or a screen reader loses
// nothing. The replay button is an extra, never the only way to receive a line.

function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function Transcript({
  entries,
  state,
  lang,
  onReplay,
}: {
  entries: CallEntry[];
  state: CallState;
  lang: CoachLang;
  onReplay: (text: string) => void;
}) {
  const endRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "nearest" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-hairline px-4 py-6 text-center text-sm text-muted-foreground">
        {t("vcallTranscriptEmpty", lang)}
      </p>
    );
  }

  return (
    <ol className="space-y-4" aria-label={t("vcallTranscriptLabel", lang)}>
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        if (entry.kind === "guide") {
          return (
            <li key={entry.id} ref={last ? endRef : undefined} className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                {t("vcallGuideName", lang)}
              </p>
              <div className="mt-1 rounded-2xl rounded-tl-md border border-hairline bg-card px-3.5 py-3">
                <p lang="en" className="break-words font-medium leading-relaxed">
                  {entry.text}
                </p>
                {entry.textEs && lang === "es" && (
                  <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">{entry.textEs}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onReplay(entry.text)}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Volume2 className="size-3.5" aria-hidden />
                {t("vcallReplay", lang)}
              </button>
            </li>
          );
        }

        const turn = state.turns[entry.turnIndex];
        const correction = turn?.correction ?? null;
        return (
          <li key={entry.id} ref={last ? endRef : undefined} className="min-w-0">
            <p className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("vcallYouSaid", lang)}
            </p>
            <div className="mt-1 flex justify-end">
              <p
                lang="en"
                className="max-w-[92%] break-words rounded-2xl rounded-tr-md bg-primary px-3.5 py-3 leading-relaxed text-primary-foreground"
              >
                {entry.text}
              </p>
            </div>
            {/* Inline, below the turn — the conversation above stays readable. */}
            {correction && shouldShowInline(correction) && (
              <CorrectionCard
                correction={correction}
                lang={lang}
                fixed={correction.kind === "pronunciation"
                  ? turn?.pronunciation?.scripted?.outcome === "mastered"
                  : Boolean(turn?.retry?.accepted)}
                className="mt-2"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
