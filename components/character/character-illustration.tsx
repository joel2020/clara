"use client";

import { useState } from "react";
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
//   • The manifest names one still per state — the state's own preferred
//     framing — as what a reduced-motion render must show. That makes it the
//     right default for any render that has not pinned a frame, so `frame`
//     resolves to it rather than to a hardcoded guess, and nothing the
//     component draws ever moves.
//
// Deliberately hook-free with respect to app state: this renders on pre-session
// screens that live outside SettingsProvider and DataScope, and Clara's look
// never depends on the learner's purchases — the guide is not something the
// learner dresses. Learner-owned cosmetics live in components/avatar and
// components/lumi-scene.

/** The frames that show the figure. `bust`/`avatar` arrive pre-cropped. */
const FIGURE_FRAMES = new Set<CharacterFrame>(["full", "threeQuarter"]);

/** Per-frame `sizes`, so the browser never downloads a 864px sheet for a chip. */
const FRAME_SIZES: Record<CharacterFrame, string> = {
  full: "(max-width: 640px) 45vw, 320px",
  threeQuarter: "(max-width: 640px) 60vw, 360px",
  bust: "160px",
  avatar: "64px",
};

/**
 * The state's documented reduced-motion still, as a frame. It is the framing
 * the state was designed around, so it is what an unpinned render should show.
 * A pinned frame is honoured as-is: a caller pins a frame because it pinned a
 * layout, and swapping the aspect ratio out from under it would break that
 * layout for exactly the people who asked for less disruption.
 */
function documentedFrame(state: CharacterState): CharacterFrame {
  const { frames, reducedMotion } = CLARA_ASSETS[state];
  return (Object.keys(frames) as CharacterFrame[]).find((f) => frames[f] === reducedMotion) ?? "full";
}

export function CharacterIllustration({
  state,
  frame,
  meaningful = false,
  lang = "es",
  preload,
  className,
}: {
  /** One of the seven approved states (lib/character.ts). */
  state: CharacterState;
  /** Defaults to the state's documented reduced-motion still. */
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
  const shown = frame ?? documentedFrame(state);
  const src = art.frames[shown];
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
        sizes={FRAME_SIZES[shown]}
        preload={preload}
        className={cn(
          "object-contain",
          FIGURE_FRAMES.has(shown) && "drop-shadow-[0_14px_30px_rgba(0,0,0,0.14)]",
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
