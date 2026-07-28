// How a high-stakes open answer's grade is decided (audit P1).
//
// Two failure families used to collapse into a hard zero or a keyword bag,
// and both corrupted what an "earned level" means:
//   • The retell was scored client-side by order-independent substring
//     matching — six keywords in any ungrammatical order scored 100.
//   • A grader outage recorded 0 for the section and burned the daily
//     attempt — punishing the honest learner for our infrastructure.
//
// The rules, executable and testable:
//   • A capture failure (silent mic, no speech) is a ZERO — an exam cannot be
//     dodged by staying quiet. That path is decided before this module.
//   • A real transcript is graded by the CEFR-aware model, or not at all.
//     There is no mechanical fallback for unscripted speech: if the grader is
//     unreachable or returns nonsense, the sitting is VOID — nothing recorded,
//     the daily attempt is not consumed, and the learner is told plainly.
export type OpenGrade =
  | { kind: "scored"; score: number; fix: string | null }
  | { kind: "unavailable"; reason: string };

/** How many times the client re-asks the grader before voiding the sitting. */
export const GRADER_RETRIES = 1;

/**
 * Interpret one /api/grade response. Anything that is not an unambiguous
 * numeric grade is "unavailable" — never a zero, never a guess.
 */
export function interpretGraderResponse(status: number, body: unknown): OpenGrade {
  if (status !== 200) return { kind: "unavailable", reason: `status ${status}` };
  if (typeof body !== "object" || body === null) return { kind: "unavailable", reason: "malformed body" };
  const score = (body as { score?: unknown }).score;
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return { kind: "unavailable", reason: "no numeric score" };
  }
  const fixRaw = (body as { fix?: unknown }).fix;
  const fix = typeof fixRaw === "string" && fixRaw.trim() ? fixRaw.trim() : null;
  return { kind: "scored", score: Math.max(0, Math.min(100, Math.round(score))), fix };
}

/**
 * Which machinery produced a section's scores — stored with the sitting so a
 * disputed result can be audited ("was this graded acoustically or by ASR
 * transcript?").
 */
export type GradePath = "llm" | "azure" | "transcript" | "mechanical";

/** Fold per-item paths into one label per section for storage. */
export function foldGradePaths(paths: Record<string, GradePath[]>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(paths).map(([k, list]) => [k, [...new Set(list)].join("+") || "none"]),
  );
}
