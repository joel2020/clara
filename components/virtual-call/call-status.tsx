"use client";

import { AlertTriangle, CircleDot, Ear, Loader2, MessageSquareQuote, PhoneOff, Radio, Volume2, WifiOff } from "lucide-react";
import { t, type CoachLang, type StringKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CallUiState } from "./use-virtual-call";

// The one place a call state is turned into something a person can perceive.
//
// Three channels, always in agreement: a distinct colour and icon, a sentence
// in her coach language, and a polite live region so the state reaches a screen
// reader without stealing focus. Recording in particular must never be
// signalled by a pulsing dot alone.

const STATE_TEXT: Record<CallUiState, StringKey> = {
  idle: "vcallLoading",
  connecting: "vcallConnecting",
  "clara-speaking": "vcallSpeaking",
  "your-turn": "vcallYourTurn",
  listening: "vcallListening",
  processing: "vcallProcessing",
  "awaiting-retry": "vcallAwaitingRetry",
  correction: "vcallCorrectionState",
  error: "vcallErrorState",
  offline: "vcallOffline",
  ended: "vcallEnded",
};

const STATE_STYLE: Record<CallUiState, string> = {
  idle: "border-hairline bg-card text-muted-foreground",
  connecting: "border-primary/30 bg-primary/[0.06] text-primary",
  "clara-speaking": "border-primary/45 bg-primary/[0.09] text-primary",
  "your-turn": "border-foreground/20 bg-secondary text-foreground",
  listening: "border-destructive/55 bg-destructive/[0.09] text-destructive",
  processing: "border-primary/30 bg-primary/[0.06] text-primary",
  "awaiting-retry": "border-warn/55 bg-warn/[0.1] text-foreground",
  correction: "border-warn/40 bg-warn/[0.07] text-foreground",
  error: "border-destructive/55 bg-destructive/[0.08] text-destructive",
  offline: "border-muted-foreground/40 bg-muted text-muted-foreground",
  ended: "border-success/45 bg-success/[0.08] text-success",
};

function StateIcon({ uiState }: { uiState: CallUiState }) {
  switch (uiState) {
    case "connecting":
    case "processing":
      // Spinner only where motion is welcome; reduced motion gets a static dial.
      return <Loader2 className="size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />;
    case "clara-speaking":
      return <Volume2 className="size-4 shrink-0" aria-hidden />;
    case "your-turn":
      return <Ear className="size-4 shrink-0" aria-hidden />;
    case "listening":
      return <Radio className="size-4 shrink-0" aria-hidden />;
    case "awaiting-retry":
    case "correction":
      return <MessageSquareQuote className="size-4 shrink-0" aria-hidden />;
    case "error":
      return <AlertTriangle className="size-4 shrink-0" aria-hidden />;
    case "offline":
      return <WifiOff className="size-4 shrink-0" aria-hidden />;
    case "ended":
      return <PhoneOff className="size-4 shrink-0" aria-hidden />;
    default:
      return <CircleDot className="size-4 shrink-0" aria-hidden />;
  }
}

export function CallStatus({
  uiState,
  lang,
  className,
}: {
  uiState: CallUiState;
  lang: CoachLang;
  className?: string;
}) {
  const recording = uiState === "listening";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-medium transition-colors",
        STATE_STYLE[uiState],
        className,
      )}
    >
      {recording ? (
        <span className="relative grid size-4 shrink-0 place-items-center" aria-hidden>
          {/* Static ring under a halo that only animates when motion is welcome. */}
          <span className="absolute inset-0 rounded-full border-2 border-destructive" />
          <span className="absolute inset-0 rounded-full bg-destructive/30 motion-safe:animate-ping" />
          <span className="size-1.5 rounded-full bg-destructive" />
        </span>
      ) : (
        <StateIcon uiState={uiState} />
      )}
      <span className="min-w-0 break-words">
        <span className="sr-only">{t("vcallStatusLabel", lang)}: </span>
        {/* Recording is stated in words, not just drawn, so it is perceivable
            with the screen off. */}
        {recording && <span className="sr-only">{t("vcallRecordingOn", lang)}. </span>}
        {t(STATE_TEXT[uiState], lang)}
      </span>
    </div>
  );
}
