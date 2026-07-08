"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// The reward visuals for a clear answer: a 1–3 star rating that pops in with a
// stagger, and a burst of little stars radiating outward — the "you got it!"
// dopamine hit at the heart of the game feel.

export function StarRating({ rating, size = 44 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2].map((i) => {
        const filled = i < rating;
        return (
          <Star
            key={i}
            aria-hidden
            strokeWidth={1.5}
            className={cn(filled ? "animate-star-pop text-co-yellow" : "text-muted-foreground/25")}
            style={{
              width: size,
              height: size,
              animationDelay: `${i * 0.13}s`,
              fill: filled ? "var(--co-yellow)" : "transparent",
              filter: filled ? "drop-shadow(0 3px 8px color-mix(in oklch, var(--co-yellow) 60%, transparent))" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function SparkleBurst({ count = 12 }: { count?: number }) {
  const parts = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const dist = 55 + (i % 3) * 26;
    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      delay: (i % 5) * 0.03,
      s: i % 2 ? 14 : 10,
    };
  });
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden>
      {parts.map((p, i) => (
        <span
          key={i}
          className="sparkle text-co-yellow"
          style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, animationDelay: `${p.delay}s` } as React.CSSProperties}
        >
          <Star style={{ width: p.s, height: p.s, fill: "var(--co-yellow)" }} strokeWidth={0} />
        </span>
      ))}
    </div>
  );
}
