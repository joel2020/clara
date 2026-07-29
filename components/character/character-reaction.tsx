"use client";

import { CharacterIllustration } from "./character-illustration";
import { cn } from "@/lib/utils";
import type { CharacterMood } from "@/lib/character";

// Lumi reacting to the learner's moment — the companion's core job. A bust
// with an optional short line beside it (speech composition only where a line
// genuinely helps; most reactions need no words). The artwork is decorative —
// the LINE carries the meaning for screen readers — so the image stays hidden
// and the text does the talking.

export function CharacterReaction({
  mood,
  children,
  size = "size-14",
  className,
}: {
  mood: CharacterMood;
  /** One short line, already localized. Omit for a wordless reaction. */
  children?: React.ReactNode;
  size?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CharacterIllustration mode="bust" mood={mood} className={cn(size, "shrink-0")} />
      {children && (
        <p className="type-support min-w-0 rounded-2xl rounded-bl-md border border-hairline bg-card px-3.5 py-2.5 text-foreground">
          {children}
        </p>
      )}
    </div>
  );
}
