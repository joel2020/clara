"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

// Lumi — the app's anime study-buddy character. Three real illustrations
// (same girl, generated from the same reference): waving, mid-jump cheering,
// and thinking with a hand on her chin. Moods map to artwork; animation and
// framing layer on top. `full` shows the whole sticker; `bust` crops to her
// face for reaction moments (result card, etc.).

export type LumiMood = "idle" | "wave" | "cheer" | "think";

const MOOD_ART: Record<LumiMood, string> = {
  idle: "/character/lumi.png",
  wave: "/character/lumi.png",
  cheer: "/character/lumi-cheer.png",
  think: "/character/lumi-think.png",
};

export function Lumi({
  mood = "idle",
  frame = "full",
  className,
  priority,
}: {
  mood?: LumiMood;
  frame?: "full" | "bust";
  className?: string;
  priority?: boolean;
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
            // Each artwork frames her face differently; crop per pose.
            mood === "cheer" ? "scale-[1.5] object-[center_30%]" : mood === "think" ? "scale-[1.4] object-[center_12%]" : "scale-[1.35] object-[center_8%]",
          )}
        />
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
