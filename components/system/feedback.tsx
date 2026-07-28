"use client";

import { Volume2, Lightbulb, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// The one feedback anatomy, used after every spoken attempt anywhere in the
// app: what you said (her words, honored) → what landed (success ink) → the one
// thing to fix (warm tone, articulatory tip, replay). Never a wall of red;
// mistakes get guidance, not judgment.

export interface FeedbackWord {
  text: string;
  landed: boolean;
}

export function FeedbackPanel({
  heard,
  fix,
  onReplay,
  className,
}: {
  /** The attempt, word by word, with per-word verdicts. */
  heard: FeedbackWord[];
  /** The single most useful correction. One, not a list. */
  fix?: { focus: string; tip: string };
  onReplay?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("rounded-3xl border border-hairline bg-card p-5", className)}>
      <p className="type-label">Te escuché decir</p>
      <p className="type-title mt-2" lang="en">
        {heard.map((w, i) => (
          <span
            key={i}
            className={w.landed ? "text-foreground" : "text-muted-foreground underline decoration-[var(--warn)] decoration-2 underline-offset-4"}
          >
            {w.text}
            {i < heard.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      {fix && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--surface-wash)" }}>
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0">
            <p className="type-heading">
              <span lang="en">{fix.focus}</span>
            </p>
            <p className="type-support mt-0.5">{fix.tip}</p>
          </div>
          {onReplay && (
            <button
              type="button"
              onClick={onReplay}
              aria-label="Escuchar de nuevo"
              className="ml-auto grid size-11 shrink-0 place-items-center rounded-full border border-hairline bg-card text-foreground transition-colors hover:border-foreground/30"
            >
              <Volume2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** The single celebration mark: a tricolor stamp. Session end and exam pass
    only — everywhere else stays quiet. */
export function Stamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("stamp-in inline-flex flex-col items-center gap-2", className)}>
      <span className="grid size-16 place-items-center rounded-full border-2 border-foreground/80">
        <span className="grid size-12 place-items-center rounded-full flag-bar">
          <Check className="size-6 text-white" strokeWidth={3} aria-hidden />
        </span>
      </span>
      <span className="type-label text-foreground">{children}</span>
    </div>
  );
}
