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
  alt: { es: "Tu guía de estudio", en: "Your study guide" },
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

// ---------------------------------------------------------------------------
// Clara — the premium adult guide (CHARACTER_DESIGN_SYSTEM.md is the locked
// visual authority; this manifest is its typed runtime contract). Clara is the
// sole learner-facing daily guide; Joel remains the real human instructor.
// Lumi above stays exported until her consumers migrate (a later task).
// ---------------------------------------------------------------------------

/** The seven approved production states. No expansion before the master sheet
 *  is approved (see CHARACTER_DESIGN_SYSTEM.md, master-sheet gate). */
export type CharacterState =
  | "welcome"
  | "teaching"
  | "listening"
  | "encouraging"
  | "thinking"
  | "celebrating"
  | "store";

export const CHARACTER_STATES: CharacterState[] = [
  "welcome", "teaching", "listening", "encouraging", "thinking", "celebrating", "store",
];

/** Responsive derivatives of each state. `threeQuarter` is spelled
 *  `three-quarter` on disk (kebab-case filenames, camelCase keys). */
export type CharacterFrame = "full" | "threeQuarter" | "bust" | "avatar";

export const CHARACTER_FRAMES: CharacterFrame[] = ["full", "threeQuarter", "bust", "avatar"];

/** Filename segment per frame — the one place the key/disk spelling maps. */
export const FRAME_SLUG: Record<CharacterFrame, string> = {
  full: "full",
  threeQuarter: "three-quarter",
  bust: "bust",
  avatar: "avatar",
};

export interface ClaraStateAssets {
  /** Transparent WebP per frame: /character/clara/<state>-<frame-slug>.webp */
  frames: Record<CharacterFrame, string>;
  /** Normalized (0..1) transparent inset from each canvas edge to the figure.
   *  Layouts must keep this region intact — never crop into it except through
   *  the approved bust/avatar frames. */
  safeArea: { top: number; right: number; bottom: number; left: number };
  /** Normalized (0..1) focal point — her face on the full-figure canvas.
   *  Bust/avatar derivatives and any focal crop center here. */
  anchor: { x: number; y: number };
  /** Meaningful alt, used ONLY where the state carries information; everywhere
   *  else Clara is decorative and renders with empty alt / aria-hidden. */
  alt: { es: string; en: string };
  /** The exact still shown under prefers-reduced-motion: the state's own
   *  preferred-framing frame, never a substitute pose. */
  reducedMotion: string;
  /** Screens this state is approved for (documentation + review aid). */
  screens: string[];
}

function claraFrames(state: CharacterState): Record<CharacterFrame, string> {
  return {
    full: `/character/clara/${state}-full.webp`,
    threeQuarter: `/character/clara/${state}-three-quarter.webp`,
    bust: `/character/clara/${state}-bust.webp`,
    avatar: `/character/clara/${state}-avatar.webp`,
  };
}

/**
 * Whether the approved Clara artwork actually exists in public/character/clara.
 *
 * The manifest below is the contract the artwork will be drawn to, and it is
 * deliberately written before the assets exist. Until the master sheet is
 * approved and the seven states are produced, every path in CLARA_ASSETS is a
 * 404 — so consumers must render their own placeholder rather than requesting
 * one and handling the failure. Flip this to true in the same commit that adds
 * the files; nothing else needs to change.
 */
export const CLARA_ARTWORK_AVAILABLE = false;

/**
 * The Clara asset manifest — one entry per approved state. Safe areas and
 * anchors are the rendering contract the production assets are drawn into
 * (Task 2 renders to these numbers; tests pin them). Preferred framing per
 * state follows the spec: welcome/celebrating full, teaching/thinking
 * three-quarter, listening/encouraging bust, store full.
 */
export const CLARA_ASSETS: Record<CharacterState, ClaraStateAssets> = {
  welcome: {
    frames: claraFrames("welcome"),
    safeArea: { top: 0.04, right: 0.14, bottom: 0.02, left: 0.14 },
    anchor: { x: 0.5, y: 0.14 },
    alt: { es: "Clara te da la bienvenida", en: "Clara welcomes you" },
    reducedMotion: "/character/clara/welcome-full.webp",
    screens: ["dashboard hero", "onboarding", "daily session start"],
  },
  teaching: {
    frames: claraFrames("teaching"),
    // Open-palm gesture extends to her right (viewer left): wider left inset.
    safeArea: { top: 0.05, right: 0.1, bottom: 0.02, left: 0.2 },
    anchor: { x: 0.54, y: 0.15 },
    alt: { es: "Clara explica el ejercicio", en: "Clara explains the exercise" },
    reducedMotion: "/character/clara/teaching-three-quarter.webp",
    screens: ["lesson intro", "daily session teach step", "technique tips"],
  },
  listening: {
    frames: claraFrames("listening"),
    safeArea: { top: 0.05, right: 0.14, bottom: 0.02, left: 0.14 },
    // Attentive head tilt shifts the face slightly off-center.
    anchor: { x: 0.48, y: 0.15 },
    alt: { es: "Clara te escucha", en: "Clara is listening to you" },
    reducedMotion: "/character/clara/listening-bust.webp",
    screens: ["pronunciation recording", "conversation practice"],
  },
  encouraging: {
    frames: claraFrames("encouraging"),
    safeArea: { top: 0.05, right: 0.14, bottom: 0.02, left: 0.14 },
    anchor: { x: 0.5, y: 0.15 },
    alt: { es: "Clara te anima a intentarlo de nuevo", en: "Clara encourages you to try again" },
    reducedMotion: "/character/clara/encouraging-bust.webp",
    screens: ["practice feedback", "retry prompt", "near-miss result"],
  },
  thinking: {
    frames: claraFrames("thinking"),
    safeArea: { top: 0.05, right: 0.16, bottom: 0.02, left: 0.12 },
    // Reflective gaze up and aside.
    anchor: { x: 0.52, y: 0.14 },
    alt: { es: "Clara está pensando", en: "Clara is thinking" },
    reducedMotion: "/character/clara/thinking-three-quarter.webp",
    screens: ["grading wait", "loading states"],
  },
  celebrating: {
    frames: claraFrames("celebrating"),
    // Grounded joy, hands may rise: smaller top inset reserves headroom.
    safeArea: { top: 0.02, right: 0.14, bottom: 0.02, left: 0.14 },
    anchor: { x: 0.5, y: 0.16 },
    alt: { es: "Clara celebra tu logro", en: "Clara celebrates your achievement" },
    reducedMotion: "/character/clara/celebrating-full.webp",
    screens: ["session completion", "milestone unlock", "streak celebration"],
  },
  store: {
    frames: claraFrames("store"),
    safeArea: { top: 0.04, right: 0.14, bottom: 0.02, left: 0.14 },
    anchor: { x: 0.5, y: 0.14 },
    alt: { es: "Clara en la tienda", en: "Clara in the store" },
    reducedMotion: "/character/clara/store-full.webp",
    screens: ["store preview"],
  },
};
