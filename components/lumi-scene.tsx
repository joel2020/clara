"use client";

import { cn } from "@/lib/utils";
import { Lumi, type LumiMood } from "@/components/lumi";
import { getCosmetic, type EffectKind } from "@/lib/cosmetics";
import { SceneArt } from "@/components/scene-art";

// Lumi on her equipped "stage" — the chosen background, ambient effect, and a
// prop accessory. Used on the home hero and as the live preview in the shop, so
// buying/equipping a cosmetic updates the look everywhere instantly.

const EFFECT_EMOJI: Record<EffectKind, string> = {
  hearts: "💕",
  petals: "🌸",
  snow: "❄️",
  sparkle: "✨",
  confetti: "🎉",
  stars: "⭐",
  bubbles: "🫧",
  notes: "🎵",
  leaves: "🍃",
  rainbow: "🌈",
  coins: "🌟",
  diamonds: "💎",
  fireworks: "🎆",
};

// Rising float up from below; twinkle fade in place; the rest fall from above.
const RISING = new Set<EffectKind>(["hearts", "bubbles", "notes"]);
const TWINKLE = new Set<EffectKind>(["sparkle", "stars"]);

export function EffectLayer({ kind }: { kind: EffectKind }) {
  const rising = RISING.has(kind);
  const twinkle = TWINKLE.has(kind);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => {
        const left = (i * 8.7 + (i % 3) * 5) % 96;
        const delay = (i % 6) * 0.6;
        const dur = 4 + (i % 4);
        const size = 12 + (i % 3) * 6;
        const style: React.CSSProperties = { left: `${left}%`, fontSize: size };
        if (twinkle) {
          style.top = `${(i * 7.5) % 88}%`;
          style.animation = `fx-twinkle ${2 + (i % 3)}s ease-in-out ${delay}s infinite`;
        } else if (rising) {
          style.bottom = "-8%";
          style.animation = `fx-rise ${dur}s linear ${delay}s infinite`;
        } else {
          style.top = "-8%";
          style.animation = `fx-fall ${dur}s linear ${delay}s infinite`;
        }
        return (
          <span key={i} className="absolute" style={style}>
            {EFFECT_EMOJI[kind]}
          </span>
        );
      })}
    </div>
  );
}

export function LumiScene({
  bgId,
  accessoryId,
  effectId,
  mood = "wave",
  className,
}: {
  bgId: string;
  accessoryId: string;
  effectId: string;
  mood?: LumiMood;
  className?: string;
}) {
  const bg = getCosmetic(bgId);
  const acc = getCosmetic(accessoryId);
  const fx = getCosmetic(effectId);
  return (
    <div className={cn("relative overflow-hidden rounded-3xl", className)} style={{ background: bg?.background }}>
      <SceneArt bgId={bgId} />
      {fx?.effect && <EffectLayer kind={fx.effect} />}
      <div className="absolute inset-x-0 bottom-0 top-3">
        <Lumi frame="full" mood={mood} />
      </div>
      {acc?.emoji && (
        <span className="animate-float absolute right-4 top-4 text-3xl drop-shadow-sm" style={{ animationDelay: "0.4s" }}>
          {acc.emoji}
        </span>
      )}
    </div>
  );
}
