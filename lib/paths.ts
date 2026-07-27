// The learning path a student is on, and the only place it is read.
//
// This module is deliberately dependency-free: `lib/onboarding.ts` imports it
// with a "./paths.ts" extension so its unit tests still run under bare node, and
// pulling in anything that uses the "@/" alias would break that.

export type LearningPath = "job" | "general";

/**
 * A student's path, defaulting to the general track.
 *
 * The default matters: profiles saved before paths existed have no value, and
 * every existing student must land on "general" rather than being silently
 * conscripted into the job track.
 */
export function pathOf(profile?: { path?: LearningPath } | null): LearningPath {
  return profile?.path ?? "general";
}
