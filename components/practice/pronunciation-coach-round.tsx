"use client";

import { useEffect, useRef } from "react";
import { Loader2, Mic, RotateCcw, Square, Volume2 } from "lucide-react";
import { Lumi } from "@/components/lumi";
import type { PracticeItem } from "@/lib/db/types";
import type { PracticeOutcome } from "@/lib/practice";
import { useSettings } from "@/lib/hooks/useSettings";
import { playPronunciation, stopPronunciation } from "@/lib/speech/player";
import { cn } from "@/lib/utils";
import { PronunciationFeedback } from "./pronunciation-feedback";
import { usePronunciationCoach } from "./use-pronunciation-coach";
import type { PronunciationSessionState } from "@/lib/speech/pronunciation-session";
import type { DailyPronunciationResolution } from "@/lib/speech/daily-pronunciation-game";
import type { DailySession } from "@/lib/daily-session";
import type { PracticePersistenceBinding } from "@/lib/db/repository";

export interface PronunciationResolution { kind: DailyPronunciationResolution; mastered: boolean; binding?: PracticePersistenceBinding }

export function PronunciationCoachRound({
  item, lessonId, itemPool, recognitionSupported, combo, initialState, identityKey, dailyPronunciation, captureBinding, onDailySessionCommitted, onResolved, onOutcome,
}: {
  item: PracticeItem;
  lessonId: string;
  itemPool: PracticeItem[];
  recognitionSupported: boolean;
  combo: number;
  initialState?: PronunciationSessionState;
  identityKey?: string;
  dailyPronunciation?: { day: string; activityId: string; contentHash: string; targetIndex: 0 | 1 | 2 };
  captureBinding?: () => PracticePersistenceBinding | null;
  onDailySessionCommitted?: (session: DailySession) => void;
  onResolved: (resolution: PronunciationResolution) => void;
  onOutcome?: (outcome: PracticeOutcome) => void;
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
    initialState,
    identityKey,
    dailyPronunciation,
    onDailySessionCommitted,
    onOutcome,
  });
  const resolvingRef = useRef(false);
  const cancel = coach.cancel;

  useEffect(() => () => {
    cancel();
    stopPronunciation();
  }, [cancel, item.id]);

  const listen = (rate: 0.65 | 1 = 1) => playPronunciation({
    id: item.id,
    text: item.text,
    rate,
    voiceURI: settings.voiceURI,
  });
  const resolve = (kind: DailyPronunciationResolution, binding?: PracticePersistenceBinding) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    stopPronunciation();
    cancel();
    coach.resetSession();
    onResolved({ kind, mastered: kind === "graded-mastered", binding });
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
        onContinue={() => resolve(coach.feedback?.verdict.outcome === "mastered" ? "graded-mastered" : "graded-practiced", coach.feedback?.commitBinding)}
        onTranscriptPractice={() => void coach.practiceWithoutGrade()}
        onTechnicalSkip={() => { const binding = captureBinding?.(); if (!binding) return; void coach.skipTechnical().then(() => resolve("technical", binding)).catch(() => {}); }}
        saveFailure={coach.phase === "save-recovery" ? (coach.recovery === "account-changed" ? "account-changed" : "storage") : undefined}
        onRetrySave={() => void coach.retrySave()}
        // This is an explicit non-persisted exit. Never attribute learner A's
        // failed save as a technical resolution in learner B's fresh scope.
        onAccountChanged={() => { stopPronunciation(); cancel(); coach.resetSession(); }}
      />
    );
  }

  if (coach.phase === "ungraded-practice") {
    return (
      <div className="rounded-3xl border border-hairline bg-card p-5 text-center" role="status" aria-live="polite">
        <p className="font-semibold">{lang === "es" ? "Práctica sin calificación" : "Ungraded practice"}</p>
        <p className="mt-2 text-sm text-muted-foreground">{lang === "es" ? "La transcripción ayuda, pero no cuenta como dominio." : "The transcript helps you practice, but it does not count as mastery."}</p>
        <p lang="en" className="mt-3 font-display text-xl">“{coach.ungradedHeard || "—"}”</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => void coach.start()} className="min-h-11 rounded-xl border border-hairline px-4 font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {lang === "es" ? "Intentar con calificación" : "Try scoring again"}
          </button>
          <button type="button" onClick={() => resolve("ungraded")} className="min-h-11 rounded-xl bg-foreground px-4 font-semibold text-background outline-none focus-visible:ring-3 focus-visible:ring-ring">
            {lang === "es" ? "Continuar sin aprobar" : "Continue without a pass"}
          </button>
        </div>
      </div>
    );
  }

  const capturing = coach.phase === "capturing";
  const assessing = coach.phase === "assessing";
  const recovery = coach.phase === "recovery";
  const recoveryText = coach.recovery === "permission"
    ? (lang === "es" ? "Activa el micrófono para practicar." : "Allow microphone access to practice.")
    : coach.recovery === "no-speech"
      ? (lang === "es" ? "No escuchamos voz. Acércate al micrófono e inténtalo otra vez." : "We didn't hear speech. Move closer to the mic and try again.")
      : coach.recovery === "account-changed"
        ? (lang === "es" ? "La cuenta cambió. Graba de nuevo para guardar aquí." : "The account changed. Record again to save here.")
        : (lang === "es" ? "La grabación no terminó. Inténtalo otra vez." : "The recording did not finish. Try again.");

  return (
    <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
      <div aria-hidden="true" className="mx-auto">
        <Lumi frame="bust" mood={capturing || assessing ? "think" : recovery ? "encourage" : "point"} className="size-24" />
      </div>
      <div className="rounded-3xl border border-hairline bg-card p-5 shadow-[0_18px_44px_-32px_rgba(18,58,147,0.3)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{lang === "es" ? "Tu línea" : "Your line"}</p>
            <p lang="en" className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">{item.text}</p>
            {item.ipa && <p className="mt-1 font-ipa text-sm text-muted-foreground">{item.ipa}</p>}
          </div>
          <button type="button" onClick={() => listen()} aria-label={lang === "es" ? `Escuchar ${item.text}` : `Listen to ${item.text}`} className="grid min-h-11 min-w-11 place-items-center rounded-full border border-hairline outline-none transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring">
            <Volume2 className="size-5" aria-hidden="true" />
          </button>
        </div>

        {recovery && <p role="status" aria-live="polite" className="mt-4 rounded-2xl border border-warn/30 bg-warn/[0.08] p-3 text-sm">{recoveryText}</p>}
        {!recognitionSupported && <p role="status" className="mt-4 rounded-2xl border border-warn/30 bg-warn/[0.08] p-3 text-sm">{lang === "es" ? "La calificación por voz no está disponible en este navegador." : "Voice scoring is unavailable in this browser."}</p>}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {capturing ? (
            <button type="button" onClick={coach.stop} aria-label={lang === "es" ? "Detener grabación" : "Stop recording"} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-destructive px-5 font-semibold text-destructive-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring">
              <Square className="size-4 fill-current" aria-hidden="true" /> {lang === "es" ? "Detener" : "Stop"}
            </button>
          ) : (
            <button type="button" onClick={() => void coach.start()} disabled={!recognitionSupported || assessing} aria-label={recovery ? (lang === "es" ? `Intentar otra vez: ${item.text}` : `Try again: ${item.text}`) : (lang === "es" ? `Grabar ${item.text}` : `Record ${item.text}`)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-foreground px-5 font-semibold text-background outline-none transition-transform active:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-40 motion-reduce:transition-none">
              {assessing ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : recovery ? <RotateCcw className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}
              {assessing ? (lang === "es" ? "Revisando" : "Checking") : recovery ? (lang === "es" ? "Intentar otra vez" : "Try again") : (lang === "es" ? "Hablar" : "Speak")}
            </button>
          )}
          <p {...(recovery ? {} : { role: "status", "aria-live": "polite" as const })} className={cn("text-sm text-muted-foreground", recovery && "sr-only", !capturing && !assessing && !recovery && "sr-only")}>
            {capturing ? (lang === "es" ? "Grabando. Pulsa Detener cuando termines." : "Recording. Press Stop when you're done.") : assessing ? (lang === "es" ? "Revisando tu pronunciación." : "Checking your pronunciation.") : recovery ? recoveryText : (lang === "es" ? "Listo para grabar." : "Ready to record.")}
          </p>
        </div>
      </div>
    </div>
  );
}
