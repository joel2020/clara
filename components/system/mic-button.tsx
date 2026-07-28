"use client";

import { Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

// The hero control of the whole product: one mic, one language of states.
// idle → listening (pulse ring + timer handled by callers) → processing
// (thinking shimmer on the label). Presentational; capture logic stays with the
// existing speech hooks.

export type MicState = "idle" | "listening" | "processing" | "disabled";

export function MicButton({
  state,
  label,
  onPress,
  className,
}: {
  state: MicState;
  /** The action text beside the mic: "Tu turno — toca y habla". */
  label: string;
  onPress?: () => void;
  className?: string;
}) {
  const listening = state === "listening";
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={state === "disabled"}
      aria-label={label}
      aria-pressed={listening}
      className={cn(
        "relative flex h-14 w-full items-center justify-center gap-3 rounded-full text-base font-medium transition-colors",
        listening
          ? "bg-destructive text-white"
          : "bg-foreground text-background hover:bg-foreground/90",
        state === "disabled" && "opacity-40",
        className,
      )}
    >
      {listening && (
        <span className="mic-pulse absolute inset-0 rounded-full" aria-hidden />
      )}
      {listening ? (
        <Square className="size-4 fill-current" aria-hidden />
      ) : (
        <Mic className="size-5" aria-hidden />
      )}
      <span className={state === "processing" ? "animate-pulse" : undefined}>
        {state === "processing" ? "Escuchando…" : label}
      </span>
    </button>
  );
}
