"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Square, Loader2, Volume2, Check, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeItem } from "@/lib/db/types";
import { repo } from "@/lib/db";
import { createRecognition, recognitionMode, RecognitionError } from "@/lib/speech/recognition";
import { recordPracticeAttempt } from "@/lib/practice";
import { useSettings } from "@/lib/hooks/useSettings";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { sfx } from "@/lib/sfx";
import { popConfetti, celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { playPronunciation, stopPronunciation, pickDrillVoice } from "@/lib/speech/player";
import { t } from "@/lib/i18n";
import { Lumi } from "@/components/lumi";
import { StarRating } from "@/components/star-reward";

// Shadowing: hear Joel say a phrase, then echo it back right away. This trains
// two things at once — the ear (understanding natural American speech) and
// automaticity (saying whole chunks without assembling them word by word).
// Uses full conversation phrases and always plays Joel (the American model).

const ROUND_LENGTH = 8;
type Phase = "listen" | "ready" | "recording" | "scoring" | "flash";

export function ShadowRound({ items, onExit }: { items: PracticeItem[]; onExit: () => void }) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const support = useSpeechSupport();

  const round = useMemo(() => shuffle(items).slice(0, Math.min(ROUND_LENGTH, items.length)), [items]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("listen");
  const [flash, setFlash] = useState<{ passed: boolean; stars: number } | null>(null);
  const [totalStars, setTotalStars] = useState(0);
  const [clears, setClears] = useState(0);
  const [done, setDone] = useState(false);
  const handleRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  const current = round[idx];
  // A different American voice per phrase, so her ear trains across speakers.
  // Fixed per item (recomputes only when the phrase changes) so replay matches.
  const voiceSlug = useMemo(() => pickDrillVoice().slug, [idx]);

  const playModel = useCallback(() => {
    if (!current) return;
    setPhase("listen");
    playPronunciation({
      id: current.id,
      text: current.text,
      voice: voiceSlug,
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
      onEnd: () => setPhase((p) => (p === "listen" ? "ready" : p)),
    });
  }, [current, voiceSlug, settings.speechRate, settings.voiceURI]);

  // Auto-play Joel when a new phrase appears.
  useEffect(() => {
    if (current && !done) {
      const timer = setTimeout(playModel, 250);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done]);

  useEffect(() => () => stopPronunciation(), []);

  const advance = () => {
    setFlash(null);
    if (idx + 1 >= round.length) {
      setDone(true);
      sfx.finish();
      celebrate();
    } else {
      setIdx((i) => i + 1);
      setPhase("listen");
    }
  };

  const echo = async () => {
    if (phase !== "ready") return;
    stopPronunciation();
    setFlash(null);
    setPhase("recording");
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
        combo: clears + 1,
        itemPool: items,
        assessment: r.assessment,
      });
      const passed = out.score.passed;
      const stars = out.rewards.starsEarned;
      setFlash({ passed, stars });
      setTotalStars((v) => v + stars);
      if (passed) {
        // Voice journal: keep her first and best passing take.
        if (r.audio) void repo.saveAttemptRecording(current.id, r.audio, out.score.score).catch(() => {});
        setClears((c) => c + 1);
        sfx.correct(out.rewards.combo);
        popConfetti({ x: 0.5, y: 0.42 });
        juice.centerBurst(out.rewards.starsEarned > 0 ? `+${out.rewards.starsEarned} ★` : undefined);
        setPhase("flash");
        setTimeout(advance, 1100);
      } else {
        // A miss keeps her on the phrase — mic ready to try again, skip optional.
        sfx.wrong();
        setPhase("ready");
      }
    } catch (e) {
      if (e instanceof RecognitionError && e.code === "cancelled") {
        setPhase("ready");
        return;
      }
      setFlash({ passed: false, stars: 0 });
      setPhase("ready");
    } finally {
      handleRef.current = null;
    }
  };

  if (support && !support.recognition) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="font-display text-2xl font-medium tracking-[-0.01em]">{t("shadowNeedsMic", lang)}</p>
        <button onClick={onExit} className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">
          {t("navLessons", lang)}
        </button>
      </div>
    );
  }

  if (done) {
    const acc = round.length ? Math.round((clears / round.length) * 100) : 0;
    return (
      <div className="animate-scale-in px-5 py-14 text-center">
        <div className="relative mx-auto w-fit">
          <Lumi frame="bust" mood="cheer" className="mx-auto size-28" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("shadowTitle", lang)}</p>
        <h1 className="mt-3 inline-flex items-center gap-2 font-display text-5xl font-medium tracking-[-0.03em]">
          {totalStars}
          <Star className="size-9 text-co-yellow" style={{ fill: "currentColor" }} strokeWidth={0} />
        </h1>
        <div className="mx-auto mt-8 flex max-w-sm items-stretch divide-x divide-hairline border-y border-hairline">
          <Cell value={`${clears}/${round.length}`} label={t("clear", lang)} />
          <Cell value={`${acc}%`} label={t("accuracy", lang)} />
          <Cell value={`${totalStars} ★`} label={t("stars", lang)} />
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
            {t("again", lang)}
          </button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const isRecording = phase === "recording";

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <div className="mb-8 flex items-center justify-between">
        <button onClick={onExit} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {t("shadowExit", lang)}
        </button>
        <span className="inline-flex items-center gap-1 font-mono text-sm tabular-nums text-muted-foreground">
          {totalStars}
          <Star className="size-3.5 text-co-yellow" style={{ fill: "currentColor" }} strokeWidth={0} />
        </span>
      </div>

      <div className="mb-8 h-px w-full bg-hairline">
        <div className="h-px bg-foreground transition-all duration-300" style={{ width: `${(idx / round.length) * 100}%` }} />
      </div>

      <div className="flex flex-col items-center text-center">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {idx + 1} / {round.length}
        </span>

        <h1
          className={cn(
            "mt-6 font-display text-3xl font-medium leading-tight tracking-[-0.02em] transition-colors sm:text-4xl",
            flash?.passed && "text-success",
            flash && !flash.passed && "text-destructive",
          )}
        >
          {current.text}
        </h1>
        {current.meaning && lang === "es" && <p className="mt-3 text-muted-foreground">{current.meaning}</p>}

        {/* Replay Joel */}
        <button
          onClick={playModel}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-primary/40"
        >
          <Volume2 className={cn("size-4", phase === "listen" && "text-primary")} />
          {t("shadowReplay", lang)}
        </button>

        {/* Star / miss flash */}
        <div className="mt-6 flex h-10 items-center justify-center">
          {flash && (
            flash.passed ? (
              <StarRating rating={flash.stars} size={28} />
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
                  <X className="size-4" /> {t("tryAgain", lang)}
                </span>
                <button
                  type="button"
                  onClick={advance}
                  className="rounded-full border border-hairline px-3 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("skipToNext", lang)}
                </button>
              </span>
            )
          )}
          {!flash && phase === "flash" && <Check className="size-5 text-success" />}
        </div>

        {/* Mic */}
        <div className="mt-2">
          {isRecording ? (
            <button
              onClick={() => {
                if (recognitionMode() === "record") setPhase("scoring");
                handleRef.current?.stop();
              }}
              aria-label={t("talkStop", lang)}
              className="relative grid size-20 place-items-center rounded-full bg-card text-destructive ring-1 ring-destructive/40 active:scale-95"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/15" />
              <Square className="size-6 fill-current" />
            </button>
          ) : (
            <button
              onClick={echo}
              disabled={phase !== "ready"}
              aria-label={t("shadowRepeat", lang)}
              className="grid size-20 place-items-center rounded-full bg-foreground text-background shadow-sm transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-40"
            >
              {phase === "scoring" ? <Loader2 className="size-7 animate-spin" /> : <Mic className="size-7" />}
            </button>
          )}
        </div>
        <p className="mt-3 h-5 text-sm font-medium text-muted-foreground">
          {phase === "listen"
            ? t("shadowListen", lang)
            : phase === "recording"
              ? t("talkListening", lang)
              : phase === "ready"
                ? t("shadowRepeat", lang)
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
