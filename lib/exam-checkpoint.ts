import type { ExamCheckpoint, ExamCheckpointIdentity } from "./db/types";

const LEVELS = new Set(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
const SECTIONS = new Set(["readAloud", "repeat", "build", "shortAnswer", "retell", "openResponse"]);
const PATHS = new Set(["azure", "llm", "mechanical"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HASH = /^[a-f0-9]{16}$/;
const SAFE = /^[a-z0-9][a-z0-9:._/-]*$/i;

function boundedText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= max;
}

export function sameExamCheckpointIdentity(checkpoint: ExamCheckpoint, expected: ExamCheckpointIdentity): boolean {
  return checkpoint.day === expected.day
    && checkpoint.sourceLevel === expected.sourceLevel
    && checkpoint.candidateLevel === expected.candidateLevel
    && checkpoint.seed === expected.seed
    && checkpoint.contentVersion === expected.contentVersion
    && checkpoint.contentHash === expected.contentHash;
}

/** Deep allowlist for durable stage-exam state. */
export function sanitizeExamCheckpoint(value: unknown): ExamCheckpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const c = value as Partial<ExamCheckpoint>;
  if (c.id !== "active" || c.version !== 1 || !Number.isSafeInteger(c.sequence) || (c.sequence ?? -1) < 0 || !boundedText(c.sessionId, 128) || !SAFE.test(c.sessionId)) return null;
  if (!boundedText(c.profileId, 128) || !DAY.test(c.day ?? "") || !Number.isSafeInteger(c.startedAt) || (c.startedAt ?? 0) <= 0) return null;
  if (!LEVELS.has(c.sourceLevel ?? "") || !LEVELS.has(c.candidateLevel ?? "")) return null;
  if (!boundedText(c.seed, 128) || !boundedText(c.contentVersion, 64) || !HASH.test(c.contentHash ?? "")) return null;
  if (c.status !== "running" && c.status !== "pending-advance" && c.status !== "practice-required") return null;
  if (!Number.isInteger(c.sectionIdx) || c.sectionIdx! < 0 || c.sectionIdx! > 5 || !Number.isInteger(c.itemIdx) || c.itemIdx! < 0 || c.itemIdx! > 15) return null;
  if (!c.scores || typeof c.scores !== "object" || Array.isArray(c.scores) || !c.gradePaths || typeof c.gradePaths !== "object" || Array.isArray(c.gradePaths)) return null;
  const scores: Record<string, number[]> = {};
  const gradePaths: Record<string, string[]> = {};
  for (const [key, entries] of Object.entries(c.scores)) {
    if (!SECTIONS.has(key) || !Array.isArray(entries) || entries.length > 16 || entries.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 100)) return null;
    scores[key] = [...entries];
  }
  for (const [key, entries] of Object.entries(c.gradePaths)) {
    if (!SECTIONS.has(key) || !Array.isArray(entries) || entries.length > 16 || entries.some((p) => typeof p !== "string" || !PATHS.has(p))) return null;
    gradePaths[key] = [...entries];
  }
  const speaking = c.speaking;
  if (!speaking || !["ready", "retry", "mastered", "practice-required"].includes(speaking.status)
    || !Number.isInteger(speaking.learnerMisses) || speaking.learnerMisses < 0 || speaking.learnerMisses > 3
    || !Number.isInteger(speaking.validAcousticAttempts) || speaking.validAcousticAttempts < 0 || speaking.validAcousticAttempts > 3) return null;
  let focus: ExamCheckpoint["focus"];
  if (c.focus !== undefined) {
    if (!c.focus || !boundedText(c.focus.itemId, 128) || !SAFE.test(c.focus.itemId)
      || !boundedText(c.focus.itemText, 256)
      || !boundedText(c.focus.feature, 64) || !SAFE.test(c.focus.feature)
      || !boundedText(c.focus.lessonId, 128) || !SAFE.test(c.focus.lessonId)
      || !boundedText(c.focus.mouthHint, 240)) return null;
    focus = { ...c.focus };
  }
  if (c.status === "practice-required" && !focus) return null;
  let pendingAdvance: ExamCheckpoint["pendingAdvance"];
  if (c.pendingAdvance !== undefined) {
    const p = c.pendingAdvance;
    if (!p || !Number.isInteger(p.completedSectionIdx) || p.completedSectionIdx < 0 || p.completedSectionIdx > 5
      || !Number.isInteger(p.completedItemIdx) || p.completedItemIdx < 0 || p.completedItemIdx > 15
      || (p.nextSectionIdx !== null && (!Number.isInteger(p.nextSectionIdx) || p.nextSectionIdx < 0 || p.nextSectionIdx > 5))
      || (p.nextItemIdx !== null && (!Number.isInteger(p.nextItemIdx) || p.nextItemIdx < 0 || p.nextItemIdx > 15))
      || (p.feedback !== null && (typeof p.feedback !== "string" || p.feedback.length > 512))
      || !Number.isInteger(p.delayMs) || p.delayMs < 0 || p.delayMs > 5000) return null;
    pendingAdvance = { ...p };
  }
  if ((c.status === "pending-advance") !== Boolean(pendingAdvance)) return null;
  return { ...c as ExamCheckpoint, scores, gradePaths, speaking: { ...speaking }, ...(focus ? { focus } : {}), ...(pendingAdvance ? { pendingAdvance } : {}) };
}

export class ExamCheckpointConflictError extends Error {
  constructor() { super("Stage exam checkpoint CAS conflict"); this.name = "ExamCheckpointConflictError"; }
}
