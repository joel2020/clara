"use client";

import { useState } from "react";
import { Volume2, Shuffle } from "lucide-react";
import { playPronunciation, hasRecordedVoice, pickAltVoice, type VoiceInfo } from "@/lib/speech/player";
import { ALT_VOICES } from "@/lib/content/audio-manifest";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// "Listen" controls: Joel is the model (primary button + Slow), and the Mix
// button plays the same word in a rotating supporting voice — hearing several
// real speakers keeps ears engaged and generalizes her listening.

export function ListenButton({
  text,
  itemId,
  supported,
}: {
  text: string;
  itemId?: string;
  supported: boolean;
}) {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const [speaking, setSpeaking] = useState<"normal" | "slow" | "mix" | null>(null);
  const [failedMode, setFailedMode] = useState<"normal" | "slow" | "mix" | null>(null);
  const [mixVoice, setMixVoice] = useState<VoiceInfo | null>(null);

  const recorded = hasRecordedVoice(itemId);
  const canPlay = recorded || supported;
  const canMix = recorded && ALT_VOICES.length > 0;

  const play = (mode: "normal" | "slow") => {
    if (!canPlay) return;
    setFailedMode(null);
    setSpeaking(mode);
    playPronunciation({
      id: itemId,
      text,
      slow: mode === "slow",
      rate: settings.speechRate,
      voiceURI: settings.voiceURI,
      onEnd: () => setSpeaking(null),
      onError: () => {
        setSpeaking(null);
        setFailedMode(mode);
      },
    });
  };

  const playMix = () => {
    if (!canMix) return;
    const v = pickAltVoice(mixVoice?.slug);
    setFailedMode(null);
    setMixVoice(v);
    setSpeaking("mix");
    playPronunciation({
      id: itemId,
      text,
      voice: v.slug,
      onEnd: () => setSpeaking(null),
      onError: () => {
        setSpeaking(null);
        setFailedMode("mix");
      },
    });
  };

  const retry = () => {
    if (failedMode === "mix") playMix();
    else if (failedMode) play(failedMode);
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => play("normal")}
          disabled={!canPlay}
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background",
            "transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40",
            speaking === "normal" && "opacity-90",
          )}
        >
          <Volume2 className={cn("size-4", speaking === "normal" && "animate-pulse")} />
          {t("listen", lang)}
        </button>
        <button
          type="button"
          onClick={() => play("slow")}
          disabled={!canPlay}
          className={cn(
            "rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground/80",
            "transition-all hover:border-foreground/30 hover:text-foreground active:scale-[0.98] disabled:opacity-40",
            speaking === "slow" && "border-foreground/30",
          )}
        >
          {t("slow", lang)}
        </button>
        {canMix && (
          <button
            type="button"
            onClick={playMix}
            aria-label={t("otherVoice", lang)}
            title={t("otherVoice", lang)}
            className={cn(
              "grid size-10 place-items-center rounded-full border border-border text-foreground/70",
              "transition-all hover:border-foreground/30 hover:text-foreground active:scale-[0.97]",
              speaking === "mix" && "border-primary/50 text-primary",
            )}
          >
            <Shuffle className={cn("size-4", speaking === "mix" && "animate-pulse")} />
          </button>
        )}
      </div>
      {failedMode ? (
        <div role="alert" className="flex min-h-4 items-center gap-2 text-xs text-destructive">
          <span>{lang === "es" ? "No se pudo reproducir el audio." : "Audio couldn't play."}</span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 py-2.5 font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("tryAgain", lang)}
          </button>
        </div>
      ) : (
        <span className="h-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
          {speaking === "mix" && mixVoice ? `${t("voice", lang)} · ${mixVoice.name}` : recorded ? `${t("voice", lang)} · Joel` : ""}
        </span>
      )}
    </div>
  );
}
