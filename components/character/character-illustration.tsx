"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { equippedOutfitBase } from "@/lib/cosmetics";
import {
  artFor,
  BUST_FOCAL,
  CHARACTER,
  type CharacterMood,
  type CharacterMode,
} from "@/lib/character";

// Lumi, rendered through the character system. One component, five modes, one
// rule: the figure is never cover-cropped or stretched — full/three-quarter/
// scene are contain-fit, and bust/avatar crop deliberately via the central
// focal table in lib/character.ts. Decorative by default: pass `alt` only
// where she carries information; otherwise she is aria-hidden so screen
// readers hear the content, not the decoration.

export function CharacterIllustration({
  mood = "idle",
  mode = "full",
  alt,
  outfit,
  priority,
  className,
}: {
  mood?: CharacterMood;
  mode?: CharacterMode;
  /** Meaningful description. Omit for decorative placements (the default). */
  alt?: string;
  /** Art base override (e.g. a store preview). Defaults to the equipped outfit. */
  outfit?: string;
  priority?: boolean;
  className?: string;
}) {
  const player = usePlayer();
  const base = outfit ?? equippedOutfitBase(player);
  const art = artFor(base, mood);
  const decorative = !alt;

  if (mode === "bust" || mode === "avatar") {
    const focal = BUST_FOCAL[mood];
    return (
      <div
        className={cn(
          "relative overflow-hidden",
          mode === "bust"
            ? "rounded-[1.75rem] ring-2 ring-white/70 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)]"
            : "rounded-full ring-1 ring-hairline",
          mood === "cheer" && "animate-cheer",
          className,
        )}
        aria-hidden={decorative || undefined}
      >
        <div className="absolute inset-0" style={{ background: "var(--surface-wash)" }} aria-hidden />
        {/* The ONE deliberate crop in the character system: cover + the
            central focal table frames her face per pose. Every other mode is
            contain-fit (enforced by lib/character.test.mjs). */}
        <Image
          src={art}
          alt={alt ?? ""}
          fill
          sizes={mode === "avatar" ? "48px" : "160px"}
          priority={priority}
          className="object-cover"
          style={{
            transform: `scale(${focal.scale})`,
            objectPosition: `center ${focal.y}%`,
          }}
        />
      </div>
    );
  }

  // full / three-quarter / scene: the whole figure, always contain-fit.
  return (
    <div
      className={cn(
        "relative select-none",
        mode === "three-quarter" ? "aspect-[3/4]" : "h-full w-full",
        mood === "cheer" && "animate-cheer",
        className,
      )}
      aria-hidden={decorative || undefined}
    >
      <Image
        src={art}
        alt={alt ?? ""}
        fill
        sizes="(max-width: 640px) 45vw, 320px"
        priority={priority}
        className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]"
      />
    </div>
  );
}

export { CHARACTER };
