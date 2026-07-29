// The character system's single source of truth. Identity, from product
// history rather than invention: Joel is the human teacher and primary guide
// (his photo, voice, and video); Lumi is the recurring illustrated companion —
// drawn to mirror the learner, dressed by the learner in the store — who
// reacts, encourages, and models outfits but never competes with Joel as a
// teacher; Clara is the product and its editorial voice. Pure module: no
// hooks, no repo, plain-node testable.

export type CharacterMood = "idle" | "wave" | "cheer" | "think" | "encourage" | "clap" | "point" | "love";

export const MOODS: CharacterMood[] = ["idle", "wave", "cheer", "think", "encourage", "clap", "point", "love"];

/** Per-mood filename suffix on an outfit's art base
 *  (base "/character/lumi" → "/character/lumi-cheer.png"; idle/wave = base). */
export const MOOD_SUFFIX: Record<CharacterMood, string> = {
  idle: "",
  wave: "",
  cheer: "-cheer",
  think: "-think",
  encourage: "-encourage",
  clap: "-clap",
  point: "-point",
  love: "-love",
};

export function artFor(base: string, mood: CharacterMood): string {
  return `${base}${MOOD_SUFFIX[mood]}.png`;
}

export const CHARACTER = {
  id: "lumi",
  /** Companion, not coach: Joel teaches; Lumi accompanies and celebrates. */
  role: "companion",
  /** The meaningful alt, used ONLY where she carries information. Everywhere
   *  else she is decoration and renders aria-hidden. */
  alt: { es: "Lumi, tu compañera de estudio", en: "Lumi, your study companion" },
} as const;

/**
 * Display modes. Every mode is contain-fit — the figure is never cropped,
 * covered, or stretched — except `bust`, which crops deliberately to her face
 * using the centralized focal table below.
 */
export const MODES = {
  /** Whole standing figure (hero cards, onboarding result, splash). */
  full: { fit: "contain" } as const,
  /** Waist-up in a portrait card (side-by-side layouts, tight heights). */
  "three-quarter": { fit: "contain" } as const,
  /** Face chip for reactions and headers. The only cropping mode. */
  bust: { fit: "focal" } as const,
  /** Tiny identity dot (lists, toasts). Same art as bust, smaller ring. */
  avatar: { fit: "focal" } as const,
  /** Full figure standing on her equipped stage (store preview, home hero). */
  scene: { fit: "contain" } as const,
} as const;

export type CharacterMode = keyof typeof MODES;

/**
 * Bust focal crops per mood — each artwork frames her face differently, so the
 * crop lives HERE, once, instead of as scattered per-callsite class hacks.
 * scale zooms the contain-fit art; y is the vertical focal point (%).
 */
export const BUST_FOCAL: Record<CharacterMood, { scale: number; y: number }> = {
  idle: { scale: 1.35, y: 8 },
  wave: { scale: 1.35, y: 8 },
  cheer: { scale: 1.5, y: 30 },
  think: { scale: 1.4, y: 12 },
  encourage: { scale: 1.3, y: 13 },
  clap: { scale: 1.3, y: 13 },
  point: { scale: 1.3, y: 13 },
  love: { scale: 1.3, y: 13 },
};
