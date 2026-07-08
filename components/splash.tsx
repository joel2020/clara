"use client";

import { Lumi } from "@/components/lumi";

// Shown while local data loads instead of a blank flash. The delayed fade-in
// means fast loads (the normal case) never see it at all.

export function Splash() {
  return (
    <div className="splash-delayed grid min-h-[60vh] place-items-center" role="status" aria-label="Loading">
      <div className="animate-float">
        <Lumi frame="bust" className="size-24" />
      </div>
    </div>
  );
}
