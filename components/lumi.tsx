"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { equippedOutfitBase } from "@/lib/cosmetics";

// Lumi — the app's anime study-buddy character. A set of real illustrations
// (same girl): waving, cheering, thinking, and more. Moods map to artwork;
// animation and framing layer on top. `full` shows the whole figure; `bust`
// crops to her face for reaction moments. Her outfit is swappable in the shop —
// each outfit is a full pose set under its own art base (see cosmetics.ts).

// Mood names and art resolution live in lib/character.ts (the character
// system's single source); this legacy component re-exports them so existing
// call sites keep working while surfaces migrate to components/character/*.
import { MOOD_SUFFIX, type CharacterMood } from "@/lib/character";

export type LumiMood = CharacterMood;
export { MOOD_SUFFIX };

export function Lumi({
  mood = "idle",
  frame = "full",
  className,
  priority,
  depth,
  outfit,
}: {
  mood?: LumiMood;
  frame?: "full" | "bust";
  className?: string;
  priority?: boolean;
  /** Full-frame only: a gentle perspective sway + ground shadow so she reads
   *  as a standing figure on a stage rather than a flat sticker. */
  depth?: boolean;
  /** Art base override (e.g. a shop preview). Defaults to the equipped outfit. */
  outfit?: string;
}) {
  // Resolve her current look: an explicit override, else the equipped outfit.
  const player = usePlayer();
  const base = outfit ?? equippedOutfitBase(player);
  const art = `${base}${MOOD_SUFFIX[mood]}.png`;

  if (frame === "bust") {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.75rem] ring-2 ring-white/70 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.25)]",
          mood === "cheer" && "animate-cheer",
          className,
        )}
      >
        {/* soft candy backdrop behind her */}
        <div className="absolute inset-0 game-hero" aria-hidden />
        <Image
          src={art}
          alt="Lumi"
          fill
          sizes="160px"
          priority={priority}
          className={cn(
            "object-cover",
            // Each artwork frames her face differently; crop per pose to keep
            // her face centered in the bust circle.
            mood === "cheer"
              ? "scale-[1.5] object-[center_30%]"
              : mood === "think"
                ? "scale-[1.4] object-[center_12%]"
                : mood === "encourage" || mood === "clap" || mood === "point" || mood === "love"
                  ? "scale-[1.3] object-[center_13%]"
                  : "scale-[1.35] object-[center_8%]",
          )}
        />
      </div>
    );
  }

  if (depth) {
    return (
      <div className={cn("lumi-stage relative h-full w-full select-none", className)}>
        {/* ground contact shadow — sells that she's standing on a surface */}
        <span className="lumi-shadow" aria-hidden />
        <div className={cn("lumi-3d absolute inset-0", mood === "cheer" ? "animate-cheer" : "")}>
          <Image
            src={art}
            alt="Lumi, tu amiga de estudio"
            fill
            sizes="(max-width: 640px) 45vw, 320px"
            priority={priority}
            className="object-contain drop-shadow-[0_18px_26px_rgba(0,0,0,0.22)]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full select-none", mood !== "cheer" && "animate-float", mood === "cheer" && "animate-cheer", className)}>
      <Image
        src={art}
        alt="Lumi, tu amiga de estudio"
        fill
        sizes="(max-width: 640px) 45vw, 320px"
        priority={priority}
        className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]"
      />
    </div>
  );
}
