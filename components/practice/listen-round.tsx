"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Star, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeItem } from "@/lib/db/types";
import { repo } from "@/lib/db";
import { useSettings } from "@/lib/hooks/useSettings";
import { sfx } from "@/lib/sfx";
import { popConfetti, celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { playPronunciation, stopPronunciation, pickDrillVoice } from "@/lib/speech/player";
import { t } from "@/lib/i18n";
import { CharacterIllustration } from "@/components/character";

// Listen-first comprehension: hear a phrase (NO text on screen) in one of the
// American voices and pick what it means. This is the ear→meaning training the
// rest of the app doesn't cover — understanding speech she can't read along to,
// which is exactly what real conversation demands. No mic needed, so it also
// works anywhere (bus, low voice, browser without speech support).

const ROUND_LENGTH = 8;
type Phase = "listening" | "choosing" | "flash";

interface Question {
  item: PracticeItem;
  options: string[]; // Spanish meanings, one correct
  correct: number;
  voice: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRound(pool: PracticeItem[]): Question[] {
  const withMeaning = pool.filter((i) => i.meaning);
  const chosen = shuffle(withMeaning).slice(0, ROUND_LENGTH);
  return chosen.map((item) => {
    const distractors = shuffle(withMeaning.filter((o) => o.id !== item.id))
      .slice(0, 3)
      .map((o) => o.meaning as string);
    const options = shuffle([item.meaning as string, ...distractors]);
    return { item, options, correct: options.indexOf(item.meaning as string), voice: pickDrillVoice().slug };
  });
}

export function ListenRound({
  items,
  onExit,
  onComplete = onExit,
}: {
  items: PracticeItem[];
  onExit: () => void;
  onComplete?: () => void;
}) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;

  const round = useMemo(() => buildRound(items), [items]);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("listening");
  const [picked, setPicked] = useState<number | null>(null);
  const [missed, setMissed] = useState<number[]>([]);
  const [stars, setStars] = useState(0);
  const [clears, setClears] = useState(0);
  const [done, setDone] = useState(false);
  const awarded = useRef(false);

  const q = round[idx];

  const play = useCallback(() => {
    if (!q) return;
    setPhase((p) => (p === "flash" ? p : "listening"));
    playPronunciation({
      id: q.item.id,
      text: q.item.text,
      voice: q.voice,
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
      onEnd: () => setPhase((p) => (p === "listening" ? "choosing" : p)),
    });
  }, [q, settings.speechRate, settings.voiceURI]);

  useEffect(() => {
    if (q && !done) {
      const timer = setTimeout(play, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done]);

  useEffect(() => () => stopPronunciation(), []);

  // Bank the stars once at the end of the round.
  useEffect(() => {
    if (done && stars > 0 && !awarded.current) {
      awarded.current = true;
      void repo.getPlayerStats().then((p) =>
        repo.savePlayerStats({ ...p, stars: (p.stars ?? 0) + stars, updatedAt: Date.now() }),
      );
    }
  }, [done, stars]);

  const choose = (i: number, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (phase === "flash" || picked !== null || missed.includes(i)) return;
    const right = i === q.correct;
    if (!right) {
      // A wrong pick stays on the question: mark it and let her choose again.
      setMissed((m) => [...m, i]);
      sfx.wrong();
      return;
    }
    stopPronunciation();
    setPicked(i);
    setPhase("flash");
    const firstTry = missed.length === 0;
    if (firstTry) {
      setStars((s) => s + 1);
      setClears((c) => c + 1);
    }
    sfx.correct(1);
    popConfetti({ x: 0.5, y: 0.5 });
    // Burst right where she tapped the correct answer.
    const rect = e?.currentTarget.getBoundingClientRect();
    const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    juice.burst(x, y, { count: 10 });
    if (firstTry) juice.float(x, y - 26, "+1 ★");
    setTimeout(() => {
      setPicked(null);
      setMissed([]);
      if (idx + 1 >= round.length) {
        setDone(true);
        sfx.finish();
        celebrate();
      } else {
        setIdx((v) => v + 1);
        setPhase("listening");
      }
    }, 900);
  };

  if (done) {
    const acc = round.length ? Math.round((clears / round.length) * 100) : 0;
    return (
      <div className="animate-scale-in px-5 py-14 text-center">
        {/* Session completion — the manifest's own `celebrating` screen. */}
        <CharacterIllustration state="celebrating" frame="bust" className="mx-auto size-28" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("listenTitle", lang)}</p>
        <h1 className="mt-3 inline-flex items-center gap-2 font-display text-5xl font-medium tracking-[-0.03em]">
          {stars}
          <Star className="size-9 text-co-yellow" style={{ fill: "currentColor" }} strokeWidth={0} />
        </h1>
        <p className="mt-3 text-muted-foreground">
          {clears}/{round.length} · {acc}%
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={onComplete}
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

  if (!q) return null;

  return (
    <div className="mx-auto max-w-xl px-5 py-8">
      <div className="mb-8 flex items-center justify-between">
        <button onClick={onExit} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {t("shadowExit", lang)}
        </button>
        <span className="inline-flex items-center gap-1 font-mono text-sm tabular-nums text-muted-foreground">
          {stars}
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

        {/* The audio IS the question — no text shown. */}
        <button
          type="button"
          onClick={play}
          aria-label={t("shadowReplay", lang)}
          className={cn(
            "mt-8 grid size-24 place-items-center rounded-full bg-foreground text-background shadow-sm transition-all hover:scale-[1.04] active:scale-95",
            phase === "listening" && "animate-pulse",
          )}
        >
          <Volume2 className="size-9" />
        </button>
        <p className="mt-3 text-sm font-medium text-muted-foreground">{t("listenWhich", lang)}</p>

        <div className="mt-8 grid w-full gap-2.5">
          {q.options.map((opt, i) => {
            const isRight = i === q.correct;
            const reveal = phase === "flash";
            const wasMissed = missed.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => choose(i, e)}
                disabled={reveal || wasMissed}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-left text-[15px] font-medium transition-all active:scale-[0.99]",
                  reveal && isRight
                    ? "border-success bg-success/10 text-success"
                    : wasMissed
                      ? "border-destructive/50 bg-destructive/[0.06] text-destructive/70"
                      : "border-hairline bg-card hover:border-primary/40",
                )}
              >
                {opt}
                {reveal && isRight && <Check className="size-4 shrink-0" />}
                {wasMissed && <X className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* After a wrong pick, a nudge to listen again and keep trying. */}
        <div className="mt-5 h-6">
          {phase !== "flash" && missed.length > 0 && (
            <p className="animate-fade-in text-sm text-muted-foreground">{t("tryAgain", lang)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
