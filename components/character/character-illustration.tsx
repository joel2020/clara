"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { equippedOutfitBase } from "@/lib/cosmetics";
import {
  artFor,
  BASE_LUMI_ART_BASE,
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

interface CharacterIllustrationProps {
  mood?: CharacterMood;
  mode?: CharacterMode;
  /** Meaningful description. Omit for decorative placements (the default). */
  alt?: string;
  /** Art base override (e.g. a store preview). Defaults to the equipped outfit. */
  outfit?: string;
  priority?: boolean;
  className?: string;
  /** Reports a one-time switch from missing equipped art to base Lumi art. */
  onArtFallback?: () => void;
}

export function CharacterIllustration(props: CharacterIllustrationProps) {
  const player = usePlayer();
  const base = props.outfit ?? equippedOutfitBase(player);
  const requestKey = `${base}:${props.mood ?? "idle"}`;

  return <CharacterArtwork key={requestKey} {...props} base={base} />;
}

function CharacterArtwork({
  mood = "idle",
  mode = "full",
  alt,
  priority,
  className,
  onArtFallback,
  base,
}: Omit<CharacterIllustrationProps, "outfit"> & { base: string }) {
  const [phase, setPhase] = useState<"primary" | "base-fallback" | "terminal">("primary");
  const usingBaseFallback = phase === "base-fallback";
  const terminalFailure = phase === "terminal";
  const art = artFor(usingBaseFallback ? BASE_LUMI_ART_BASE : base, mood);
  const decorative = !alt;

  function handleArtError() {
    if (terminalFailure) return;
    if (usingBaseFallback || base === BASE_LUMI_ART_BASE) {
      setPhase("terminal");
      return;
    }
    setPhase("base-fallback");
    onArtFallback?.();
  }

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
        role={terminalFailure && !decorative ? "img" : undefined}
        aria-label={terminalFailure && !decorative ? alt : undefined}
      >
        <div className="absolute inset-0" style={{ background: "var(--surface-wash)" }} aria-hidden />
        {/* The ONE deliberate crop in the character system: cover + the
            central focal table frames her face per pose. Every other mode is
            contain-fit (enforced by lib/character.test.mjs). */}
        {!terminalFailure && (
          <Image
            src={art}
            alt={alt ?? ""}
            fill
            sizes={mode === "avatar" ? "48px" : "160px"}
            priority={priority}
            className="object-cover"
            onError={handleArtError}
            style={{
              transform: `scale(${focal.scale})`,
              objectPosition: `center ${focal.y}%`,
            }}
          />
        )}
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
      role={terminalFailure && !decorative ? "img" : undefined}
      aria-label={terminalFailure && !decorative ? alt : undefined}
    >
      {!terminalFailure && (
        <Image
          src={art}
          alt={alt ?? ""}
          fill
          sizes="(max-width: 640px) 45vw, 320px"
          priority={priority}
          className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]"
          onError={handleArtError}
        />
      )}
    </div>
  );
}

export { CHARACTER };
