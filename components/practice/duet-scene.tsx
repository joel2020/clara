"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Star, ArrowRight, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { repo } from "@/lib/db";
import { createRecognition, recognitionMode, RecognitionError } from "@/lib/speech/recognition";
import { recordPracticeAttempt } from "@/lib/practice";
import { useSettings } from "@/lib/hooks/useSettings";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { sfx } from "@/lib/sfx";
import { celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { playPronunciation, stopPronunciation } from "@/lib/speech/player";
import { t } from "@/lib/i18n";
import { Lumi } from "@/components/lumi";
import { JoelAvatar } from "@/components/joel-avatar";
import { duetItem, type Duet } from "@/lib/content/duets";

// A duet: she performs one side of a scripted scene while Joel performs the
// other in his recorded voice. Her lines run through the real practice
// pipeline (scoring, SRS, stars) — dialogue practice with actual credit.

type HerPhase = "idle" | "recording" | "scoring" | "failed";

export function DuetScene({ duet, onExit }: { duet: Duet; onExit: () => void }) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const support = useSpeechSupport();

  const [lineIdx, setLineIdx] = useState(0);
  const [herPhase, setHerPhase] = useState<HerPhase>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [stars, setStars] = useState(0);
  const [joelSpeaking, setJoelSpeaking] = useState(false);
  const [done, setDone] = useState(false);
  const handleRef = useRef<ReturnType<typeof createRecognition> | null>(null);

  const lines = duet.lines;
  const current = lines[lineIdx];

  const advance = useCallback(() => {
    setHeard(null);
    setHerPhase("idle");
    if (lineIdx + 1 >= lines.length) {
      setDone(true);
      sfx.finish();
      celebrate();
      juice.centerBurst();
    } else {
      setLineIdx((i) => i + 1);
    }
  }, [lineIdx, lines.length]);

  // Joel performs his lines automatically, then hands the scene to her. If his
  // audio can't play (autoplay policy, flaky network), a safety timer keeps the
  // scene moving instead of stalling forever.
  useEffect(() => {
    if (done || !current || current.speaker !== "joel") return;
    const item = duetItem(current);
    let ended = false;
    const finish = () => {
      if (ended) return;
      ended = true;
      setJoelSpeaking(false);
      setTimeout(advance, 450);
    };
    const safety = setTimeout(finish, 9000);
    const timer = setTimeout(() => {
      setJoelSpeaking(true);
      playPronunciation({
        id: item.id,
        text: item.text,
        voice: "joel",
        rate: settings.speechRate,
        voiceURI: settings.voiceURI,
        onEnd: finish,
      });
    }, 400);
    return () => {
      clearTimeout(timer);
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineIdx, done]);

  useEffect(() => () => stopPronunciation(), []);

  const record = async () => {
    if (herPhase === "recording" || herPhase === "scoring" || !current || current.speaker !== "her") return;
    const item = duetItem(current);
    stopPronunciation();
    setHeard(null);
    setHerPhase("recording");
    sfx.tap();
    const h = createRecognition({ lang: settings.recognitionLang });
    handleRef.current = h;
    try {
      const r = await h.result;
      setHerPhase("scoring");
      const out = await recordPracticeAttempt({
        item,
        lessonId: item.id.split(":")[0],
        transcript: r.transcript,
        alternatives: r.alternatives,
        combo: 1,
      });
      if (out.score.passed) {
        setStars((s) => s + out.rewards.starsEarned);
        sfx.correct(1);
        juice.centerBurst(out.rewards.starsEarned > 0 ? `+${out.rewards.starsEarned} ★` : undefined);
        advance();
      } else {
        setHeard(out.score.heard || "—");
        setHerPhase("failed");
        sfx.wrong();
      }
    } catch (e) {
      if (e instanceof RecognitionError && e.code === "cancelled") {
        setHerPhase("idle");
        return;
      }
      setHerPhase("failed");
      setHeard(null);
    } finally {
      handleRef.current = null;
    }
  };

  if (support && !support.recognition) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="font-display text-2xl font-medium tracking-[-0.01em]">{t("duetNeedsMic", lang)}</p>
        <button onClick={onExit} className="mt-6 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">
          {t("backHome", lang)}
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="animate-scale-in px-5 py-14 text-center">
        <Lumi frame="bust" mood="cheer" className="mx-auto size-28" />
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">{duet.title[lang]}</p>
        <h1 className="mt-3 inline-flex items-center gap-2 font-display text-5xl font-medium tracking-[-0.03em]">
          {stars}
          <Star className="size-9 text-co-yellow" style={{ fill: "currentColor" }} strokeWidth={0} />
        </h1>
        <p className="mt-3 text-muted-foreground">{t("duetDone", lang)}</p>
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
            {t("again", lang)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-xl flex-col px-5 py-6">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {t("shadowExit", lang)}
        </button>
        <p className="flex items-center gap-2 text-sm font-medium">
          <span aria-hidden>{duet.emoji}</span>
          {duet.title[lang]}
        </p>
        <span className="inline-flex items-center gap-1 font-mono text-sm tabular-nums text-muted-foreground">
          {stars}
          <Star className="size-3.5 text-co-yellow" style={{ fill: "currentColor" }} strokeWidth={0} />
        </span>
      </div>

      {/* The scene so far */}
      <div className="mt-6 flex-1 space-y-3">
        {lines.slice(0, lineIdx + 1).map((line, i) => {
          const item = duetItem(line);
          const isJoel = line.speaker === "joel";
          const isCurrent = i === lineIdx;
          return (
            <div key={i} className={cn("flex", isJoel ? "justify-start" : "justify-end")}>
              <div className={cn("flex max-w-[92%] items-end gap-2", !isJoel && "flex-row-reverse")}>
                {isJoel && <JoelAvatar speaking={isCurrent && joelSpeaking} className="mb-1" />}
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 leading-relaxed",
                    isJoel
                      ? "rounded-bl-md border border-hairline bg-card"
                      : isCurrent
                        ? "border-2 border-dashed border-primary/50 bg-primary/[0.04]"
                        : "bg-primary text-primary-foreground",
                  )}
                >
                  <p className="font-medium">{item.text}</p>
                  {item.meaning && lang === "es" && (
                    <p className={cn("mt-1 text-sm", isJoel || isCurrent ? "text-muted-foreground" : "text-primary-foreground/75")}>
                      {item.meaning}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Her turn controls */}
      {current?.speaker === "her" && (
        <div className="sticky bottom-0 border-t border-hairline bg-background/95 py-4 text-center backdrop-blur">
          {herPhase === "failed" && (
            <p className="mb-3 text-sm text-muted-foreground">
              {t("heard", lang)} <span className="font-medium text-destructive">“{heard ?? "—"}”</span>
            </p>
          )}
          <div className="flex items-center justify-center gap-3">
            {herPhase === "recording" ? (
              <button
                onClick={() => {
                  if (recognitionMode() === "record") setHerPhase("scoring");
                  handleRef.current?.stop();
                }}
                aria-label={t("talkStop", lang)}
                className="relative grid size-16 place-items-center rounded-full bg-card text-destructive ring-1 ring-destructive/40 active:scale-95"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-destructive/15" />
                <Square className="size-5 fill-current" />
              </button>
            ) : (
              <button
                onClick={record}
                disabled={herPhase === "scoring"}
                aria-label={t("duetYourLine", lang)}
                className="grid size-16 place-items-center rounded-full bg-foreground text-background shadow-sm transition-all hover:scale-[1.04] active:scale-95 disabled:opacity-40"
              >
                {herPhase === "scoring" ? <Loader2 className="size-6 animate-spin" /> : <Mic className="size-6" />}
              </button>
            )}
            {herPhase === "failed" && (
              <>
                <button
                  onClick={() => {
                    const item = duetItem(current);
                    playPronunciation({ id: item.id, text: item.text, voice: "joel", rate: settings.speechRate, voiceURI: settings.voiceURI });
                  }}
                  aria-label={t("listen", lang)}
                  className="grid size-12 place-items-center rounded-full border border-hairline text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Volume2 className="size-4" />
                </button>
                <button
                  onClick={advance}
                  className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40"
                >
                  {t("skipToNext", lang)}
                  <ArrowRight className="size-4" />
                </button>
              </>
            )}
          </div>
          <p className="mt-2.5 text-sm font-medium text-muted-foreground">
            {herPhase === "recording"
              ? t("talkListening", lang)
              : herPhase === "failed"
                ? t("tryAgain", lang)
                : t("duetYourLine", lang)}
          </p>
        </div>
      )}
    </div>
  );
}
