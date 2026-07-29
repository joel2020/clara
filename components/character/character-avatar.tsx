"use client";

import { CharacterIllustration } from "./character-illustration";
import { cn } from "@/lib/utils";
import type { CharacterMood } from "@/lib/character";

// Lumi as a small identity dot — headers, list rows, toasts. Decorative unless
// given a meaningful alt.

export function CharacterAvatar({
  mood = "idle",
  size = "size-12",
  alt,
  className,
}: {
  mood?: CharacterMood;
  /** Tailwind size classes; defaults to 48px (minimum comfortable). */
  size?: string;
  alt?: string;
  className?: string;
}) {
  return <CharacterIllustration mode="avatar" mood={mood} alt={alt} className={cn(size, "shrink-0", className)} />;
}
