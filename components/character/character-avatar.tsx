"use client";

import { CharacterIllustration } from "./character-illustration";
import { cn } from "@/lib/utils";
import type { CharacterState } from "@/lib/character";
import type { CoachLang } from "@/lib/i18n";

// Clara as a small identity dot — map markers, list rows, headers, toasts. The
// ring and wash live HERE rather than in the illustration, so the figure stays
// a plain contained image everywhere else. The `avatar` frame is drawn
// circle-safe and must stay readable at 48px (CHARACTER_DESIGN_SYSTEM.md §6).

export function CharacterAvatar({
  state,
  size = "size-12",
  meaningful,
  lang,
  className,
}: {
  state: CharacterState;
  /** Tailwind size classes; defaults to 48px (the documented minimum). */
  size?: string;
  meaningful?: boolean;
  lang?: CoachLang;
  className?: string;
}) {
  return (
    <span
      className={cn("block shrink-0 overflow-hidden rounded-full ring-1 ring-hairline", size, className)}
      style={{ background: "var(--surface-wash)" }}
    >
      <CharacterIllustration state={state} frame="avatar" meaningful={meaningful} lang={lang} />
    </span>
  );
}
