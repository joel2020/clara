"use client";

import { cn } from "@/lib/utils";
import { getCosmetic } from "@/lib/cosmetics";

// Her companion pet on Lumi's stage — not a static emoji in a corner, but a
// little creature that bobs beside her with its own ground shadow. Legendary
// pets get a soft golden sparkle so they read as the luxury items they are.

export function PetSprite({ petId, className, size = "text-4xl" }: { petId?: string; className?: string; size?: string }) {
  const pet = getCosmetic(petId);
  if (!pet || !pet.emoji) return null;
  const legendary = pet.rarity === "legendary";
  return (
    <div className={cn("pointer-events-none relative flex flex-col items-center", className)} aria-hidden>
      {legendary && (
        <span className="absolute -top-2 text-sm" style={{ animation: "fx-twinkle 2.2s ease-in-out infinite" }}>
          ✨
        </span>
      )}
      <span className={cn("animate-float drop-shadow-[0_6px_10px_rgba(0,0,0,0.2)]", size)} style={{ animationDelay: "0.8s" }}>
        {pet.emoji}
      </span>
      <span className="mt-0.5 h-1.5 w-8 rounded-full bg-black/20 blur-[2px]" style={{ animation: "pet-shadow 4s ease-in-out infinite" }} />
    </div>
  );
}
