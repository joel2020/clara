"use client";

import { CharacterIllustration } from "@/components/character";

// Shown while local data loads instead of a blank flash. The delayed fade-in
// means fast loads (the normal case) never see it at all.
//
// `thinking` is the manifest's loading state — a wait that reads as
// consideration. Decorative: the role="status" label already announces it, and
// the old ambient float is gone (micro-movement only, per the design system).

export function Splash() {
  return (
    <div className="splash-delayed grid min-h-[60vh] place-items-center" role="status" aria-label="Loading">
      <CharacterIllustration state="thinking" frame="bust" className="size-24" />
    </div>
  );
}
