"use client";

import { useEffect, useMemo, useState } from "react";
import { Volume2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeItem } from "@/lib/db/types";
import { playPronunciation, hasRecordedVoice, pickDrillVoice, PRIMARY_VOICE, type VoiceInfo } from "@/lib/speech/player";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

// Ear training: Clara hears one word from a minimal pair and taps which one she
// heard. Trains the distinction before she's asked to produce it. Pure local
// scoring — no recognition needed, so it works in every browser.

type Pair = [PracticeItem, PracticeItem];

export function DistinguishDrill({
  pairs,
  synthesisSupported,
  onDone,
}: {
  pairs: Pair[];
  synthesisSupported: boolean;
  onDone: () => void;
}) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const rounds = useMemo(() => buildRounds(pairs), [pairs]);
  const [round, setRound] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  // A different speaker each round (mostly Joel) — variety trains a real ear.
  const [voice, setVoice] = useState<VoiceInfo>(PRIMARY_VOICE);

  const current = rounds[round];

  const playTarget = (v: VoiceInfo = voice) => {
    if (!current) return;
    playPronunciation({
      id: current.target.id,
      text: current.target.text,
      voice: v.slug,
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
    });
  };

  // Pick a speaker and auto-play each new round's word.
  useEffect(() => {
    if (current) {
      const v = pickDrillVoice();
      setVoice(v);
      const t = setTimeout(() => playTarget(v), 250);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  if (!current) return null;

  const choose = (item: PracticeItem) => {
    if (picked) return;
    setPicked(item.id);
    if (item.id === current.target.id) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (round + 1 >= rounds.length) {
      onDone();
      return;
    }
    setPicked(null);
    setRound((r) => r + 1);
  };

  const answered = picked !== null;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-1">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {t("round", lang)} {String(round + 1).padStart(2, "0")} / {String(rounds.length).padStart(2, "0")}
        </span>
        <p className="text-sm text-muted-foreground">{t("whichWord", lang)}</p>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => playTarget()}
          disabled={!synthesisSupported && !hasRecordedVoice(current.target.id)}
          aria-label="Replay the word"
          className="grid size-20 place-items-center rounded-full bg-foreground text-background shadow-sm transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-30"
        >
          <Volume2 className="size-7" />
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
          {t("voice", lang)} · {voice.name}
        </span>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        {current.options.map((opt) => {
          const isTarget = opt.id === current.target.id;
          const isPicked = opt.id === picked;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => choose(opt)}
              disabled={answered}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-6 transition-all disabled:cursor-default",
                !answered && "border-border hover:border-foreground/30 hover:bg-accent active:scale-[0.99]",
                answered && isTarget && "border-success/50 bg-success/[0.06]",
                answered && isPicked && !isTarget && "border-destructive/50 bg-destructive/[0.06]",
                answered && !isTarget && !isPicked && "border-hairline opacity-50",
              )}
            >
              <span className="font-display text-3xl font-medium tracking-[-0.02em]">{opt.text}</span>
              <span className="font-mono text-xs text-muted-foreground">{opt.ipa}</span>
              {answered && isTarget && (
                <Check className="absolute right-3 top-3 size-4 text-success" />
              )}
              {answered && isPicked && !isTarget && (
                <X className="absolute right-3 top-3 size-4 text-destructive" />
              )}
            </button>
          );
        })}
      </div>

      <div className="h-11">
        {answered && (
          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            {round + 1 >= rounds.length ? (lang === "es" ? `Listo — ${correct}/${rounds.length} bien` : `Done — ${correct}/${rounds.length} right`) : t("next", lang)}
          </button>
        )}
      </div>
    </div>
  );
}

type Round = { target: PracticeItem; options: PracticeItem[] };

// Deterministic-ish shuffle so a session feels varied without needing a seed.
function buildRounds(pairs: Pair[]): Round[] {
  const rounds: Round[] = [];
  pairs.forEach((pair, i) => {
    // Each pair appears twice — once targeting each side.
    rounds.push({ target: pair[i % 2], options: i % 2 === 0 ? pair : [pair[1], pair[0]] });
    rounds.push({ target: pair[(i + 1) % 2], options: i % 2 === 0 ? [pair[1], pair[0]] : pair });
  });
  // Light interleave so the same pair isn't always back-to-back.
  return rounds
    .map((r, idx) => ({ r, k: (idx * 7) % rounds.length }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
}
