"use client";

import { Check, Mic, Square, Volume2, X } from "lucide-react";
import { t, type CoachLang } from "@/lib/i18n";
import { retryReferenceSentence, type RetryOutcome, type TurnCorrection } from "@/lib/virtual-call/session";
import { cn } from "@/lib/utils";

// The retry prompt — practice mode's whole point.
//
// It sits in the composer, directly above the controls, rather than over the
// conversation: the corrected sentence has to be readable at the same time as
// the turn it came from. One attempt only (lib/virtual-call/session.ts decides
// that, not this component), so the outcome is stated plainly either way and
// the call moves on.

export function RetryPrompt({
  correction,
  lang,
  recording,
  disabled,
  onRecord,
  onStop,
  onListen,
}: {
  correction: TurnCorrection;
  lang: CoachLang;
  recording: boolean;
  disabled: boolean;
  onRecord: () => void;
  onStop: () => void;
  onListen: (rate: 0.65 | 1) => void;
}) {
  const referenceSentence = retryReferenceSentence(correction);
  return (
    <div className="rounded-2xl border border-warn/55 bg-warn/[0.08] p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {t("vcallRetryTitle", lang)}
      </p>
      <p lang="en" className="mt-1.5 break-words font-display text-lg font-medium leading-snug">
        {referenceSentence}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("vcallRetryHelp", lang)}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recording ? onStop : onRecord}
          disabled={disabled}
          className={cn(
            "inline-flex min-h-11 flex-1 basis-40 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-45",
            recording ? "bg-destructive text-white" : "bg-foreground text-background",
          )}
        >
          {recording ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-4" aria-hidden />}
          {recording ? t("vcallStop", lang) : t("vcallRetryBtn", lang)}
        </button>
        <button
          type="button"
          onClick={() => onListen(0.65)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40"
        >
          <Volume2 className="size-4" aria-hidden />
          {t("vcallReplaySlow", lang)}
        </button>
        <button
          type="button"
          onClick={() => onListen(1)}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 motion-reduce:transition-none"
        >
          <Volume2 className="size-4" aria-hidden />
          {t("vcallReplayNormal", lang)}
        </button>
      </div>
    </div>
  );
}

/** Accepted or not — stated after the single attempt, never left ambiguous. */
export function RetryOutcomeNote({ outcome, lang }: { outcome: RetryOutcome; lang: CoachLang }) {
  const transcriptUnavailable = outcome.transcriptStatus === "unavailable";
  const accepted = outcome.accepted;
  const acousticallyMastered = outcome.pronunciationOutcome === "mastered";
  const positive = outcome.pronunciationOutcome ? acousticallyMastered : accepted;
  const pronunciationKey = outcome.pronunciationOutcome === "mastered" ? "vcallRetryPronMastered"
    : outcome.pronunciationOutcome === "retry" ? "vcallRetryPronPracticed"
      : outcome.pronunciationOutcome === "diagnostic" ? "vcallRetryPronDiagnostic"
        : outcome.pronunciationOutcome === "technical-skip" || transcriptUnavailable ? "vcallRetryPronUnavailable" : null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-2xl border px-3.5 py-3 text-sm",
        positive ? "border-success/50 bg-success/[0.08]" : "border-hairline bg-secondary",
      )}
    >
      {!transcriptUnavailable && (
        <p className={cn("flex items-center gap-2 font-medium", positive ? "text-success" : "text-foreground")}>
          {accepted ? <Check className="size-4 shrink-0" aria-hidden /> : <X className="size-4 shrink-0" aria-hidden />}
          {t(accepted ? "vcallRetryAccepted" : "vcallRetryMissed", lang)}
        </p>
      )}
      {pronunciationKey && <p className="mt-1 font-medium text-foreground">{t(pronunciationKey, lang)}</p>}
      {!transcriptUnavailable && (
        <p className="mt-1 break-words text-muted-foreground">
          {t("vcallRetryHeard", lang)}: <span lang="en">{outcome.transcript}</span>
        </p>
      )}
    </div>
  );
}
