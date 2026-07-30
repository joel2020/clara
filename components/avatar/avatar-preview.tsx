"use client";

import { cn } from "@/lib/utils";
import { AvatarStage } from "@/components/avatar/avatar-stage";
import type { AvatarLoadout } from "@/lib/avatar";

// The store's mirror for the learner's own avatar: base, outfit, cap, and pet
// together, full-body, at every width from a 320px phone up. The stage is
// width-driven and capped, so the figure grows with the card instead of
// shrinking into a corner — and a card tap can pass a try-on loadout to see an
// item before any star is spent.

export function AvatarPreview({
  loadout,
  label,
  alt,
  className,
}: {
  loadout: AvatarLoadout;
  /** Visible caption above the stage (e.g. "Tu avatar"). */
  label?: string;
  /** One localized name for the whole figure. Leave out to keep it decorative. */
  alt?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <p className="type-label mb-2">{label}</p>}
      <div
        className="rounded-3xl border border-hairline p-3 shadow-sm ring-1 ring-black/5"
        style={{ background: "var(--surface-wash)" }}
      >
        <AvatarStage
          loadout={loadout}
          alt={alt}
          priority
          className="max-w-[11rem] min-[400px]:max-w-[13rem] sm:max-w-[15rem]"
        />
      </div>
    </div>
  );
}
