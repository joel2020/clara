"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

// Lumi — the app's anime study-buddy character. Three real illustrations
// (same girl, generated from the same reference): waving, mid-jump cheering,
// and thinking with a hand on her chin. Moods map to artwork; animation and
// framing layer on top. `full` shows the whole sticker; `bust` crops to her
// face for reaction moments (result card, etc.).

export type LumiMood = "idle" | "wave" | "cheer" | "think" | "encourage" | "clap" | "point" | "love";

const MOOD_ART: Record<LumiMood, string> = {
  idle: "/character/lumi.png",
  wave: "/character/lumi.png",
  cheer: "/character/lumi-cheer.png",
  think: "/character/lumi-think.png",
  encourage: "/character/lumi-encourage.png",
  clap: "/character/lumi-clap.png",
  point: "/character/lumi-point.png",
  love: "/character/lumi-love.png",
};

export function Lumi({
  mood = "idle",
  frame = "full",
  className,
  priority,
  depth,
}: {
  mood?: LumiMood;
  frame?: "full" | "bust";
  className?: string;
  priority?: boolean;
  /** Full-frame only: a gentle perspective sway + ground shadow so she reads
   *  as a standing figure on a stage rather than a flat sticker. */
  depth?: boolean;
}) {
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
          src={MOOD_ART[mood]}
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
            src={MOOD_ART[mood]}
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
        src={MOOD_ART[mood]}
        alt="Lumi, tu amiga de estudio"
        fill
        sizes="(max-width: 640px) 45vw, 320px"
        priority={priority}
        className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]"
      />
    </div>
  );
}
