"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mic, Square, Star, Volume2 } from "lucide-react";
import type { PracticeItem } from "@/lib/db/types";
import { useSettings } from "@/lib/hooks/useSettings";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { playPronunciation, stopPronunciation, pickDrillVoice } from "@/lib/speech/player";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sfx";
import { juice } from "@/components/juice";
import { Lumi } from "@/components/lumi";
import { gradedAccuracy, shouldCelebrateGradedCompletion } from "@/lib/speech/graded-round";
import { PronunciationFeedback } from "./pronunciation-feedback";
import { usePronunciationCoach, type PronunciationCoachPhase } from "./use-pronunciation-coach";

const ROUND_LENGTH = 8;
const EMPTY_ITEM: PracticeItem = {
  id: "empty",
  text: "",
  ipa: "",
  mouthHint: "",
  kind: "phrase",
  categoryId: "empty",
  phoneme: "",
};

export function ShadowRound({
  items,
  onExit,
  onComplete = onExit,
  onTechnicalExit = onExit,
  technicalExitLabel,
}: {
  items: PracticeItem[];
  onExit: () => void;
  onComplete?: () => void;
  onTechnicalExit?: () => void;
  technicalExitLabel?: string;
}) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const support = useSpeechSupport();
  const round = useMemo(() => shuffle(items).slice(0, Math.min(ROUND_LENGTH, items.length)), [items]);
  const voices = useMemo(() => round.map(() => pickDrillVoice().slug), [round]);
  const [idx, setIdx] = useState(0);
  const [listening, setListening] = useState(true);
  const [done, setDone] = useState(false);
  const [totalStars, setTotalStars] = useState(0);
  const [clears, setClears] = useState(0);
  const [gradedAttempts, setGradedAttempts] = useState(0);
  const [hadUngradedSkip, setHadUngradedSkip] = useState(false);
  const current = round[idx] ?? EMPTY_ITEM;
  const voiceSlug = voices[idx];

  const coach = usePronunciationCoach({
    item: current,
    lessonId: current.id.split(":")[0] || "shadow",
    itemPool: items,
    combo: clears,
    recognitionLang: settings.recognitionLang,
    cefr: settings.onboarding?.level ?? "A1",
    onOutcome: (outcome) => {
      if (!outcome.recorded) return;
      setGradedAttempts((value) => value + 1);
      if (outcome.score.passed) {
        setClears((value) => value + 1);
        setTotalStars((value) => value + outcome.rewards.starsEarned);
        sfx.correct(outcome.rewards.combo);
        juice.centerBurst(outcome.rewards.starsEarned > 0 ? `+${outcome.rewards.starsEarned} ★` : undefined);
      } else {
        sfx.wrong();
      }
    },
  });
  const cancelCapture = coach.cancel;

  const playModel = useCallback((rate: 0.65 | 1 = 1) => {
    if (!current.text) return;
    setListening(true);
    playPronunciation({
      id: current.id,
      text: current.text,
      voice: voiceSlug,
      rate,
      voiceURI: settings.voiceURI,
      onEnd: () => setListening(false),
    });
  }, [current, voiceSlug, settings.voiceURI]);

  const stopAllAudio = useCallback(() => {
    stopPronunciation();
    cancelCapture();
  }, [cancelCapture]);

  useEffect(() => {
    if (!current.text || done) return;
    const timer = setTimeout(() => playModel(), 250);
    return () => {
      clearTimeout(timer);
      stopPronunciation();
    };
  }, [current.id, current.text, done, playModel]);
  useEffect(() => () => stopAllAudio(), [stopAllAudio]);

  const advance = (gradedCompletion: boolean) => {
    stopAllAudio();
    if (!gradedCompletion) setHadUngradedSkip(true);
    coach.resetSession();
    if (idx + 1 >= round.length) {
      setDone(true);
      if (shouldCelebrateGradedCompletion({ gradedAttempts, completedWithGradedResult: gradedCompletion, hadUngradedSkip: hadUngradedSkip || !gradedCompletion })) {
        sfx.finish();
      }
      return;
    }
    setIdx((value) => value + 1);
    setListening(true);
  };

  if (support && !support.recognition) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <Lumi frame="bust" mood="think" className="mx-auto size-28" />
        <p className="mt-4 font-display text-2xl font-medium">{t("shadowNeedsMic", lang)}</p>
        <button type="button" onClick={() => { stopAllAudio(); onTechnicalExit(); }} className="mt-6 min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background outline-none focus-visible:ring-3 focus-visible:ring-ring">
          {technicalExitLabel ?? t("navLessons", lang)}
        </button>
      </div>
    );
  }

  if (done) {
    const accuracy = gradedAccuracy(clears, gradedAttempts);
    const neutral = accuracy === null || hadUngradedSkip;
    return (
      <div className="px-5 py-14 text-center">
        <Lumi frame="bust" mood={neutral ? "think" : "cheer"} className="mx-auto size-28" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("shadowTitle", lang)}</p>
        <h1 className="mt-3 inline-flex items-center gap-2 font-display text-5xl font-medium">
          {accuracy === null ? t("pronTechnicalTitle", lang) : totalStars}
          {accuracy !== null && <Star className="size-9 text-co-yellow" fill="currentColor" strokeWidth={0} aria-hidden="true" />}
        </h1>
        <div className="mx-auto mt-8 flex max-w-sm divide-x divide-hairline border-y border-hairline">
          <Cell value={`${clears}/${gradedAttempts}`} label={t("clear", lang)} />
          <Cell value={accuracy === null ? "—" : `${accuracy}%`} label={t("accuracy", lang)} />
          <Cell value={`${totalStars} ★`} label={t("stars", lang)} />
        </div>
        <button type="button" onClick={() => { stopAllAudio(); onComplete(); }} className="mt-8 min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background outline-none focus-visible:ring-3 focus-visible:ring-ring">
          {t("finish", lang)}
        </button>
      </div>
    );
  }

  if (!current.text) return null;

  if ((coach.phase === "feedback" || coach.phase === "save-recovery") && coach.feedback) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-8">
        <PronunciationFeedback
          target={current.text}
          heard={coach.feedback.heard}
          verdict={coach.feedback.verdict}
          diagnosis={coach.feedback.diagnosis}
          contrast={coach.feedback.contrast}
          transition={coach.feedback.transition}
          currentScore={coach.feedback.currentScore}
          scores={coach.feedback.scores}
          lang={lang}
          onListen={(rate) => playModel(rate)}
          onRetry={() => void coach.start()}
          onContinue={() => advance(true)}
          onTranscriptPractice={() => void coach.practiceWithoutGrade()}
          onTechnicalSkip={() => {
            coach.skipTechnical();
            advance(false);
          }}
          saveFailure={coach.phase === "save-recovery"
            ? coach.recovery === "account-changed" ? "account-changed" : "storage"
            : undefined}
          onRetrySave={() => void coach.retrySave()}
          onAccountChanged={() => { stopAllAudio(); onExit(); }}
        />
      </div>
    );
  }

  if (coach.phase === "ungraded-practice") {
    return (
      <div className="mx-auto max-w-md px-5 py-14 text-center" role="status" aria-live="polite">
        <Lumi frame="bust" mood="encourage" className="mx-auto size-24" />
        <h2 className="mt-3 font-display text-2xl font-semibold">{t("pronUngraded", lang)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("pronUngradedBody", lang)}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => void coach.start()} className="min-h-11 rounded-xl border border-hairline px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">{t("pronRetryScoring", lang)}</button>
          <button type="button" onClick={() => advance(false)} className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-medium text-background outline-none focus-visible:ring-3 focus-visible:ring-ring">{t("pronContinue", lang)}</button>
        </div>
      </div>
    );
  }

  const accountChanged = coach.recovery === "account-changed";
  const recoveryText = coach.recovery === "permission"
    ? t("pronMicPermission", lang)
    : coach.recovery === "no-speech"
      ? t("pronNoSpeech", lang)
      : accountChanged
        ? t("pronAccountChangedBody", lang)
        : null;
  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => { stopAllAudio(); onExit(); }} className="min-h-11 rounded-lg px-2 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring">{t("shadowExit", lang)}</button>
        <span className="font-mono text-sm text-muted-foreground">{idx + 1} / {round.length}</span>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center">
        <Lumi frame="bust" mood={listening ? "think" : "point"} className="mx-auto size-24 shrink-0" />
        <div className="min-w-0 rounded-3xl border border-hairline bg-card p-6 text-center">
          <h1 lang="en" className="font-display text-3xl font-medium leading-tight tracking-[-0.02em] sm:text-4xl">{current.text}</h1>
          {current.meaning && lang === "es" && <p className="mt-2 text-muted-foreground">{current.meaning}</p>}
          <button type="button" onClick={() => playModel()} disabled={coach.phase === "capturing" || coach.phase === "assessing"} className="mt-5 min-h-11 rounded-xl border border-hairline px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40">
            <Volume2 className="mr-2 inline size-4" aria-hidden="true" />{t("shadowReplay", lang)}
          </button>
          {recoveryText && <p role="status" aria-live="polite" className="mt-4 rounded-xl border border-warn/30 bg-warn/[0.08] p-3 text-sm text-foreground">{recoveryText}</p>}
          {accountChanged ? (
            <button type="button" onClick={() => { stopAllAudio(); onExit(); }} className="mt-5 min-h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background outline-none focus-visible:ring-3 focus-visible:ring-ring">
              {t("pronAccountChangedAction", lang)}
            </button>
          ) : (
            <ShadowCaptureControl
              phase={coach.phase}
              mode={coach.mode}
              listening={listening}
              lang={lang}
              onStop={coach.stop}
              onStart={() => {
                stopPronunciation();
                void coach.start();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function ShadowCaptureControl({
  phase,
  mode,
  listening,
  lang,
  onStart,
  onStop,
}: {
  phase: PronunciationCoachPhase;
  mode: string;
  listening: boolean;
  lang: "en" | "es";
  onStart: () => void;
  onStop: () => void;
}) {
  const capturing = phase === "capturing";
  return (
    <>
      {capturing ? (
        <button
          type="button"
          onClick={onStop}
          aria-label={t("stopRecording", lang)}
          className="relative mx-auto mt-5 grid size-20 place-items-center rounded-full bg-card text-destructive ring-1 ring-destructive/40 outline-none focus-visible:ring-3 focus-visible:ring-ring"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-destructive/15 motion-reduce:animate-none" aria-hidden="true" />
          <Square className="size-6 fill-current" aria-hidden="true" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          disabled={listening || phase === "assessing"}
          aria-label={t("shadowRepeat", lang)}
          className="mx-auto mt-5 grid size-20 place-items-center rounded-full bg-foreground text-background shadow-sm outline-none transition-transform hover:scale-[1.04] focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40 motion-reduce:transition-none"
        >
          {phase === "assessing" ? <Loader2 className="size-7 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Mic className="size-7" aria-hidden="true" />}
        </button>
      )}
      <p role="status" aria-live="polite" className="mt-3 text-sm font-medium text-muted-foreground">
        {capturing ? t(mode === "record" ? "recording" : "listening", lang) : phase === "assessing" ? t("checking", lang) : listening ? t("shadowListen", lang) : t("shadowRepeat", lang)}
      </p>
    </>
  );
}

function Cell({ value, label }: { value: string; label: string }) {
  return <div className="flex-1 px-3 py-4"><div className="font-display text-2xl font-medium tabular-nums">{value}</div><div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div></div>;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}
