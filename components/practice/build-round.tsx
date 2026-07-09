"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Volume2, Star, X, Delete } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeItem } from "@/lib/db/types";
import { repo } from "@/lib/db";
import { useSettings } from "@/lib/hooks/useSettings";
import { sfx } from "@/lib/sfx";
import { celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { playPronunciation, stopPronunciation, pickDrillVoice } from "@/lib/speech/player";
import { normalize } from "@/lib/speech/scoring";
import { t } from "@/lib/i18n";
import { Lumi } from "@/components/lumi";

// Sentence builder: hear a phrase, then tap the shuffled words into the right
// order. Trains word order — the grammar skill that chunk-drilling alone
// doesn't isolate — with no microphone needed. Correct sentences bank stars.

const ROUND_LENGTH = 8;

interface Chip {
  key: number;
  word: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Split a phrase into tappable word chips (punctuation stays attached). */
function toChips(text: string): Chip[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((word, key) => ({ key, word }));
}

export function BuildRound({ items, onExit }: { items: PracticeItem[]; onExit: () => void }) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;

  const round = useMemo(() => {
    const pool = items.filter((i) => {
      const n = i.text.split(/\s+/).length;
      return n >= 3 && n <= 7;
    });
    return shuffle(pool).slice(0, Math.min(ROUND_LENGTH, pool.length));
  }, [items]);

  const [idx, setIdx] = useState(0);
  const [placed, setPlaced] = useState<Chip[]>([]);
  const [state, setState] = useState<"building" | "right" | "wrong">("building");
  const [stars, setStars] = useState(0);
  const [clears, setClears] = useState(0);
  const [done, setDone] = useState(false);
  const awarded = useRef(false);

  const current = round[idx];
  const chips = useMemo(() => (current ? shuffle(toChips(current.text)) : []), [current]);
  const remaining = chips.filter((c) => !placed.some((p) => p.key === c.key));
  const voice = useMemo(() => pickDrillVoice(0.4).slug, [idx]);

  const play = useCallback(() => {
    if (!current) return;
    playPronunciation({
      id: current.id,
      text: current.text,
      voice,
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
    });
  }, [current, voice, settings.speechRate, settings.voiceURI]);

  useEffect(() => {
    if (current && !done) {
      const timer = setTimeout(play, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, done]);

  useEffect(() => () => stopPronunciation(), []);

  useEffect(() => {
    if (done && stars > 0 && !awarded.current) {
      awarded.current = true;
      void repo.getPlayerStats().then((p) =>
        repo.savePlayerStats({ ...p, stars: (p.stars ?? 0) + stars, updatedAt: Date.now() }),
      );
    }
  }, [done, stars]);

  const advance = () => {
    setPlaced([]);
    setState("building");
    if (idx + 1 >= round.length) {
      setDone(true);
      sfx.finish();
      celebrate();
    } else {
      setIdx((i) => i + 1);
    }
  };

  const check = (finalPlaced: Chip[]) => {
    const target = toChips(current.text).map((c) => normalize(c.word));
    const got = finalPlaced.map((c) => normalize(c.word));
    const right = target.length === got.length && target.every((w, i) => w === got[i]);
    if (right) {
      const gain = current.text.split(/\s+/).length >= 5 ? 2 : 1;
      setStars((s) => s + gain);
      setClears((c) => c + 1);
      setState("right");
      sfx.correct(1);
      juice.centerBurst(`+${gain} ★`);
      setTimeout(advance, 1000);
    } else {
      setState("wrong");
      sfx.wrong();
      setTimeout(advance, 1700);
    }
  };

  const tapChip = (chip: Chip, e: React.MouseEvent<HTMLButtonElement>) => {
    if (state !== "building") return;
    sfx.tap();
    const r = e.currentTarget.getBoundingClientRect();
    juice.tap(r.left + r.width / 2, r.top + r.height / 2);
    const next = [...placed, chip];
    setPlaced(next);
    if (next.length === chips.length) check(next);
  };

  const undo = () => {
    if (state !== "building" || !placed.length) return;
    sfx.tap();
    setPlaced(placed.slice(0, -1));
  };

  if (done) {
    const acc = round.length ? Math.round((clears / round.length) * 100) : 0;
    return (
      <div className="animate-scale-in px-5 py-14 text-center">
        <Lumi frame="bust" mood="cheer" className="mx-auto size-28" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{t("buildTitle", lang)}</p>
        <h1 className="mt-3 inline-flex items-center gap-2 font-display text-5xl font-medium tracking-[-0.03em]">
          {stars}
          <Star className="size-9 text-co-yellow" style={{ fill: "currentColor" }} strokeWidth={0} />
        </h1>
        <p className="mt-3 text-muted-foreground">
          {clears}/{round.length} · {acc}%
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
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

        <button
          onClick={play}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-hairline px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40"
        >
          <Volume2 className="size-4 text-primary" />
          {t("shadowReplay", lang)}
        </button>
        {current.meaning && lang === "es" && <p className="mt-3 text-sm text-muted-foreground">{current.meaning}</p>}

        {/* The answer row she's building */}
        <div
          className={cn(
            "mt-7 flex min-h-[64px] w-full flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 transition-colors",
            state === "right" && "border-success bg-success/10",
            state === "wrong" && "border-destructive bg-destructive/10",
            state === "building" && "border-hairline",
          )}
        >
          {placed.length === 0 && state === "building" && (
            <span className="text-sm text-muted-foreground/60">{t("buildTapWords", lang)}</span>
          )}
          {placed.map((c) => (
            <span key={c.key} className="animate-pop-in rounded-xl bg-foreground px-3 py-2 text-sm font-medium text-background">
              {c.word}
            </span>
          ))}
        </div>

        {/* On a miss, show the correct sentence so it teaches */}
        <div className="mt-3 h-6">
          {state === "wrong" && (
            <p className="animate-fade-in inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <X className="size-4 text-destructive" />
              “<span className="font-medium text-foreground">{current.text}</span>”
            </p>
          )}
        </div>

        {/* The shuffled word chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {remaining.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={(e) => tapChip(c, e)}
              className="rounded-xl border border-hairline bg-card px-3.5 py-2.5 text-[15px] font-medium transition-all hover:border-primary/40 active:scale-[0.96]"
            >
              {c.word}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={undo}
          disabled={!placed.length || state !== "building"}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <Delete className="size-4" />
          {t("buildUndo", lang)}
        </button>
      </div>
    </div>
  );
}
