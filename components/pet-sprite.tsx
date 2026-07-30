"use client";

import { cn } from "@/lib/utils";
import { getCosmetic } from "@/lib/cosmetics";

// Her companion pet on the equipped stage — not a static emoji in a corner, but a
// little creature that bobs beside her with its own ground shadow. Legendary
// pets get a soft golden sparkle so they read as the luxury items they are.

export function PetSprite({
  petId,
  className,
  size = "text-4xl",
  imgClass = "h-14",
}: {
  petId?: string;
  className?: string;
  size?: string;
  /** Height class for image pets (emoji pets scale via `size`). */
  imgClass?: string;
}) {
  const pet = getCosmetic(petId);
  if (!pet || (!pet.emoji && !pet.image)) return null;
  const legendary = pet.rarity === "legendary";
  return (
    <div className={cn("pointer-events-none relative flex flex-col items-center", className)} aria-hidden>
      {legendary && (
        <span className="absolute -top-2 z-10 text-sm" style={{ animation: "fx-twinkle 2.2s ease-in-out infinite" }}>
          ✨
        </span>
      )}
      {pet.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={pet.image}
          alt=""
          className={cn("animate-float w-auto drop-shadow-[0_6px_10px_rgba(0,0,0,0.2)]", imgClass)}
          style={{ animationDelay: "0.8s" }}
        />
      ) : (
        <span className={cn("animate-float relative grid place-items-center", size)} style={{ animationDelay: "0.8s" }}>
          {/* soft halo so an emoji companion reads as placed, not a bare glyph */}
          <span className="absolute inset-0 -z-10 scale-90 rounded-full bg-white/45 blur-md" aria-hidden />
          <span className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.22)]">{pet.emoji}</span>
        </span>
      )}
      <span className="mt-0.5 h-1.5 w-8 rounded-full bg-black/20 blur-[2px]" style={{ animation: "pet-shadow 4s ease-in-out infinite" }} />
    </div>
  );
}
