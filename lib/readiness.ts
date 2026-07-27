import type { Attempt, ItemProgress } from "@/lib/db/types";
import type { Level } from "@/lib/placement";
import { isMastered } from "@/lib/srs";

// The one number the whole app points at.
//
// Both paths share this engine; only the target's framing and the curriculum
// order differ. The contract that keeps it honest (see the spec at
// docs/superpowers/specs/2026-07-26-employability-track-design.md):
//
//   1. A band is only asserted after an assessment. Until a stage exam has been
//      passed, `provisional` is true and the UI must say so.
//   2. Repeating mastered material must not move the number. Breadth is capped
//      so volume alone cannot carry it.
//   3. The blocker is always the single lowest subskill, named, so the student
//      is told the one thing to fix rather than graded on everything.

export type LearningPath = "job" | "general";
export type SubskillKey = "intelligibility" | "fluency" | "listening" | "interaction";

export interface Subskill {
  key: SubskillKey;
  score: number;
  atTarget: boolean;
}

export interface Readiness {
  score: number;
  band: Level;
  target: number;
  subskills: Subskill[];
  /** The single lowest subskill below target — the one thing to work on. */
  blocker: SubskillKey | null;
  /** True until a stage exam has actually been passed at this band. */
  provisional: boolean;
}

export interface ReadinessInput {
  attempts: Attempt[];
  progress: ItemProgress[];
  band: Level;
  path: LearningPath;
  examPassed?: boolean;
}

/** B2 is the hiring bar and the fluency bar alike. */
export const TARGET_SCORE = 80;

/** How many recent attempts count toward the live subskills. */
const RECENT = 40;

/**
 * Breadth is capped at this many practised items. Past the cap, more volume adds
 * nothing — otherwise a student could grind easy words to the target without ever
 * speaking better, which is precisely what the score contract forbids.
 */
const BREADTH_CAP = 150;

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const { attempts, progress, band, examPassed = false } = input;

  const recent = [...attempts].sort((a, b) => b.at - a.at).slice(0, RECENT);
  const practised = progress.filter((p) => p.attempts > 0);

  // Intelligibility — how accurately her recent speech was recognised.
  const intelligibility = clamp(mean(recent.map((a) => a.score)));

  // Fluency — recent pass rate. This is a proxy: Azure returns a real
  // FluencyScore per attempt, but it is not persisted on Attempt yet, so this
  // stands in until Phase 2 threads it through. Do not present it as measured
  // fluency in copy while it is still a proxy.
  const passRate = recent.length ? recent.filter((a) => a.passed).length / recent.length : 0;
  const fluency = clamp(passRate * 100);

  // Listening — the share of what she has touched that reached mastery.
  const listening = clamp(practised.length ? (practised.filter(isMastered).length / practised.length) * 100 : 0);

  // Interaction — breadth of material she can handle at all, capped.
  const interaction = clamp((Math.min(practised.length, BREADTH_CAP) / BREADTH_CAP) * 100);

  const subskills: Subskill[] = (
    [
      ["intelligibility", intelligibility],
      ["fluency", fluency],
      ["listening", listening],
      ["interaction", interaction],
    ] as const
  ).map(([key, score]) => ({ key, score, atTarget: score >= TARGET_SCORE }));

  const score = clamp(mean(subskills.map((s) => s.score)));

  // Lowest subskill wins the blocker slot; ties resolve to the earlier key so the
  // UI does not flicker between equals on every recompute.
  const lowest = subskills.reduce((a, b) => (b.score < a.score ? b : a));
  const blocker = score > 0 && !lowest.atTarget ? lowest.key : null;

  return { score, band, target: TARGET_SCORE, subskills, blocker, provisional: !examPassed };
}
