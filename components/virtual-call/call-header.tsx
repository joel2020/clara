"use client";

import { Clock3 } from "lucide-react";
import type { VirtualCallScenario } from "@/lib/content/virtual-call-scenarios";
import { t, type CoachLang, type StringKey } from "@/lib/i18n";
import type { CorrectionMode } from "@/lib/virtual-call/session";
import { cn } from "@/lib/utils";
import { AiDisclosure } from "./ai-disclosure";
import { formatClock, formatSpokenDuration } from "./format";

// Who she is talking to, how long she has been talking, how Clara is correcting
// her — and, pinned underneath and never dismissible, what Clara actually is.

const MODE_LABEL: Record<CorrectionMode, StringKey> = {
  natural: "vcModeNatural",
  practice: "vcModePractice",
};

export function CallHeader({
  scenario,
  mode,
  lang,
  elapsedMs,
  remainingMs,
}: {
  scenario: VirtualCallScenario;
  mode: CorrectionMode;
  lang: CoachLang;
  elapsedMs: number;
  remainingMs: number;
}) {
  return (
    <header className="space-y-2.5 border-b border-hairline pb-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="min-w-0 font-display text-lg font-medium tracking-[-0.01em] sm:text-xl">
          {scenario.title[lang]}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]",
              mode === "practice"
                ? "border-warn/50 bg-warn/[0.1] text-foreground"
                : "border-hairline bg-secondary text-muted-foreground",
            )}
          >
            <span className="sr-only">{t("vcMode", lang)}: </span>
            {t(MODE_LABEL[mode], lang)}
          </span>
          <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
            <Clock3 className="size-3.5 text-muted-foreground" aria-hidden />
            {/* Not a live region: announcing every second would make the call
                unusable with a screen reader. The label is there on demand. */}
            <span aria-label={`${t("vcallElapsed", lang)}: ${formatSpokenDuration(elapsedMs)}`}>
              {formatClock(elapsedMs)}
            </span>
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatClock(remainingMs)} {t("vcallTimeLeft", lang)}
      </p>
      <AiDisclosure lang={lang} />
    </header>
  );
}
