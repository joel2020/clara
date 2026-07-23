// Adaptive placement — the brain of onboarding. It runs a short, adaptive
// English check (harder after a right answer, easier after a wrong one),
// estimates ability per skill, and maps that to a CEFR-style level with a
// transparent, inspectable scoring model (no black box). Pure functions only,
// so it's fully unit-testable and carries no UI or network concerns.

export const LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;
export type Level = (typeof LEVELS)[number];

export const SKILLS = ["listening", "vocabulary", "grammar", "reading", "speaking"] as const;
export type Skill = (typeof SKILLS)[number];

// Difficulty is an integer 0..5 that lines up 1:1 with LEVELS (0=A0 … 5=C1), so
// "a B1 question" is difficulty 3. Keeping them aligned makes scoring legible.
export const MAX_DIFFICULTY = LEVELS.length - 1;

export function levelIndex(l: Level): number {
  return LEVELS.indexOf(l);
}
export function difficultyToLevel(d: number): Level {
  return LEVELS[clamp(Math.round(d), 0, MAX_DIFFICULTY)];
}
export function levelToDifficulty(l: Level): number {
  return levelIndex(l);
}
/** One level down, floored at A0 — used for "start lower to rebuild confidence". */
export function levelDown(l: Level): Level {
  return LEVELS[Math.max(0, levelIndex(l) - 1)];
}
export function levelUp(l: Level): Level {
  return LEVELS[Math.min(MAX_DIFFICULTY, levelIndex(l) + 1)];
}
/** <0 if a is lower than b. */
export function compareLevel(a: Level, b: Level): number {
  return levelIndex(a) - levelIndex(b);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ── Adaptive controller ──────────────────────────────────────────────────────

/** A learner's self-assessment, used only to seed the starting difficulty. */
export type SelfLevel = "zero" | "basics" | "understandMore" | "converse";

const SELF_START: Record<SelfLevel, number> = {
  zero: 0, // start at A0
  basics: 1, // A1
  understandMore: 2, // A2 — they under-report speaking, so probe a touch higher
  converse: 3, // B1
};

/** Where the first question sits given the self-assessment (defaults to A1). */
export function startDifficulty(self?: SelfLevel): number {
  return self ? SELF_START[self] : 1;
}

export interface AnswerRecord {
  skill: Skill;
  difficulty: number; // the difficulty of the question that was asked
  /** For graded items (e.g. a spoken answer) pass a 0..1 score; boolean maps to 0/1. */
  correct: boolean;
  /** Optional finer-grained score 0..1 (speaking uses this from the assessor). */
  score?: number;
}

function credit(a: AnswerRecord): number {
  if (typeof a.score === "number") return clamp(a.score, 0, 1);
  return a.correct ? 1 : 0;
}

/**
 * Next question's difficulty: step up after a strong answer, down after a weak
 * one, bounded to the ladder. Half-credit (0.4–0.7) holds difficulty steady so
 * we linger where the learner is borderline and get a cleaner estimate.
 */
export function nextDifficulty(current: number, last: AnswerRecord): number {
  const c = credit(last);
  const step = c >= 0.7 ? 1 : c <= 0.4 ? -1 : 0;
  return clamp(current + step, 0, MAX_DIFFICULTY);
}

/** Stop once we've asked enough and the estimate has settled (or hit the cap). */
export function shouldContinue(answers: AnswerRecord[], opts?: { min?: number; max?: number }): boolean {
  const min = opts?.min ?? 8;
  const max = opts?.max ?? 14;
  if (answers.length < min) return true;
  if (answers.length >= max) return false;
  // Converged if the last 4 difficulties span at most one rung.
  const recent = answers.slice(-4).map((a) => a.difficulty);
  const spread = Math.max(...recent) - Math.min(...recent);
  return spread > 1;
}

// ── Scoring ──────────────────────────────────────────────────────────────────

export interface PlacementResult {
  level: Level;
  /** 0..100 overall, for display and progress tracking. */
  overall: number;
  /** Ability per skill as a CEFR-aligned number 0..5 (A0..C1). */
  subscores: Record<Skill, number>;
  /** Skills at/above the assigned level. */
  strengths: Skill[];
  /** Skills a rung or more below the assigned level — what to work on first. */
  improve: Skill[];
}

/**
 * Ability per skill = the highest difficulty the learner handled well, weighted
 * by how much credit they earned there. Concretely: a credit-weighted average of
 * (difficulty + (credit - 0.5)) across that skill's answers, so nailing hard
 * items pulls the estimate up and missing easy ones pulls it down. Transparent
 * and monotonic — more correct hard answers can only raise the score.
 */
export function skillAbility(answers: AnswerRecord[]): number {
  if (!answers.length) return 0;
  let wsum = 0;
  let w = 0;
  for (const a of answers) {
    const c = credit(a);
    // weight harder questions more — they carry more signal about a ceiling.
    const weight = 1 + a.difficulty * 0.5;
    wsum += weight * (a.difficulty + (c - 0.5) * 2);
    w += weight;
  }
  return clamp(w ? wsum / w : 0, 0, MAX_DIFFICULTY);
}

export function scorePlacement(answers: AnswerRecord[]): PlacementResult {
  const subscores = {} as Record<Skill, number>;
  for (const skill of SKILLS) {
    const forSkill = answers.filter((a) => a.skill === skill);
    subscores[skill] = forSkill.length ? round1(skillAbility(forSkill)) : 0;
  }
  // Overall ability = mean of the skills that were actually tested.
  const tested = SKILLS.filter((s) => answers.some((a) => a.skill === s));
  const meanAbility = tested.length ? tested.reduce((n, s) => n + subscores[s], 0) / tested.length : 0;
  const level = difficultyToLevel(meanAbility);
  const at = levelIndex(level);

  const strengths = tested.filter((s) => subscores[s] >= at);
  const improve = tested.filter((s) => subscores[s] <= at - 1);

  return {
    level,
    overall: Math.round((meanAbility / MAX_DIFFICULTY) * 100),
    subscores,
    strengths,
    improve,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
