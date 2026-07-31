"use client";

import { Lumi } from "@/components/lumi";
import type { CharacterMood } from "@/lib/character";
import { cn } from "@/lib/utils";
import type { CallUiState } from "./use-virtual-call";

// The guide's call-state stage.
//
// Lumi is the learner-facing guide, and her artwork already exists, so this
// renders her directly rather than a placeholder. The <Lumi> component resolves
// her pose from the outfit the learner has equipped in the store, which means
// the guide on a call is the same character she has been dressing — that
// continuity is the point of using her here.
//
// Sizing is deliberately modest. The transcript and the controls are the
// instruction; the guide is the frame around it.

/** Which of Lumi's moods each call state reads as. */
const STATE_MOOD: Record<CallUiState, CharacterMood> = {
  idle: "wave",
  connecting: "wave",
  // Mid-sentence: she is making a point, which is the closest pose to talking.
  "guide-speaking": "point",
  "your-turn": "encourage",
  // Listening has no dedicated pose; idle is the attentive, neutral one, and a
  // reaction pose here would read as her responding before the learner spoke.
  listening: "idle",
  processing: "think",
  "awaiting-retry": "point",
  correction: "think",
  error: "think",
  offline: "idle",
  ended: "cheer",
};

/** Ring colour per call state — the same vocabulary the status banner uses. */
const STATE_RING: Record<CallUiState, string> = {
  idle: "ring-hairline",
  connecting: "ring-primary/40",
  "guide-speaking": "ring-primary",
  "your-turn": "ring-primary/50",
  listening: "ring-destructive",
  processing: "ring-primary/60",
  "awaiting-retry": "ring-warn",
  correction: "ring-warn/70",
  error: "ring-destructive/70",
  offline: "ring-muted-foreground/50",
  ended: "ring-success",
};

export function GuideStage({
  uiState,
  className,
}: {
  uiState: CallUiState;
  className?: string;
}) {
  return (
    // Decorative: the call state is announced in words by the status region, so
    // repeating it here would only make a screen reader say everything twice.
    <div className={cn("flex shrink-0 flex-col items-center gap-1.5", className)} aria-hidden>
      <div
        className={cn(
          "grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary ring-2 ring-offset-2 ring-offset-background transition-colors sm:size-20",
          STATE_RING[uiState],
        )}
      >
        <Lumi mood={STATE_MOOD[uiState]} frame="bust" className="size-full" />
      </div>
    </div>
  );
}
