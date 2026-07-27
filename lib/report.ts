import type { Attempt, CallScore, ExamAttempt, ItemProgress } from "@/lib/db/types";
import { isMastered } from "@/lib/srs";

// The recruiter-facing report.
//
// This is the one artefact that leaves the app, so every number on it has to be
// something we actually measured. Notably absent: hours studied. Clara does not
// time sessions, and inventing an hours figure on an otherwise honest document
// would poison the whole thing.
//
// The band shown is the highest level she has PASSED an exam at — never her
// current provisional level. A document that overstates her English would hurt her
// in the interview it was meant to win.

export interface Report {
  /** Highest band with a passed sitting, or null if she has not passed one. */
  band: string | null;
  /** Score of that passing sitting. */
  examScore: number | null;
  /** Date of that sitting, epoch ms. */
  passedAt: number | null;
  phrasesMastered: number;
  practiceSessions: number;
  activeDays: number;
  accuracy: number;
  callsCompleted: number;
  /** Mean call score, when she has run any. */
  callAverage: number | null;
  /** Stable short id so a specific document can be identified. */
  id: string;
  /** False until an exam has been passed — nothing should be shown before that. */
  ready: boolean;
}

export interface ReportInput {
  attempts: Attempt[];
  progress: ItemProgress[];
  exams: ExamAttempt[];
  calls: CallScore[];
  /** Used only to derive the document id, never printed raw. */
  profileId?: string | null;
}

const LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];

function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Short, stable, non-identifying document id. */
function documentId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hex = (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function buildReport(input: ReportInput): Report {
  const { attempts, progress, exams, calls } = input;

  // The band she has actually demonstrated: the highest level among PASSED
  // sittings, promoted by one because a sitting at B1 certifies B2.
  const passed = exams.filter((e) => e.passed);
  let best: ExamAttempt | null = null;
  for (const e of passed) {
    if (!best || LEVEL_ORDER.indexOf(e.level) > LEVEL_ORDER.indexOf(best.level)) best = e;
  }
  const bandIndex = best ? Math.min(LEVEL_ORDER.length - 1, LEVEL_ORDER.indexOf(best.level) + 1) : -1;

  const passes = attempts.filter((a) => a.passed).length;
  const callScores = calls.map((c) => c.score);

  return {
    band: bandIndex >= 0 ? LEVEL_ORDER[bandIndex] : null,
    examScore: best ? best.score : null,
    passedAt: best ? best.at : null,
    phrasesMastered: progress.filter(isMastered).length,
    practiceSessions: attempts.length,
    activeDays: new Set(attempts.map((a) => dayOf(a.at))).size,
    accuracy: attempts.length ? Math.round((passes / attempts.length) * 100) : 0,
    callsCompleted: calls.length,
    callAverage: callScores.length
      ? Math.round(callScores.reduce((a, b) => a + b, 0) / callScores.length)
      : null,
    id: documentId(`${input.profileId ?? "local"}:${best?.at ?? 0}`),
    ready: Boolean(best),
  };
}
