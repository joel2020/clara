"use client";

import { Loader2, Mic, Square } from "lucide-react";
import type { PracticeItem } from "@/lib/db/types";
import type { PracticeOutcome } from "@/lib/practice";
import { useSettings } from "@/lib/hooks/useSettings";
import { playPronunciation, stopPronunciation } from "@/lib/speech/player";
import { sfx } from "@/lib/sfx";
import { juice } from "@/components/juice";
import { CharacterIllustration } from "@/components/character";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { PronunciationFeedback } from "./pronunciation-feedback";
import { usePronunciationCoach } from "./use-pronunciation-coach";

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
  combo: number;
  onOutcome?: (outcome: PracticeOutcome) => void;
  onNext: () => void;
  hasNext: boolean;
}) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const coach = usePronunciationCoach({
    item,
    lessonId,
    itemPool,
    combo,
    recognitionLang: settings.recognitionLang,
    cefr: settings.onboarding?.level ?? "A1",
    onOutcome: (outcome) => {
      onOutcome?.(outcome);
      if (!outcome.recorded) return;
      if (outcome.score.passed) {
        sfx.correct(outcome.rewards.combo);
        juice.centerBurst(outcome.rewards.starsEarned > 0 ? `+${outcome.rewards.starsEarned} ★` : undefined);
      } else {
        sfx.wrong();
      }
    },
  });

  const listen = (rate: 0.65 | 1) => playPronunciation({
    id: item.id,
    text: item.text,
    rate,
    voiceURI: settings.voiceURI,
  });

  const advance = () => {
    stopPronunciation();
    coach.cancel();
    coach.resetSession();
    onNext();
  };

  if ((coach.phase === "feedback" || coach.phase === "save-recovery") && coach.feedback) {
    return (
      <PronunciationFeedback
        target={item.text}
        heard={coach.feedback.heard}
        verdict={coach.feedback.verdict}
        diagnosis={coach.feedback.diagnosis}
        contrast={coach.feedback.contrast}
        transition={coach.feedback.transition}
        currentScore={coach.feedback.currentScore}
        scores={coach.feedback.scores}
        lang={lang}
        onListen={listen}
        onRetry={() => void coach.start()}
        onContinue={() => {
          advance();
        }}
        onTranscriptPractice={() => void coach.practiceWithoutGrade()}
        onTechnicalSkip={() => {
          coach.skipTechnical();
          advance();
        }}
        saveFailure={coach.phase === "save-recovery"
          ? coach.recovery === "account-changed" ? "account-changed" : "storage"
          : undefined}
        onRetrySave={() => void coach.retrySave()}
        onAccountChanged={advance}
      />
    );
  }

  if (coach.phase === "ungraded-practice") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-hairline bg-card p-6 text-center" role="status" aria-live="polite">
        <CharacterIllustration mode="bust" mood="encourage" className="mx-auto size-24" />
        <h2 className="mt-3 font-display text-2xl font-semibold">{t("pronUngraded", lang)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("pronUngradedBody", lang)}</p>
        <p lang="en" className="mt-3 font-display text-xl">“{coach.ungradedHeard || "—"}”</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => void coach.start()} className="min-h-11 rounded-xl border border-hairline px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {t("pronRetryScoring", lang)}
          </button>
          <button type="button" onClick={advance} className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {hasNext ? t("next", lang) : t("finish", lang)}
          </button>
        </div>
      </div>
    );
  }

  const busy = coach.phase === "capturing" || coach.phase === "assessing";
  const capturing = coach.phase === "capturing";
  const recoveryCopy = coach.recovery === "permission"
    ? t("pronMicPermission", lang)
    : coach.recovery === "no-speech"
      ? t("pronNoSpeech", lang)
      : coach.recovery === "account-changed"
        ? t("pronAccountChangedBody", lang)
      : t("recGeneric", lang);

  return (
    <div className="grid w-full max-w-xl gap-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
      <div className="flex justify-center" aria-hidden="true">
        <CharacterIllustration mode="bust" mood={busy ? "think" : "point"} className="size-24 shrink-0" />
      </div>
      <div className="flex min-w-0 flex-col items-center gap-4 rounded-3xl border border-hairline bg-card p-5 text-center">
        {coach.phase === "recovery" && (
          <p role="status" aria-live="polite" className="rounded-2xl border border-warn/30 bg-warn/[0.08] px-4 py-3 text-sm text-foreground">
            {recoveryCopy}
          </p>
        )}
        {capturing ? (
          <button type="button" onClick={coach.stop} aria-label={t("stopRecording", lang)} className="relative grid size-20 place-items-center rounded-full bg-card text-destructive ring-1 ring-destructive/40 outline-none focus-visible:ring-3 focus-visible:ring-ring">
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/15 motion-reduce:animate-none" aria-hidden="true" />
            <Square className="size-6 fill-current" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void coach.start()}
            disabled={!recognitionSupported || coach.phase === "assessing"}
            aria-label={t("pronRecordAria", lang)}
            className={cn("grid size-20 place-items-center rounded-full bg-foreground text-background shadow-sm outline-none transition-transform hover:scale-[1.04] active:scale-95 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none", "disabled:opacity-30")}
          >
            {coach.phase === "assessing" ? <Loader2 className="size-7 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Mic className="size-7" aria-hidden="true" />}
          </button>
        )}
        <span className="text-sm font-medium text-muted-foreground">
          {capturing ? t(coach.mode === "record" ? "recording" : "listening", lang) : coach.phase === "assessing" ? t("checking", lang) : t("tapToSpeak", lang)}
        </span>
      </div>
    </div>
  );
}
