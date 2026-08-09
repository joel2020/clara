import type { PlayerStats } from "./db/types";

// The "fun layer": turn attempts into XP, levels, streaks, combos and badges.
// Pure functions over PlayerStats so the rules are easy to reason about and test.

// ── XP & levels ────────────────────────────────────────────────────────────

export const PASS_XP = 10;
export const FAIL_XP = 2; // a little reward for trying keeps momentum
export const COMBO_STEP = 2; // bonus per consecutive pass
export const COMBO_CAP = 10;

/** Apply a bounded reward multiplier using the app's whole-XP rounding rule. */
export function roundRewardXp(baseXp: number, multiplier: number): number {
  if (!Number.isSafeInteger(baseXp) || baseXp < 0) {
    throw new RangeError("baseXp must be a non-negative safe integer");
  }
  if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 1) {
    throw new RangeError("multiplier must be between 0 and 1");
  }
  return Math.round(baseXp * multiplier);
}

/** Total XP required to *reach* a given level (level 1 = 0). */
export function levelFloor(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += 40 + 20 * (l - 1); // 40, 60, 80, …
  return total;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (levelFloor(level + 1) <= xp) level++;
  return level;
}

export interface LevelProgress {
  level: number;
  into: number; // xp earned into the current level
  span: number; // xp needed to clear the current level
  pct: number; // 0–100 toward next level
  toNext: number; // xp remaining to next level
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const base = levelFloor(level);
  const next = levelFloor(level + 1);
  const span = next - base;
  const into = xp - base;
  return { level, into, span, pct: Math.round((into / span) * 100), toNext: next - xp };
}

/** XP for one attempt, with a combo bonus for a hot streak. */
export function xpForAttempt(passed: boolean, combo: number): number {
  if (!passed) return FAIL_XP;
  const bonus = Math.min(Math.max(combo - 1, 0), COMBO_CAP) * COMBO_STEP;
  return PASS_XP + bonus;
}

// ── Stars (the game currency) ────────────────────────────────────────────────

/** Star rating for one attempt: 0 on a miss, else 1–3 by how clean it was. */
export function starRating(passed: boolean, score: number): number {
  if (!passed) return 0;
  if (score >= 92) return 3;
  if (score >= 80) return 2;
  return 1;
}

// ── Days & streaks ─────────────────────────────────────────────────────────

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

/** Whole calendar days between two day keys (toKey later). 1 = consecutive days. */
function dayGap(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Most freezes a learner can bank at once. */
export const MAX_FREEZES = 3;

// ── Achievements ───────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_steps", name: "First words", description: "Record your very first attempt.", icon: "Sparkles" },
  { id: "combo_5", name: "Combo ×5", description: "Get 5 clear in a row.", icon: "Flame" },
  { id: "combo_10", name: "On fire", description: "Get 10 clear in a row.", icon: "Zap" },
  { id: "fifty_clear", name: "Fifty clear", description: "Say 50 words clearly.", icon: "Target" },
  { id: "hundred_clear", name: "Century", description: "Say 100 words clearly.", icon: "Medal" },
  { id: "streak_3", name: "Three days", description: "Practice 3 days in a row.", icon: "CalendarCheck" },
  { id: "streak_7", name: "Week warrior", description: "Practice 7 days in a row.", icon: "Trophy" },
  { id: "streak_30", name: "Unstoppable", description: "Practice 30 days in a row.", icon: "Crown" },
  { id: "level_5", name: "Level 5", description: "Reach level 5.", icon: "Star" },
  { id: "level_10", name: "Level 10", description: "Reach level 10.", icon: "Rocket" },
  { id: "perfect_lesson", name: "Flawless", description: "Finish a lesson with every word clear.", icon: "BadgeCheck" },
  { id: "sound_master", name: "Sound master", description: "Master every word in a sound.", icon: "Gem" },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

/** Achievements unlockable purely from PlayerStats (the rest fire on events). */
function statAchievements(stats: PlayerStats): string[] {
  const out: string[] = [];
  const level = levelForXp(stats.xp);
  if (stats.totalAttempts >= 1) out.push("first_steps");
  if (stats.bestCombo >= 5) out.push("combo_5");
  if (stats.bestCombo >= 10) out.push("combo_10");
  if (stats.totalPasses >= 50) out.push("fifty_clear");
  if (stats.totalPasses >= 100) out.push("hundred_clear");
  if (stats.currentStreak >= 3) out.push("streak_3");
  if (stats.currentStreak >= 7) out.push("streak_7");
  if (stats.currentStreak >= 30) out.push("streak_30");
  if (level >= 5) out.push("level_5");
  if (level >= 10) out.push("level_10");
  return out;
}

// ── The award pipeline ─────────────────────────────────────────────────────

export interface AttemptRewards {
  xpGain: number;
  newXp: number;
  leveledUp: boolean;
  oldLevel: number;
  newLevel: number;
  combo: number;
  starsEarned: number; // stars won on this attempt (0–3)
  starTotal: number; // running star balance after this attempt
  streakIncreased: boolean;
  currentStreak: number;
  freezeUsed: boolean; // a missed day was covered by a banked freeze
  freezeEarned: boolean; // a new freeze was just banked (streak milestone)
  dailyGoalMet: boolean; // crossed the goal on this attempt
  unlocked: string[]; // newly unlocked achievement ids
}

/**
 * Apply one attempt to the player's stats. `combo` is the count of consecutive
 * passes in the current session including this one (0 if this attempt failed).
 */
export function applyAttempt(
  prev: PlayerStats,
  opts: { passed: boolean; combo: number; dailyGoal: number; score?: number; now?: Date },
): { stats: PlayerStats; rewards: AttemptRewards } {
  const now = opts.now ?? new Date();
  const today = dayKey(now);
  const xpGain = xpForAttempt(opts.passed, opts.combo);
  const starsEarned = starRating(opts.passed, opts.score ?? (opts.passed ? 80 : 0));
  const starTotal = (prev.stars ?? 0) + starsEarned;
  const oldLevel = levelForXp(prev.xp);

  // Streak / daily bookkeeping.
  let currentStreak = prev.currentStreak;
  let longestStreak = prev.longestStreak;
  let streakIncreased = false;
  let todayKey = prev.todayKey;
  let todayXp = prev.todayXp;
  let streakFreezes = prev.streakFreezes ?? 0;
  let freezeUsedDay = prev.freezeUsedDay ?? null;
  let freezeUsed = false;
  let freezeEarned = false;

  if (prev.lastActiveDay !== today) {
    if (!prev.lastActiveDay) {
      currentStreak = 1;
    } else if (previousDayKey(today) === prev.lastActiveDay) {
      currentStreak = prev.currentStreak + 1; // practiced yesterday — streak grows
    } else if (dayGap(prev.lastActiveDay, today) === 2 && streakFreezes > 0) {
      // Missed exactly one day, but a banked freeze covers it — streak survives.
      streakFreezes -= 1;
      freezeUsedDay = today;
      freezeUsed = true;
      currentStreak = prev.currentStreak + 1;
    } else {
      currentStreak = 1; // missed too long (or no freeze) — start over
    }
    streakIncreased = prev.lastActiveDay === null || currentStreak > prev.currentStreak;
    longestStreak = Math.max(longestStreak, currentStreak);
    // Bank a freeze on each new 7-day milestone, up to the cap.
    if (streakIncreased && currentStreak % 7 === 0 && streakFreezes < MAX_FREEZES) {
      streakFreezes += 1;
      freezeEarned = true;
    }
  }
  if (todayKey !== today) {
    todayKey = today;
    todayXp = 0;
  }

  const todayXpBefore = todayKey === prev.todayKey ? prev.todayXp : 0;
  todayXp = todayXpBefore + xpGain;

  const newXp = prev.xp + xpGain;
  const bestCombo = Math.max(prev.bestCombo, opts.combo);

  const next: PlayerStats = {
    ...prev,
    xp: newXp,
    currentStreak,
    longestStreak,
    lastActiveDay: today,
    todayKey,
    todayXp,
    totalAttempts: prev.totalAttempts + 1,
    totalPasses: prev.totalPasses + (opts.passed ? 1 : 0),
    bestCombo,
    stars: starTotal,
    streakFreezes,
    freezeUsedDay,
    updatedAt: now.getTime(),
  };

  const unlocked = statAchievements(next).filter((id) => !prev.achievements.includes(id));
  next.achievements = [...prev.achievements, ...unlocked];

  const newLevel = levelForXp(newXp);

  return {
    stats: next,
    rewards: {
      xpGain,
      newXp,
      leveledUp: newLevel > oldLevel,
      oldLevel,
      newLevel,
      combo: opts.combo,
      starsEarned,
      starTotal,
      streakIncreased,
      currentStreak,
      freezeUsed,
      freezeEarned,
      dailyGoalMet: todayXpBefore < opts.dailyGoal && todayXp >= opts.dailyGoal,
      unlocked,
    },
  };
}

/** Unlock event-based achievements (perfect lesson, sound mastered). Returns the newly added ids. */
export function unlock(stats: PlayerStats, ids: string[]): { stats: PlayerStats; unlocked: string[] } {
  const fresh = ids.filter((id) => ACHIEVEMENT_BY_ID.has(id) && !stats.achievements.includes(id));
  if (!fresh.length) return { stats, unlocked: [] };
  return { stats: { ...stats, achievements: [...stats.achievements, ...fresh] }, unlocked: fresh };
}
