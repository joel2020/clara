// Run: node lib/placement.test.mjs   (Node strips the TS types)
import {
  LEVELS, SKILLS, difficultyToLevel, levelDown, levelUp, compareLevel,
  startDifficulty, nextDifficulty, shouldContinue, skillAbility, scorePlacement,
} from "./placement.ts";
import { bandFor, firstWeekPlan, levelLessonPool } from "./onboarding.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "\n  got ", JSON.stringify(a), "\n  want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };

// ── level math ──
eq(difficultyToLevel(0), "A0", "d0->A0");
eq(difficultyToLevel(3), "B1", "d3->B1");
eq(difficultyToLevel(9), "C2", "clamp high");
eq(difficultyToLevel(-2), "A0", "clamp low");
eq(levelDown("A0"), "A0", "down floors at A0");
eq(levelDown("B1"), "A2", "B1 down -> A2");
eq(levelUp("C1"), "C2", "C1 up -> C2");
eq(levelUp("C2"), "C2", "up ceils at C2");
truthy(compareLevel("A1", "B1") < 0, "A1 < B1");

// ── adaptive controller ──
eq(startDifficulty("zero"), 0, "zero starts A0");
eq(startDifficulty("converse"), 3, "converse starts B1");
eq(startDifficulty(), 1, "default A1");
eq(nextDifficulty(2, { skill: "grammar", difficulty: 2, correct: true }), 3, "correct steps up");
eq(nextDifficulty(2, { skill: "grammar", difficulty: 2, correct: false }), 1, "wrong steps down");
eq(nextDifficulty(5, { skill: "grammar", difficulty: 5, correct: true }), 6, "C1 correct steps up to C2");
eq(nextDifficulty(6, { skill: "grammar", difficulty: 6, correct: true }), 6, "up bounded at C2");
eq(nextDifficulty(0, { skill: "grammar", difficulty: 0, correct: false }), 0, "down bounded at A0");
eq(nextDifficulty(3, { skill: "speaking", difficulty: 3, correct: true, score: 0.5 }), 3, "half-credit holds");

// stop rules
eq(shouldContinue(Array(3).fill({ skill: "grammar", difficulty: 2, correct: true })), true, "under min -> continue");
eq(shouldContinue(Array(14).fill({ skill: "grammar", difficulty: 2, correct: true })), false, "at max -> stop");
const converged = Array(10).fill(0).map((_, i) => ({ skill: "grammar", difficulty: 2 + (i % 2), correct: true }));
eq(shouldContinue(converged), false, "converged (spread<=1) -> stop");

// ── scoring ──
// A learner who nails everything through B1 (d3) and misses B2 (d4).
const strong = [
  { skill: "listening", difficulty: 1, correct: true },
  { skill: "vocabulary", difficulty: 2, correct: true },
  { skill: "grammar", difficulty: 3, correct: true },
  { skill: "reading", difficulty: 3, correct: true },
  { skill: "grammar", difficulty: 4, correct: false },
  { skill: "speaking", difficulty: 3, correct: true, score: 0.8 },
];
const r1 = scorePlacement(strong);
truthy(["A2", "B1"].includes(r1.level), `strong learner lands A2/B1 (got ${r1.level})`);
truthy(r1.overall > 40 && r1.overall <= 100, "overall in range");
truthy(SKILLS.every((s) => s in r1.subscores), "all skills have a subscore");

// A total beginner (misses even easy items) -> A0/A1.
const beginner = [
  { skill: "listening", difficulty: 1, correct: false },
  { skill: "vocabulary", difficulty: 0, correct: true },
  { skill: "grammar", difficulty: 1, correct: false },
  { skill: "reading", difficulty: 0, correct: true },
  { skill: "speaking", difficulty: 1, correct: false, score: 0.2 },
];
const r2 = scorePlacement(beginner);
truthy(["A0", "A1"].includes(r2.level), `beginner lands A0/A1 (got ${r2.level})`);
truthy(compareLevel(r2.level, r1.level) < 0, "beginner strictly below strong learner");

// monotonicity: more correct hard answers can only raise ability
const base = [{ skill: "grammar", difficulty: 3, correct: true }];
truthy(skillAbility([...base, { skill: "grammar", difficulty: 4, correct: true }]) >= skillAbility(base), "harder correct raises ability");

// ── plans differ by level (success criterion) ──
eq(bandFor("A0"), "beginner", "A0 -> beginner band");
eq(bandFor("A2"), "everyday", "A2 -> everyday band");
eq(bandFor("B1"), "conversational", "B1 -> conversational band");
eq(bandFor("B2"), "advanced", "B2 -> advanced band");
eq(bandFor("C1"), "mastery", "C1 -> mastery band");
eq(bandFor("C2"), "mastery", "C2 -> mastery band");

const planBeginner = firstWeekPlan("A1", "travel");
const planB1 = firstWeekPlan("B1", "travel");
eq(planBeginner.length, 7, "week has 7 days");
eq(planB1.length, 7, "week has 7 days (B1)");
truthy(
  JSON.stringify(planBeginner.map((d) => d.focus)) !== JSON.stringify(planB1.map((d) => d.focus)),
  "beginner and B1 first weeks are meaningfully different",
);
// goal personalization: a travel learner at B1 gets the travel unit pulled early
truthy(planB1.slice(0, 3).some((d) => d.focus === "conv-travel"), "travel goal surfaces conv-travel early at B1");

// level-adaptive lesson pool: beginner vs B1 diverge
const poolA1 = levelLessonPool("A1");
const poolB1 = levelLessonPool("B1");
truthy(poolA1.includes("conv-greetings"), "A1 pool has survival greetings");
truthy(poolB1.includes("conv-work"), "B1 pool has work/opinions");
truthy(!poolA1.includes("conv-work"), "A1 pool does NOT jump to work");
truthy(JSON.stringify(poolA1) !== JSON.stringify(poolB1), "A1 and B1 pools differ");
eq(poolA1.length, new Set(poolA1).size, "pool is de-duped");

// mastery band (C1/C2) surfaces the new C1-C2 units
const poolC1 = levelLessonPool("C1");
truthy(poolC1.includes("conv-idioms"), "C1 pool has mastery idioms");
truthy(poolC1.includes("conv-humor"), "C1 pool has mastery humor");
truthy(!poolA1.includes("conv-idioms"), "A1 pool does NOT jump to mastery idioms");

console.log(`\n${ok} ok, ${fail} fail`);
if (fail) process.exit(1);
