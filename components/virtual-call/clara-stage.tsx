"use client";

import { useState } from "react";
import { CLARA_ARTWORK_AVAILABLE, CLARA_ASSETS, type CharacterState } from "@/lib/character";
import { t, type CoachLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CallUiState } from "./use-virtual-call";

// Clara's call-state stage.
//
// Her approved artwork does not exist yet (blocked on the master-sheet gate in
// CHARACTER_DESIGN_SYSTEM.md), so this renders a non-photographic state
// medallion instead: a monogram inside a ring whose colour and label carry the
// call state. It is deliberately NOT temporary AI-generated art — placeholder
// art has a way of shipping.
//
// The intended production paths still come from the typed manifest
// (CLARA_ASSETS), and the <img> is attempted first: the day the assets land in
// public/character/clara/ this component starts showing them with no change.
// Until then each missing path fails once per session and is remembered.
//
// Sizing is deliberately modest. The transcript and the controls are the
// instruction; Clara is the frame around it.

/** Which approved character state each call state is drawn as. */
const STATE_ART: Record<CallUiState, CharacterState> = {
  idle: "welcome",
  connecting: "welcome",
  "clara-speaking": "teaching",
  "your-turn": "welcome",
  listening: "listening",
  processing: "thinking",
  "awaiting-retry": "encouraging",
  correction: "teaching",
  error: "thinking",
  offline: "thinking",
  ended: "celebrating",
};

/** Ring colour per call state — the same vocabulary the status banner uses. */
const STATE_RING: Record<CallUiState, string> = {
  idle: "ring-hairline",
  connecting: "ring-primary/40",
  "clara-speaking": "ring-primary",
  "your-turn": "ring-primary/50",
  listening: "ring-destructive",
  processing: "ring-primary/60",
  "awaiting-retry": "ring-warn",
  correction: "ring-warn/70",
  error: "ring-destructive/70",
  offline: "ring-muted-foreground/50",
  ended: "ring-success",
};

/** Paths already known to 404 this session, so a missing state asks once. */
const missingArt = new Set<string>();

export function ClaraStage({
  uiState,
  lang,
  className,
}: {
  uiState: CallUiState;
  lang: CoachLang;
  className?: string;
}) {
  const art = CLARA_ASSETS[STATE_ART[uiState]];
  const src = art.frames.bust;
  const [failed, setFailed] = useState(() => missingArt.has(src));
  // Do not request art that is known not to exist yet: a guaranteed 404 per
  // call state is wasted network and console noise in production.
  const showArt = CLARA_ARTWORK_AVAILABLE && !failed && !missingArt.has(src);

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
        {showArt ? (
          /* A plain <img> is required here: the asset may not exist yet, and
             next/image gives no way to fall back to the placeholder on a 404.
             The medallion is 64-80px, so there is no LCP cost to avoid. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            width={80}
            height={80}
            className="size-full object-cover"
            onError={() => {
              missingArt.add(src);
              setFailed(true);
            }}
          />
        ) : (
          <span className="font-display text-2xl font-medium text-muted-foreground sm:text-3xl">C</span>
        )}
      </div>
      {/* Phone widths need every pixel next to the medallion for the call state,
          which is the instruction; the placeholder note is a reviewer's aid and
          only earns its space once there is room to spare. */}
      {!showArt && (
        <span className="hidden max-w-28 text-center text-[10px] leading-tight text-muted-foreground/70 sm:block">
          {t("vcallArtPending", lang)}
        </span>
      )}
    </div>
  );
}
