// npx tsx lib/gamification.test.mjs
//
// XP, levels, stars, and — the trickiest — the streak/freeze arithmetic across
// day boundaries, which had no test despite being exactly the kind of date logic
// that regresses silently.
import {
  levelForXp, levelFloor, xpForAttempt, roundRewardXp, starRating, dayKey, applyAttempt, unlock, MAX_FREEZES,
} from "./gamification.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };

// ── levels ──────────────────────────────────────────────────────────────────
eq(levelFloor(1), 0, "level 1 floor is 0 XP");
eq(levelForXp(0), 1, "0 XP is level 1");
eq(levelForXp(39), 1, "39 XP is still level 1 (floor of 2 is 40)");
eq(levelForXp(40), 2, "40 XP reaches level 2");
truthy(levelForXp(1000) > levelForXp(100), "more XP is never a lower level");

// ── xp per attempt + combo ───────────────────────────────────────────────────
eq(xpForAttempt(false, 0), 2, "a miss still earns the consolation 2 XP");
eq(xpForAttempt(true, 1), 10, "a pass with no combo earns base 10");
eq(xpForAttempt(true, 2), 12, "combo 2 adds one step (+2)");
eq(xpForAttempt(true, 999), 10 + 10 * 2, "combo bonus is capped");

// ── scaled reward rounding ───────────────────────────────────────────────────
const quarterXp = [0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3];
for (let baseXp = 0; baseXp <= 11; baseXp++) {
  eq(roundRewardXp(baseXp, 0.25), quarterXp[baseXp], `quarter reward rounds base ${baseXp}`);
}
for (const [baseXp, multiplier, want, label] of [
  [0, 1, 0, "zero base stays zero"],
  [7, 0, 0, "zero multiplier earns nothing"],
  [1, 0.5, 1, "half XP rounds up at one half"],
  [3, 0.5, 2, "half XP rounds up at one and a half"],
  [11, 1, 11, "full reward preserves its base"],
]) {
  eq(roundRewardXp(baseXp, multiplier), want, label);
}
for (const [baseXp, multiplier] of [
  [-1, 0.25],
  [1.5, 0.25],
  [Number.NaN, 0.25],
  [Number.POSITIVE_INFINITY, 0.25],
  [Number.MAX_SAFE_INTEGER + 1, 0.25],
  [10, -0.1],
  [10, 1.1],
  [10, Number.NaN],
  [10, Number.POSITIVE_INFINITY],
]) {
  let rejected = false;
  try { roundRewardXp(baseXp, multiplier); } catch { rejected = true; }
  truthy(rejected, `invalid scaled reward ${baseXp} × ${multiplier} is rejected`);
}

// ── stars ─────────────────────────────────────────────────────────────────
eq(starRating(false, 100), 0, "a miss earns no stars");
eq(starRating(true, 95), 3, "a clean 95 earns 3 stars");
eq(starRating(true, 85), 2, "an 85 earns 2 stars");
eq(starRating(true, 70), 1, "a scraped pass earns 1 star");

// ── streak: first day, consecutive day, gap resets ──────────────────────────
const base = {
  xp: 0, currentStreak: 0, longestStreak: 0, lastActiveDay: null, todayKey: null, todayXp: 0,
  totalAttempts: 0, totalPasses: 0, bestCombo: 0, achievements: [], stars: 0, streakFreezes: 0, freezeUsedDay: null,
};
const d = (s) => new Date(s + "T12:00:00");

const day1 = applyAttempt(base, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-01") });
eq(day1.stats.currentStreak, 1, "first practice day starts a 1-day streak");

const day2 = applyAttempt(day1.stats, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-02") });
eq(day2.stats.currentStreak, 2, "practicing the next day grows the streak");

const skipped = applyAttempt(day2.stats, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-05") });
eq(skipped.stats.currentStreak, 1, "a multi-day gap with no freeze resets the streak");

// ── same-day second attempt does not double-count the streak ────────────────
const sameDay = applyAttempt(day2.stats, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-02") });
eq(sameDay.stats.currentStreak, 2, "a second attempt the same day keeps the streak flat");

// ── a banked freeze covers exactly one missed day ───────────────────────────
const withFreeze = { ...day2.stats, streakFreezes: 1 };
const gapOne = applyAttempt(withFreeze, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-04") });
eq(gapOne.stats.currentStreak, 3, "a one-day gap is bridged by a freeze");
eq(gapOne.stats.streakFreezes, 0, "the freeze is spent");
eq(gapOne.rewards.freezeUsed, true, "the reward reports the freeze use");

// a two-day gap is too long even with a freeze (freeze covers a single day)
const gapTwo = applyAttempt(withFreeze, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-05") });
eq(gapTwo.stats.currentStreak, 1, "a freeze does not bridge a two-day gap");

// ── a 7-day streak banks a freeze, capped at MAX_FREEZES ────────────────────
let s = base, day = new Date("2026-03-01T12:00:00");
for (let i = 0; i < 7; i++) {
  s = applyAttempt(s, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: new Date(day) }).stats;
  day.setDate(day.getDate() + 1);
}
eq(s.currentStreak, 7, "seven consecutive days is a 7-day streak");
eq(s.streakFreezes, 1, "hitting 7 days banks one freeze");
truthy(s.streakFreezes <= MAX_FREEZES, "freezes never exceed the cap");

// ── daily goal crossing is reported exactly once ────────────────────────────
const goal = applyAttempt(base, { passed: true, combo: 5, dailyGoal: 10, score: 100, now: d("2026-01-01") });
eq(goal.rewards.dailyGoalMet, true, "crossing the daily goal is reported");

// ── achievements unlock and don't duplicate ─────────────────────────────────
const firstRep = applyAttempt(base, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-01") });
truthy(firstRep.rewards.unlocked.includes("first_steps"), "the first rep unlocks first_steps");
const secondRep = applyAttempt(firstRep.stats, { passed: true, combo: 1, dailyGoal: 40, score: 90, now: d("2026-01-02") });
truthy(!secondRep.rewards.unlocked.includes("first_steps"), "first_steps does not unlock twice");

// ── unlock() ignores unknown ids and dedupes ────────────────────────────────
const u = unlock({ ...base, achievements: ["combo_5"] }, ["combo_5", "perfect_lesson", "bogus"]);
eq(u.unlocked.length, 1, "only the new, known achievement is added");
eq(u.unlocked[0], "perfect_lesson", "the right achievement is the one added");

// ── dayKey format ───────────────────────────────────────────────────────────
eq(dayKey(new Date(2026, 0, 5)), "2026-01-05", "dayKey zero-pads month and day");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
