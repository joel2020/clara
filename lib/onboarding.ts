import { type Level, type SelfLevel, levelIndex } from "./placement.ts";

// What onboarding collects, and how a learner's level + goal turn into a
// personalized first week. Kept as pure data + functions so it's testable and
// the UI just renders the result. Copy is Colombian-Spanish and warm.

export type Goal = "travel" | "social" | "work" | "moving" | "dating" | "fluency";

export const GOALS: { id: Goal; es: string; en: string; emoji?: never }[] = [
  { id: "travel", es: "Viajar", en: "Travel" },
  { id: "social", es: "Soltarme con la gente", en: "Social confidence" },
  { id: "work", es: "Trabajo y carrera", en: "Work / career" },
  { id: "moving", es: "Irme a vivir afuera", en: "Moving abroad" },
  { id: "dating", es: "Citas y relaciones", en: "Dating / relationships" },
  { id: "fluency", es: "Fluidez en general", en: "General fluency" },
];

export type DailyMinutes = 10 | 20 | 30;

/** Everything gathered during onboarding, saved on the learner's profile. */
export interface OnboardingProfile {
  name: string;
  country: string; // default "Colombia"
  city: string; // default "Medellín"
  goal: Goal;
  dailyMinutes: DailyMinutes;
  selfLevel: SelfLevel;
  /** Assigned by placement (or one lower if they chose to rebuild confidence). */
  level: Level;
  /** Per-skill subscores from placement, 0..5 CEFR-aligned. */
  subscores?: Record<string, number>;
  completedAt: number;
}

// ── First-week plan ──────────────────────────────────────────────────────────

export interface PlanDay {
  day: number; // 1..7
  focus: string; // conversation-track lesson id or module key
  titleEs: string;
  titleEn: string;
}

// The thematic spine per level band. A0/A1 = survival; A2 = daily life; B1 =
// opinions/stories; B2/C1 = nuance/roleplay. Goal tilts the emphasis (e.g. a
// "dating" learner gets the small-talk/plans units earlier).
const BAND_UNITS: Record<"beginner" | "everyday" | "conversational" | "advanced", string[]> = {
  beginner: ["conv-greetings", "conv-american", "conv-numbers", "conv-cafe", "conv-shopping", "flap-t", "conv-directions"],
  everyday: ["conv-cafe", "conv-directions", "conv-transport", "conv-shopping", "conv-time", "conv-smalltalk", "american-r"],
  conversational: ["conv-smalltalk", "conv-plans", "conv-work", "conv-feelings", "conv-travel", "conv-american-2", "conv-phone"],
  advanced: ["conv-feelings", "conv-work", "conv-phone", "conv-emergency", "conv-health", "conv-american-2", "conv-hotel"],
};

export function bandFor(level: Level): keyof typeof BAND_UNITS {
  const i = levelIndex(level);
  if (i <= 1) return "beginner"; // A0, A1
  if (i === 2) return "everyday"; // A2
  if (i === 3) return "conversational"; // B1
  return "advanced"; // B2, C1
}

const BAND_ORDER: (keyof typeof BAND_UNITS)[] = ["beginner", "everyday", "conversational", "advanced"];

/**
 * The ordered pool of lesson ids appropriate to a level — this band plus the
 * next one up, so there's always room to progress. The daily lesson picker
 * walks this before falling back to the full curriculum, which is what makes a
 * beginner and a B1 learner get different daily lessons.
 */
export function levelLessonPool(level: Level): string[] {
  const b = bandFor(level);
  const i = BAND_ORDER.indexOf(b);
  const next = BAND_ORDER[i + 1];
  const ids = [...BAND_UNITS[b], ...(next ? BAND_UNITS[next] : [])];
  return [...new Set(ids)]; // de-dupe overlaps between bands
}

// Goal → a unit to pull forward so week 1 feels personal.
const GOAL_ANCHOR: Record<Goal, string> = {
  travel: "conv-travel",
  social: "conv-smalltalk",
  work: "conv-work",
  moving: "conv-transport",
  dating: "conv-plans",
  fluency: "conv-smalltalk",
};

/**
 * A 7-day starter plan tuned to level + goal. Beginners get survival units with
 * short guided conversations; higher levels skip ahead to opinions, work, and
 * roleplay — so two learners at different levels genuinely see different weeks.
 */
export function firstWeekPlan(level: Level, goal: Goal): PlanDay[] {
  const band = bandFor(level);
  const units = [...BAND_UNITS[band]];
  // Pull the goal anchor to day 2 if it's in this band's pool (else keep spine).
  const anchor = GOAL_ANCHOR[goal];
  const ai = units.indexOf(anchor);
  if (ai > 1) {
    units.splice(ai, 1);
    units.splice(1, 0, anchor);
  }
  const seven = units.slice(0, 7);
  while (seven.length < 7) seven.push(units[seven.length % units.length]);

  return seven.map((focus, i) => ({
    day: i + 1,
    focus,
    titleEs: `Día ${i + 1}`,
    titleEn: `Day ${i + 1}`,
  }));
}

/** Warm, modern Colombian-Spanish result-screen copy for a level. */
export function levelBlurbEs(level: Level): { title: string; sub: string } {
  switch (level) {
    case "A0":
      return { title: "Empezamos desde cero — ¡lo mejor!", sub: "Vas a arrancar con lo esencial para defenderte ya." };
    case "A1":
      return { title: "Ya tienes una base", sub: "Vamos a soltarte con frases del día a día." };
    case "A2":
      return { title: "Te defiendes bien", sub: "Ahora a hablar en frases completas y con más confianza." };
    case "B1":
      return { title: "¡Ya conversas!", sub: "Subimos a historias, opiniones y situaciones reales." };
    case "B2":
      return { title: "Hablas con soltura", sub: "Pulimos naturalidad, matices y pronunciación." };
    case "C1":
      return { title: "Nivel avanzado", sub: "Afinamos acento, modismos y escucha rápida." };
  }
}
