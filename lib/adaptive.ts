import type { Attempt, Settings } from "@/lib/db/types";

// Adaptive difficulty. Mariana told us the course felt "difficult," so instead of
// a fixed pass bar the app meets her where she is: when she's missing a lot, the
// bar eases so she keeps winning and stays motivated; when she's cruising, it
// tightens back up so she keeps growing. It's invisible — she just feels the app
// is fair.
//
// The single knob is `ease`: points shaved off every pass threshold in scoring
// (higher = more forgiving). The three modes:
//   • "gentle"  — always +10 (a beginner-friendly constant; the old default).
//   • "normal"  — always 0 (strict; precision practice).
//   • "auto"    — swings with her recent pass rate (the new default).

/** How many recent attempts define "recent" for the auto ramp. */
export const RECENT_WINDOW = 15;

/** Pass rate over the most recent attempts (0–1). Undefined-safe. */
export function recentPassRate(attempts: Pick<Attempt, "passed">[], window = RECENT_WINDOW): number | null {
  if (!attempts.length) return null;
  const recent = attempts.slice(-window);
  const passes = recent.reduce((n, a) => n + (a.passed ? 1 : 0), 0);
  return passes / recent.length;
}

/**
 * Points to shave off the pass threshold for this attempt.
 *   auto + struggling (<50% recent)  → +15  (generous — rebuild momentum)
 *   auto + finding-the-zone (50–85%) → +10  (the productive-struggle sweet spot)
 *   auto + cruising (>85%)           → +4   (nearly strict — keep her stretching)
 * A brand-new learner (no history yet) starts generous so the first minutes feel
 * winnable.
 */
export function adaptiveEase(difficulty: Settings["difficulty"], passRate: number | null): number {
  if (difficulty === "normal") return 0;
  if (difficulty === "gentle") return 10;
  // "auto"
  if (passRate === null) return 12; // no history yet — welcoming start
  if (passRate < 0.5) return 15;
  if (passRate <= 0.85) return 10;
  return 4;
}

/** A short, translatable label for how the app is currently pacing her. Used to
 *  reassure her in the UI when auto mode eases things after a rough patch. */
export function adaptiveTone(passRate: number | null): "warmup" | "steady" | "stretch" {
  if (passRate === null || passRate < 0.5) return "warmup";
  if (passRate <= 0.85) return "steady";
  return "stretch";
}
