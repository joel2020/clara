"use client";

import { useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeItem } from "@/lib/db/types";
import { createRecognition, recognitionMode, RecognitionError } from "@/lib/speech/recognition";
import { recordPracticeAttempt, type PracticeOutcome } from "@/lib/practice";
import { useSettings } from "@/lib/hooks/useSettings";
import { sfx } from "@/lib/sfx";
import { t, partnerFeedback, type CoachLang } from "@/lib/i18n";
import { popConfetti } from "@/lib/fx";

type Phase = "idle" | "listening" | "scoring" | "result";

export function ProducePanel({
  item,
  lessonId,
  itemPool,
  recognitionSupported,
  combo,
  onOutcome,
  onNext,
  hasNext,
}: {
  item: PracticeItem;
  lessonId: string;
  itemPool: PracticeItem[];
  recognitionSupported: boolean;
  combo: number; // session combo BEFORE this attempt
  onOutcome?: (outcome: PracticeOutcome) => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const [phase, setPhase] = useState<Phase>("idle");
  const [outcome, setOutcome] = useState<PracticeOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<ReturnType<typeof createRecognition> | null>(null);
  // "record" = iOS-style capture-then-transcribe (she taps stop); "instant" = Web Speech.
  const mode = recognitionMode();

  const reset = () => {
    setPhase("idle");
    setOutcome(null);
    setError(null);
  };

  const record = async () => {
    setError(null);
    setOutcome(null);
    setPhase("listening");
    sfx.tap();
    const h = createRecognition({ lang: settings.recognitionLang });
    setHandle(h);
    try {
      const r = await h.result;
      setPhase("scoring");
      const result = await recordPracticeAttempt({
        item,
        lessonId,
        transcript: r.transcript,
        alternatives: r.alternatives,
        combo: combo + 1,
        itemPool,
      });
      setOutcome(result);
      setPhase("result");
      if (result.score.passed) {
        sfx.correct(result.rewards.combo);
        popConfetti();
      } else {
        sfx.wrong();
      }
      onOutcome?.(result);
    } catch (e) {
      const msg = e instanceof RecognitionError ? e.message : lang === "es" ? "Algo salió mal. Intenta otra vez." : "Something went wrong. Try again.";
      if (!(e instanceof RecognitionError && e.code === "cancelled")) setError(msg);
      setPhase("idle");
    } finally {
      setHandle(null);
    }
  };

  const stop = () => {
    // In record mode, stopping kicks off the upload/transcription — show it.
    if (mode === "record") setPhase("scoring");
    handle?.stop();
  };

  if (phase === "result" && outcome) {
    return (
      <ResultCard
        outcome={outcome}
        target={item.text}
        lang={lang}
        onRetry={() => {
          reset();
          record();
        }}
        onNext={() => {
          reset();
          onNext();
        }}
        hasNext={hasNext}
      />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {phase === "listening" ? (
        <button
          type="button"
          onClick={stop}
          aria-label={t("stopRecording", lang)}
          className="relative grid size-20 place-items-center rounded-full bg-card text-destructive ring-1 ring-destructive/40 transition-transform active:scale-95"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive/15" aria-hidden />
          <Square className="size-6 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          onClick={record}
          disabled={!recognitionSupported || phase === "scoring"}
          aria-label="Record your pronunciation"
          className={cn(
            "grid size-20 place-items-center rounded-full bg-foreground text-background shadow-sm",
            "transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-30 disabled:hover:scale-100",
          )}
        >
          {phase === "scoring" ? <Loader2 className="size-7 animate-spin" /> : <Mic className="size-7" />}
        </button>
      )}

      <span className="text-sm font-medium text-muted-foreground">
        {phase === "listening"
          ? t(mode === "record" ? "recording" : "listening", lang)
          : phase === "scoring"
            ? t("checking", lang)
            : recognitionSupported
              ? t(mode === "record" ? "tapToRecord" : "tapToSpeak", lang)
              : t("noRecognition", lang)}
      </span>

      {error && (
        <p className="rounded-xl border border-warn/30 bg-warn/[0.06] px-4 py-2 text-center text-sm text-warn-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

// Rotating Spanish celebrations — a little home-language warmth on every win.
const CELEBRATIONS = ["¡Eso!", "¡Perfecto!", "¡Muy bien!", "¡Qué bien suena!", "¡Increíble!"];
const NUDGES = ["Casi, casi.", "Otra vez — tú puedes.", "Ya casi lo tienes."];

function ResultCard({
  outcome,
  target,
  lang,
  onRetry,
  onNext,
  hasNext,
}: {
  outcome: PracticeOutcome;
  target: string;
  lang: CoachLang;
  onRetry: () => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const { score: result, rewards } = outcome;
  const passed = result.passed;
  const spanish = passed
    ? CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)]
    : NUDGES[Math.floor(Math.random() * NUDGES.length)];
  return (
    <div className="animate-fade-up text-center" role="status" aria-live="polite">
      <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", passed ? "text-primary" : "text-muted-foreground")}>
        {spanish}
      </p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <span
          className={cn("size-2.5 rounded-full", passed ? "bg-success" : result.heardPartner ? "bg-destructive" : "bg-warn")}
          aria-hidden
        />
        <h3 className="font-display text-2xl font-medium tracking-[-0.01em]">
          {passed ? t("resultClear", lang) : result.heardPartner ? t("resultWrongTwin", lang) : t("resultAlmost", lang)}
        </h3>
        <span className="font-mono text-base tabular-nums text-muted-foreground">{result.score}%</span>
      </div>

      {/* Reward line: XP + combo */}
      <div className="mt-3 flex items-center justify-center gap-2">
        <span
          className={cn(
            "animate-scale-in rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums",
            passed ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          +{rewards.xpGain} XP
        </span>
        {passed && rewards.combo >= 2 && (
          <span className="animate-scale-in rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn-foreground">
            {rewards.combo}× combo
          </span>
        )}
      </div>

      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {lang === "es"
          ? result.feedbackKey === "partner"
            ? partnerFeedback(result.heard, target, lang)
            : t(
                result.feedbackKey === "perfect"
                  ? "fbPerfect"
                  : result.feedbackKey === "pass"
                    ? "fbNice"
                    : result.feedbackKey === "close"
                      ? "fbClose"
                      : "fbNotQuite",
                lang,
              )
          : result.feedback}
      </p>

      <div className="mx-auto mt-4 max-w-xs border-y border-hairline py-3 text-sm">
        <span className="text-muted-foreground">{t("heard", lang)} </span>
        <span className={cn("font-medium", result.heardPartner ? "text-destructive" : "text-foreground")}>
          “{result.heard || "—"}”
        </span>
        {!passed && (
          <span className="text-muted-foreground">
            {" · "}{t("wanted", lang)} <span className="font-medium text-foreground">“{target}”</span>
          </span>
        )}
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground/80 transition-all hover:border-foreground/30 hover:text-foreground active:scale-[0.98]"
        >
          {t("tryAgain", lang)}
        </button>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {hasNext ? t("next", lang) : t("finish", lang)}
        </button>
      </div>
    </div>
  );
}
