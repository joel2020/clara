"use client";

import { LumiScene } from "@/components/lumi-scene";
import { cn } from "@/lib/utils";

// The store's try-on mirror: Lumi full-figure on her equipped stage
// (background, effect, accessory, pet), with an optional outfit override so a
// card tap can preview before buying. Responsive by height steps; the figure
// itself is contain-fit inside the stage, so head, hands, and hem survive
// every width — 320 included.

export function CharacterPreview({
  bgId,
  accessoryId,
  effectId,
  petId,
  outfit,
  label,
  className,
}: {
  bgId: string;
  accessoryId: string;
  effectId: string;
  petId?: string;
  /** Temporary art-base override for trying on an unowned outfit. */
  outfit?: string;
  /** Visible caption above the stage (e.g. "Así se ve Lumi"). */
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && <p className="type-label mb-2">{label}</p>}
      <LumiScene
        bgId={bgId}
        accessoryId={accessoryId}
        effectId={effectId}
        petId={petId}
        outfit={outfit}
        priority
        className="h-56 shadow-sm ring-1 ring-black/5 min-[400px]:h-64 sm:h-72"
      />
    </div>
  );
}
