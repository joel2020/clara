"use client";

import { CharacterIllustration } from "./character-illustration";
import { cn } from "@/lib/utils";
import type { CharacterState } from "@/lib/character";

// Clara reacting to a moment: her bust with one short line beside it (a line
// only where words genuinely help — most reactions need none). The artwork is
// decorative because the LINE carries the meaning for a screen reader, so the
// image stays hidden and the text does the talking.

export function CharacterReaction({
  state,
  children,
  size = "size-14",
  className,
}: {
  state: CharacterState;
  /** One short line, already localized. Omit for a wordless reaction. */
  children?: React.ReactNode;
  size?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CharacterIllustration state={state} frame="bust" className={cn(size, "shrink-0")} />
      {children && (
        <p className="type-support min-w-0 rounded-2xl rounded-bl-md border border-hairline bg-card px-3.5 py-2.5 text-foreground">
          {children}
        </p>
      )}
    </div>
  );
}
