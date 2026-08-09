"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Loader2, Check, X, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeItem } from "@/lib/db/types";
import { createRecognition, isTechnicalRecognitionError, recognitionErrorKey, recognitionMode, RecognitionError } from "@/lib/speech/recognition";
import { recordPracticeAttempt } from "@/lib/practice";
import { repo } from "@/lib/db";
import { useSettings } from "@/lib/hooks/useSettings";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { sfx } from "@/lib/sfx";
import { popConfetti, celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { playPronunciation, pickDrillVoice, stopPronunciation } from "@/lib/speech/player";
import { t } from "@/lib/i18n";
import { meaningFor } from "@/lib/content/word-es";
import { gradedAccuracy, shouldCelebrateGradedCompletion } from "@/lib/speech/graded-round";

const ROUND_LENGTH = 15;

type Phase = "ready" | "listening" | "scoring" | "flash";

export function SpeedRound({ items, onExit }: { items: PracticeItem[]; onExit: () => void }) {
  const round = useMemo(() => shuffle(items).slice(0, Math.min(ROUND_LENGTH, items.length)), [items]);
  const roundIdentity = JSON.stringify(round.map(({ id, text }) => [id, text]));
  return <SpeedRoundSession key={roundIdentity} items={items} onExit={onExit} round={round} />;
}

function SpeedRoundSession({
  items,
  onExit,
  round,
}: {
  items: PracticeItem[];
  onExit: () => void;
  round: PracticeItem[];
}) {
  const { settings } = useSettings();
  const support = useSpeechSupport();

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [flash, setFlash] = useState<"pass" | "fail" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gain, setGain] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [clears, setClears] = useState(0);
  const [gradedAttempts, setGradedAttempts] = useState(0);
  const [hadUngradedSkip, setHadUngradedSkip] = useState(false);
  const [bestCombo, setBestCombo] = useState(0);
  const [done, setDone] = useState(false);
  const handleRef = useRef<ReturnType<typeof createRecognition> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failureAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureSequenceRef = useRef(0);

  const current = round[idx];

  const clearOwnedTimers = useCallback(() => {
    for (const timerRef of [previewTimerRef, successAdvanceTimerRef, failureAdvanceTimerRef]) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const cancelActive = useCallback(() => {
    clearOwnedTimers();
    captureSequenceRef.current += 1;
    handleRef.current?.cancel();
    handleRef.current = null;
    stopPronunciation();
  }, [clearOwnedTimers]);

  useEffect(() => () => cancelActive(), [cancelActive, current?.id, current?.text, done, round]);

  // Preview each word as it appears — mostly Joel, with the supporting cast
  // mixed in to keep her ear on its toes.
  useEffect(() => {
    if (current && !done) {
      previewTimerRef.current = setTimeout(
        () => {
          previewTimerRef.current = null;
          playPronunciation({
            id: current.id,
            text: current.text,
            voice: pickDrillVoice().slug,
            rate: settings.speechRate,
            voiceURI: settings.voiceURI,
          });
        },
        200,
      );
      return () => {
        if (previewTimerRef.current !== null) {
          clearTimeout(previewTimerRef.current);
          previewTimerRef.current = null;
        }
        stopPronunciation();
      };
    }
  }, [current, done, settings.speechRate, settings.voiceURI]);

  const go = async () => {
    if (phase !== "ready") return;
    clearOwnedTimers();
    stopPronunciation();
    const persistenceBinding = repo.capturePracticeBinding();
    if (!persistenceBinding) {
      setNotice(t("pronAccountChangedBody", settings.coachLanguage));
      return;
    }
    const captureSequence = captureSequenceRef.current + 1;
    captureSequenceRef.current = captureSequence;
    setPhase("listening");
    setNotice(null);
    sfx.tap();
    const h = createRecognition({ lang: settings.recognitionLang, target: current.text, assessmentKind: current.kind });
    handleRef.current = h;
    try {
      const r = await h.result;
      if (captureSequence !== captureSequenceRef.current) return;
      setPhase("scoring");
      const out = await recordPracticeAttempt({
        item: current,
        lessonId: current.id.split(":")[0],
        transcript: r.transcript,
        alternatives: r.alternatives,
        combo: combo + 1,
        itemPool: items,
        assessment: r.assessment,
        persistenceBinding,
      });
      if (captureSequence !== captureSequenceRef.current) return;
      if (!out.recorded) {
        setGain(null);
        setFlash(null);
        setNotice(out.score.feedback);
        setPhase("ready");
        return;
      }
      const passed = out.score.passed;
      setGradedAttempts((value) => value + 1);
      setGain(out.rewards.xpGain);
      setXp((v) => v + out.rewards.xpGain);
      setFlash(passed ? "pass" : "fail");
      if (passed) {
        setClears((c) => c + 1);
        setCombo(out.rewards.combo);
        setBestCombo((b) => Math.max(b, out.rewards.combo));
        sfx.correct(out.rewards.combo);
        popConfetti({ x: 0.5, y: 0.4 });
        juice.burst(window.innerWidth / 2, window.innerHeight * 0.32, { count: 10 });
        juice.float(window.innerWidth / 2, window.innerHeight * 0.32 - 24, `+${out.rewards.xpGain} XP`);
        if (out.rewards.combo === 5 || out.rewards.combo === 10) juice.sweep();
      } else {
        setCombo(0);
        sfx.wrong();
      }
      setPhase("flash");
      successAdvanceTimerRef.current = setTimeout(() => {
        successAdvanceTimerRef.current = null;
        if (captureSequence === captureSequenceRef.current) advance(true);
      }, 850);
    } catch (e) {
      if (captureSequence !== captureSequenceRef.current) return;
      if (e instanceof RecognitionError && (e.code === "cancelled" || e.code === "consent")) {
        setPhase("ready");
        return;
      }
      if (isTechnicalRecognitionError(e)) {
        setGain(null);
        setFlash(null);
        setNotice(t(recognitionErrorKey(e), settings.coachLanguage));
        setPhase("ready");
        return;
      }
      if (e && typeof e === "object" && "code" in e && e.code === "account-changed") {
        cancelActive();
        setGain(null);
        setFlash(null);
        setNotice(t("pronAccountChangedBody", settings.coachLanguage));
        setPhase("ready");
        return;
      }
      // On a mic miss, count as a miss and move on to keep the pace.
      setFlash("fail");
      setCombo(0);
      setPhase("flash");
      failureAdvanceTimerRef.current = setTimeout(() => {
        failureAdvanceTimerRef.current = null;
        if (captureSequence === captureSequenceRef.current) advance(false);
      }, 700);
    } finally {
      if (captureSequence === captureSequenceRef.current) handleRef.current = null;
    }
  };

  const advance = (completedWithGradedResult = false) => {
    cancelActive();
    setFlash(null);
    setGain(null);
    const nextGradedAttempts = gradedAttempts + (completedWithGradedResult ? 1 : 0);
    const nextHadUngradedSkip = hadUngradedSkip || !completedWithGradedResult;
    if (!completedWithGradedResult) setHadUngradedSkip(true);
    if (idx + 1 >= round.length) {
      setDone(true);
      if (shouldCelebrateGradedCompletion({
        gradedAttempts: nextGradedAttempts,
        completedWithGradedResult,
        hadUngradedSkip: nextHadUngradedSkip,
      })) {
        sfx.finish();
        celebrate();
      }
    } else {
      setIdx((i) => i + 1);
      setPhase("ready");
    }
  };

  const lang = settings.coachLanguage;

  if (support && !support.recognition) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="font-display text-2xl font-medium tracking-[-0.01em]">{t("srNeedsMic", lang)}</p>
        <p className="mx-auto mt-3 max-w-sm text-muted-foreground">{t("srNeedsMicSub", lang)}</p>
        <button onClick={() => { cancelActive(); onExit(); }} className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">
          {t("backHome", lang)}
        </button>
      </div>
    );
  }

  if (done) {
    const acc = gradedAccuracy(clears, gradedAttempts);
    return (
      <div className="animate-scale-in px-5 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("speedRound", lang)}</p>
        <h1 className="mt-4 font-display text-5xl font-medium tracking-[-0.03em]">
          {acc === null ? (lang === "es" ? "Sin calificar" : "Not graded") : `${xp} XP`}
        </h1>
        <div className="mx-auto mt-8 flex max-w-sm items-stretch divide-x divide-hairline border-y border-hairline">
          <Cell value={`${clears}/${gradedAttempts}`} label={t("clear", lang)} />
          <Cell value={acc === null ? "—" : `${acc}%`} label={acc === null ? (lang === "es" ? "Sin calificar" : "Not graded") : t("accuracy", lang)} />
          <Cell value={`${bestCombo}×`} label={t("bestCombo", lang)} />
        </div>
        <div className="mt-9 flex items-center justify-center gap-3">
          <button
            onClick={() => { cancelActive(); onExit(); }}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground/80 transition-all hover:border-foreground/30 active:scale-[0.98]"
          >
            {t("finish", lang)}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {t("playAgain", lang)}
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      {/* HUD */}
      <div className="mb-10 flex items-center justify-between">
        <button onClick={() => { cancelActive(); onExit(); }} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {t("shadowExit", lang)}
        </button>
        <div className="flex items-center gap-4">
          {combo >= 2 && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-warn-foreground">
              <Flame className="size-4" /> {combo}×
            </span>
          )}
          <span className="font-mono text-sm tabular-nums text-muted-foreground">{xp} XP</span>
        </div>
      </div>

      <div className="mb-8 h-px w-full bg-hairline">
        <div className="h-px bg-foreground transition-all duration-300" style={{ width: `${(idx / round.length) * 100}%` }} />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {idx + 1} / {round.length}
        </span>

        <h1
          className={cn(
            "mt-6 font-display font-medium tracking-[-0.03em] transition-colors",
            current.kind === "phrase" ? "text-4xl leading-tight" : "text-7xl sm:text-8xl",
            flash === "pass" && "text-success",
            flash === "fail" && "text-destructive",
          )}
        >
          {current.text}
        </h1>
        <p className="mt-4 font-ipa text-sm text-muted-foreground">{current.ipa}</p>
        {meaningFor(current.text, current.meaning) && (
          <p className="mt-2 text-sm italic text-primary/85">{meaningFor(current.text, current.meaning)}</p>
        )}

        {/* Floating XP gain */}
        <div className="mt-6 flex h-8 items-center justify-center">
          {flash && gain !== null && (
            <span
              className={cn(
                "animate-fade-up inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
                flash === "pass" ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {flash === "pass" ? <Check className="size-4" /> : <X className="size-4" />}
              +{gain} XP
            </span>
          )}
          {!flash && notice && (
            <span className="inline-flex items-center gap-2">
              <span role="status" className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                {notice}
              </span>
              <button
                type="button"
                onClick={() => advance(false)}
                className="rounded-full border border-hairline px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t("skipToNext", lang)}
              </button>
            </span>
          )}
        </div>

        {/* Mic */}
        <div className="mt-4">
          {phase === "listening" ? (
            <button
              onClick={() => {
                if (recognitionMode() === "record") setPhase("scoring");
                handleRef.current?.stop();
              }}
              aria-label="Stop"
              className="relative grid size-20 place-items-center rounded-full bg-card text-destructive ring-1 ring-destructive/40 active:scale-95"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/15" />
              <Square className="size-6 fill-current" />
            </button>
          ) : (
            <button
              onClick={go}
              disabled={phase !== "ready"}
              aria-label="Record"
              className="grid size-20 place-items-center rounded-full bg-foreground text-background shadow-sm transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-40"
            >
              {phase === "scoring" ? <Loader2 className="size-7 animate-spin" /> : <Mic className="size-7" />}
            </button>
          )}
        </div>
        <p className="mt-3 h-5 text-sm font-medium text-muted-foreground">
          {phase === "listening"
            ? recognitionMode() === "record"
              ? t("srSayThenStop", lang)
              : t("srSayIt", lang)
            : phase === "ready"
              ? recognitionMode() === "record"
                ? t("tapToRecord", lang)
                : t("srTapFast", lang)
              : ""}
        </p>
      </div>
    </div>
  );
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 px-3 py-4">
      <div className="font-display text-2xl font-medium tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
