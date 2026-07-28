"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/system/progress";

// The shared frame for every immersive activity (lesson stages, drills, talk,
// the call). One spine: exit → what am I in → how far along. Replaces the six
// per-drill "1 / 8" headers so practice feels like one product. Presentational:
// pages own the session logic and pass state down.

export function SessionShell({
  title,
  step,
  totalSteps,
  onExit,
  exitLabel = "Salir",
  children,
  footer,
  className,
}: {
  /** What she's inside, in her language: "Oído", "La llamada", "Saludos". */
  title: string;
  step: number;
  totalSteps: number;
  onExit?: () => void;
  exitLabel?: string;
  children: React.ReactNode;
  /** The action zone pinned to the thumb: mic, options, continue. */
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("safe-top flex min-h-[100dvh] flex-col", className)}>
      <header className="mx-auto w-full max-w-xl">
        <div className="page-gutter flex items-center gap-4 py-3">
          <button
            type="button"
            onClick={onExit}
            aria-label={exitLabel}
            className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
          <ProgressBar
            value={step}
            max={totalSteps}
            label={`${title}: paso ${step} de ${totalSteps}`}
            className="flex-1"
          />
          <span className="type-data text-muted-foreground">
            {step}/{totalSteps}
          </span>
        </div>
        <p className="page-gutter type-label pb-1">{title}</p>
      </header>

      <main className="page-gutter mx-auto w-full max-w-xl flex-1 py-4">{children}</main>

      {footer && (
        <footer
          className="page-gutter mx-auto w-full max-w-xl pb-4 pt-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
}
