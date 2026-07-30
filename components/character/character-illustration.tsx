"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  CLARA_ARTWORK_AVAILABLE,
  CLARA_ASSETS,
  type CharacterFrame,
  type CharacterState,
} from "@/lib/character";
import type { CoachLang } from "@/lib/i18n";

// Clara, rendered from her manifest. CHARACTER_DESIGN_SYSTEM.md is the locked
// visual authority; CLARA_ASSETS in lib/character.ts is its typed runtime
// contract and the ONLY source of a path, an alt string, or a reduced-motion
// still. Nothing here hardcodes artwork.
//
// Three rules, all straight from the design system:
//   • Contain, always. Each asset is drawn inside its own transparent safe
//     area, so contain-fit is exactly what keeps that area intact. The only
//     sanctioned crops are the approved `bust` and `avatar` frames — cropped by
//     the illustrator against the state's focal anchor, never by CSS.
//   • Decorative by default. `meaningful` opts in to the manifest's localized
//     alt, and only where Clara carries information the surrounding copy does
//     not already say. Otherwise she is aria-hidden, so a screen reader hears
//     the lesson instead of the decoration.
//   • Under prefers-reduced-motion the manifest names the exact still to show,
//     and nothing on the figure animates.
//
// Deliberately hook-free with respect to app state: this renders on pre-session
// screens that live outside SettingsProvider and DataScope, and Clara's look
// never depends on the learner's purchases — the guide is not something the
// learner dresses. Learner-owned cosmetics live in components/avatar and
// components/lumi-scene.

/** The frames that show the figure. `bust`/`avatar` arrive pre-cropped. */
const FIGURE_FRAMES = new Set<CharacterFrame>(["full", "threeQuarter"]);

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function CharacterIllustration({
  state,
  frame = "full",
  meaningful = false,
  lang = "es",
  preload,
  className,
}: {
  /** One of the seven approved states (lib/character.ts). */
  state: CharacterState;
  frame?: CharacterFrame;
  /** Give this render the state's localized alt. Default: decorative. */
  meaningful?: boolean;
  /** Which manifest alt to use. Spanish is the coaching default. */
  lang?: CoachLang;
  /** Preload when this is the page's above-the-fold hero. next/image 16
   *  deprecated `priority` in favour of `preload`. */
  preload?: boolean;
  className?: string;
}) {
  const art = CLARA_ASSETS[state];
  const reduced = usePrefersReducedMotion();
  // The manifest's reduced-motion still is the state's own preferred framing,
  // so it substitutes only for the figure frames: the chips are already still
  // images, and a full-figure still is unreadable in a 48px circle.
  const src = reduced && FIGURE_FRAMES.has(frame) ? art.reducedMotion : art.frames[frame];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const alt = meaningful ? art.alt[lang] : "";

  // Never request art that does not exist. Until the approved assets land,
  // every manifest path is a 404, so render the neutral placeholder rather than
  // a broken image; flipping CLARA_ARTWORK_AVAILABLE is the only change the
  // artwork commit needs. The same placeholder covers a single missing state.
  if (!CLARA_ARTWORK_AVAILABLE || failedSrc === src) {
    return <ClaraPlaceholder alt={alt} className={className} />;
  }

  return (
    // motion-reduce:animate-none neutralizes any entrance or sway a caller
    // layered on the figure; the component itself adds no ambient loop.
    <div
      className={cn("relative h-full w-full select-none motion-reduce:animate-none", className)}
      aria-hidden={meaningful ? undefined : true}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={
          frame === "avatar" ? "64px" : frame === "bust" ? "160px" : "(max-width: 640px) 45vw, 320px"
        }
        preload={preload}
        className={cn(
          "object-contain",
          FIGURE_FRAMES.has(frame) && "drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]",
        )}
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}

/**
 * The neutral stand-in: a monogram medallion, drawn as SVG so it scales into
 * any box without a second set of size rules. Deliberately NOT temporary
 * generated art — placeholder art has a way of shipping.
 */
function ClaraPlaceholder({ alt, className }: { alt: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-full w-full select-none", className)}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <circle cx="50" cy="50" r="46" fill="var(--secondary)" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-display)"
        fontSize="44"
        fill="var(--muted-foreground)"
      >
        C
      </text>
    </svg>
  );
}
