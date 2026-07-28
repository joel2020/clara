"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Loader2, Check, X, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeItem } from "@/lib/db/types";
import { createRecognition, recognitionMode, RecognitionError } from "@/lib/speech/recognition";
import { recordPracticeAttempt } from "@/lib/practice";
import { useSettings } from "@/lib/hooks/useSettings";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { sfx } from "@/lib/sfx";
import { popConfetti, celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { playPronunciation, pickDrillVoice } from "@/lib/speech/player";
import { t } from "@/lib/i18n";
import { meaningFor } from "@/lib/content/word-es";

const ROUND_LENGTH = 15;

type Phase = "ready" | "listening" | "scoring" | "flash";

export function SpeedRound({ items, onExit }: { items: PracticeItem[]; onExit: () => void }) {
  const { settings } = useSettings();
  const support = useSpeechSupport();

  const round = useMemo(() => shuffle(items).slice(0, Math.min(ROUND_LENGTH, items.length)), [items]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [flash, setFlash] = useState<"pass" | "fail" | null>(null);
  const [gain, setGain] = useState<number | null>(null);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [clears, setClears] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [done, setDone] = useState(false);
  const handleRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  const current = round[idx];

  // Preview each word as it appears — mostly Joel, with the supporting cast
  // mixed in to keep her ear on its toes.
  useEffect(() => {
    if (current && !done) {
      const t = setTimeout(
        () =>
          playPronunciation({
            id: current.id,
            text: current.text,
            voice: pickDrillVoice().slug,
            rate: settings.speechRate,
            voiceURI: settings.voiceURI,
          }),
        200,
      );
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done]);

  const go = async () => {
    if (phase !== "ready") return;
    setPhase("listening");
    sfx.tap();
    const h = createRecognition({ lang: settings.recognitionLang, target: current.text });
    handleRef.current = h;
    try {
      const r = await h.result;
      setPhase("scoring");
      const out = await recordPracticeAttempt({
        item: current,
        lessonId: current.id.split(":")[0],
        transcript: r.transcript,
        alternatives: r.alternatives,
        combo: combo + 1,
        itemPool: items,
        assessment: r.assessment,
      });
      const passed = out.score.passed;
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
      setTimeout(advance, 850);
    } catch (e) {
      if (e instanceof RecognitionError && (e.code === "cancelled" || e.code === "consent")) {
        setPhase("ready");
        return;
      }
      // On a mic miss, count as a miss and move on to keep the pace.
      setFlash("fail");
      setCombo(0);
      setPhase("flash");
      setTimeout(advance, 700);
    } finally {
      handleRef.current = null;
    }
  };

  const advance = () => {
    setFlash(null);
    setGain(null);
    if (idx + 1 >= round.length) {
      setDone(true);
      sfx.finish();
      celebrate();
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
        <button onClick={onExit} className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">
          {t("backHome", lang)}
        </button>
      </div>
    );
  }

  if (done) {
    const acc = round.length ? Math.round((clears / round.length) * 100) : 0;
    return (
      <div className="animate-scale-in px-5 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("speedRound", lang)}</p>
        <h1 className="mt-4 font-display text-5xl font-medium tracking-[-0.03em]">{xp} XP</h1>
        <div className="mx-auto mt-8 flex max-w-sm items-stretch divide-x divide-hairline border-y border-hairline">
          <Cell value={`${clears}/${round.length}`} label={t("clear", lang)} />
          <Cell value={`${acc}%`} label={t("accuracy", lang)} />
          <Cell value={`${bestCombo}×`} label={t("bestCombo", lang)} />
        </div>
        <div className="mt-9 flex items-center justify-center gap-3">
          <button
            onClick={onExit}
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
        <button onClick={onExit} className="text-sm font-medium text-muted-foreground hover:text-foreground">
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
        <p className="mt-4 font-mono text-sm text-muted-foreground">{current.ipa}</p>
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
