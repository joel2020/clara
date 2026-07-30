"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lumi } from "@/components/lumi";

// Route-level recovery (audit P1: any render exception white-screened the
// whole app for a non-technical student). Completed work is safe by
// architecture — every attempt/score is written to IndexedDB the moment it
// happens — so the honest promise here is "nothing was lost, try again".
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Digest + message only — never transcripts, names, or audio.
    console.error("[clara] route error", error.digest ?? "", error.message);
  }, [error]);

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      <div className="h-28 w-24">
        <Lumi mood="think" priority />
      </div>
      <h1 className="mt-4 font-display text-2xl font-semibold">Algo salió mal</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        No fue tu culpa y tu progreso está guardado. Intenta de nuevo — si sigue igual, vuelve al
        inicio.
      </p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        Something went wrong on our side. Your progress is saved — try again, or go back home.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Reintentar · Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-hairline px-6 py-3 text-sm font-medium transition-colors hover:border-foreground/30"
        >
          Inicio · Home
        </Link>
      </div>
    </div>
  );
}
