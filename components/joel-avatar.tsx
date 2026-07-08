"use client";

import { cn } from "@/lib/utils";

// Joel's face in the conversation: a monogram chip with the tricolor ring (his
// portrait can drop in here later without touching call sites). When `speaking`
// is true a small equalizer replaces the initial, so she can SEE that the voice
// is his and know when to listen vs talk.

export function JoelAvatar({ speaking, className }: { speaking?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background shadow-sm",
        className,
      )}
      aria-hidden
    >
      {/* tricolor ring */}
      <span className="flag-bar absolute inset-0 rounded-full opacity-90" />
      <span className="absolute inset-[2.5px] grid place-items-center rounded-full bg-foreground">
        {speaking ? (
          <span className="eq-bars text-background">
            <i /><i /><i />
          </span>
        ) : (
          <span className="font-display text-[13px] font-semibold leading-none">J</span>
        )}
      </span>
    </span>
  );
}
