"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

// Lumi — the app's anime study-buddy character. One illustration, reused
// everywhere; her "moods" are conveyed by animation and framing so she always
// looks like the same girl. `full` shows the whole hero sticker; `bust` crops
// to her face + waving hand for reaction moments (result card, etc.).

export type LumiMood = "idle" | "wave" | "cheer" | "think";

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
          src="/character/lumi.png"
          alt="Lumi"
          fill
          sizes="160px"
          priority={priority}
          className="scale-[1.35] object-cover object-[center_8%]"
        />
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full select-none", mood !== "cheer" && "animate-float", mood === "cheer" && "animate-cheer", className)}>
      <Image
        src="/character/lumi.png"
        alt="Lumi, tu amiga de estudio"
        fill
        sizes="(max-width: 640px) 45vw, 320px"
        priority={priority}
        className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]"
      />
    </div>
  );
}
