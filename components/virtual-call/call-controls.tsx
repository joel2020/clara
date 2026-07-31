"use client";

import { Mic, PhoneOff, Square, Volume2, VolumeX } from "lucide-react";
import { t, type CoachLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Start, stop, mute, end. All real buttons, all keyboard-operable, all with a
// label a screen reader can read — the mic button in particular changes both
// its label and its icon rather than relying on colour to say "recording".

export function CallControls({
  lang,
  recording,
  muted,
  /** True while the call cannot accept speech (processing, offline, retry due). */
  speakDisabled,
  onRecord,
  onStop,
  onToggleMute,
  onEnd,
}: {
  lang: CoachLang;
  recording: boolean;
  muted: boolean;
  speakDisabled: boolean;
  onRecord: () => void;
  onStop: () => void;
  onToggleMute: () => void;
  onEnd: () => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 pt-2"
      // Breathing room under the primary control. Flush against the bottom edge
      // is where every phone puts its own chrome — a toolbar, a home indicator,
      // a gesture bar — so the mic button reserves space rather than trusting
      // the viewport maths alone.
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    >
      <button
        type="button"
        onClick={recording ? onStop : onRecord}
        disabled={!recording && speakDisabled}
        className={cn(
          "inline-flex min-h-12 flex-1 items-center justify-center gap-2.5 rounded-full px-5 py-3.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40",
          recording ? "bg-destructive text-white" : "bg-foreground text-background",
        )}
      >
        {recording ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-5" aria-hidden />}
        {recording ? t("vcallStop", lang) : t("vcallSpeak", lang)}
      </button>

      <button
        type="button"
        onClick={onToggleMute}
        aria-pressed={muted}
        title={t(muted ? "vcallUnmute" : "vcallMute", lang)}
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full border transition-colors",
          muted ? "border-foreground/30 bg-secondary text-foreground" : "border-hairline text-muted-foreground hover:text-foreground",
        )}
      >
        {muted ? <VolumeX className="size-5" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
        <span className="sr-only">{t(muted ? "vcallUnmute" : "vcallMute", lang)}</span>
      </button>

      <button
        type="button"
        onClick={onEnd}
        title={t("vcallEnd", lang)}
        className="grid size-12 shrink-0 place-items-center rounded-full border border-destructive/40 text-destructive transition-colors hover:bg-destructive/[0.08]"
      >
        <PhoneOff className="size-5" aria-hidden />
        <span className="sr-only">{t("vcallEnd", lang)}</span>
      </button>
    </div>
  );
}
