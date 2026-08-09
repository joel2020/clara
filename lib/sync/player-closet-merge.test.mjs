// npx tsx lib/sync/player-closet-merge.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mergePlayerClosetProgress } from "./player-closet-merge.ts";

const stats = (overrides = {}) => ({
  id: "player",
  xp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDay: null,
  todayKey: null,
  todayXp: 0,
  totalAttempts: 0,
  totalPasses: 0,
  bestCombo: 0,
  achievements: [],
  completedDailySessions: 0,
  unlockedMilestones: [],
  stars: 0,
  ownedCosmetics: [],
  equippedBg: "bg-default",
  equippedAccessory: "acc-none",
  equippedEffect: "fx-none",
  lastChestDay: null,
  streakFreezes: 0,
  freezeUsedDay: null,
  updatedAt: 0,
  ...overrides,
});

test("cloud refresh keeps the maximum lifetime count and unions milestone ids", () => {
  const local = stats({
    completedDailySessions: 9,
    unlockedMilestones: ["first-passed-interview-call"],
    stars: 20,
    updatedAt: 100,
  });
  const cloud = stats({
    completedDailySessions: 7,
    unlockedMilestones: ["future-milestone"],
    stars: 40,
    updatedAt: 200,
  });

  const merged = mergePlayerClosetProgress(local, cloud);
  assert.equal(merged.completedDailySessions, 9);
  assert.deepEqual(merged.unlockedMilestones, ["first-passed-interview-call", "future-milestone"]);
  assert.equal(merged.stars, 40, "the otherwise newer cloud row remains authoritative");
  assert.equal(merged.updatedAt, 200);
});

test("legacy rows default to zero completed sessions and no milestones", () => {
  const merged = mergePlayerClosetProgress(
    stats({ completedDailySessions: undefined, unlockedMilestones: undefined, updatedAt: 2 }),
    stats({ completedDailySessions: undefined, unlockedMilestones: undefined, updatedAt: 1 }),
  );
  assert.equal(merged.completedDailySessions, 0);
  assert.deepEqual(merged.unlockedMilestones, []);
});
