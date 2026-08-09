// node lib/daily-session-reward.test.mjs
//
// Session completion is a persisted one-time transition. A technical skip may
// finish the flow, but it is not a scored attempt and must not manufacture
// learning evidence.
import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_SESSION_REWARD_STARS,
  DAILY_SESSION_REWARD_XP,
  applySessionCompletion,
} from "./daily-session-reward.ts";

const player = (overrides = {}) => ({
  id: "player",
  xp: 100,
  currentStreak: 4,
  longestStreak: 6,
  lastActiveDay: "2026-07-28",
  todayKey: "2026-07-29",
  todayXp: 12,
  totalAttempts: 20,
  totalPasses: 15,
  bestCombo: 5,
  achievements: [],
  completedDailySessions: 0,
  unlockedMilestones: [],
  stars: 8,
  ownedCosmetics: [],
  equippedBg: "bg-default",
  equippedAccessory: "acc-none",
  equippedEffect: "fx-none",
  equippedPet: "pet-none",
  lastChestDay: null,
  streakFreezes: 0,
  freezeUsedDay: null,
  updatedAt: 100,
  ...overrides,
});

const activity = (id, status) => ({
  id,
  kind: id,
  title: { es: id, en: id },
  targetIds: [],
  sourceId: id,
  reason: "transfer",
  estimatedMinutes: 1,
  status,
  ...(status === "completed" ? { completedAt: 200 } : {}),
});

const session = (overrides = {}) => ({
  id: "daily:user-a:2026-07-29",
  version: 1,
  profileId: "user-a",
  day: "2026-07-29",
  objective: { es: "Objetivo", en: "Objective" },
  outcome: { es: "Resultado", en: "Outcome" },
  assistance: "spanish-full",
  activities: [
    activity("speak", "completed"),
    activity("reflect", "technical-skip"),
  ],
  currentActivityId: null,
  rewardClaimed: false,
  startedAt: 150,
  completedAt: 200,
  createdAt: 100,
  updatedAt: 200,
  ...overrides,
});

test("completion reward is idempotent", () => {
  const first = applySessionCompletion(player(), session());
  const second = applySessionCompletion(first.player, first.session);

  assert.deepEqual(first.reward, {
    xp: DAILY_SESSION_REWARD_XP,
    stars: DAILY_SESSION_REWARD_STARS,
  });
  assert.equal(first.session.rewardClaimed, true);
  assert.equal(first.player.completedDailySessions, 1);
  assert.deepEqual(second.reward, { xp: 0, stars: 0 });
  assert.equal(second.player.xp, first.player.xp);
  assert.equal(second.player.stars, first.player.stars);
  assert.equal(second.player.completedDailySessions, 1);
});

test("technical skips can finish the flow without creating learning evidence", () => {
  const before = player();
  const result = applySessionCompletion(before, session());

  assert.equal(result.player.totalAttempts, before.totalAttempts);
  assert.equal(result.player.totalPasses, before.totalPasses);
  assert.equal(result.player.currentStreak, before.currentStreak);
  assert.equal(result.player.xp, before.xp + DAILY_SESSION_REWARD_XP);
  assert.equal(result.player.stars, before.stars + DAILY_SESSION_REWARD_STARS);
});

test("an unfinished session cannot claim a reward", () => {
  const beforePlayer = player();
  const beforeSession = session({
    activities: [activity("speak", "completed"), activity("reflect", "pending")],
    currentActivityId: "reflect",
    completedAt: null,
  });
  const result = applySessionCompletion(beforePlayer, beforeSession);

  assert.deepEqual(result.reward, { xp: 0, stars: 0 });
  assert.equal(result.player, beforePlayer);
  assert.equal(result.session, beforeSession);
});

test("an empty persisted session cannot claim a reward", () => {
  const beforePlayer = player();
  const beforeSession = session({ activities: [] });
  const result = applySessionCompletion(beforePlayer, beforeSession);

  assert.deepEqual(result.reward, { xp: 0, stars: 0 });
  assert.equal(result.player, beforePlayer);
  assert.equal(result.session, beforeSession);
});

test("persisted rewardClaimed state prevents a reward after reload", () => {
  const beforePlayer = player({ xp: 120, stars: 13 });
  const beforeSession = session({ rewardClaimed: true });
  const result = applySessionCompletion(beforePlayer, beforeSession);

  assert.deepEqual(result.reward, { xp: 0, stars: 0 });
  assert.equal(result.player, beforePlayer);
  assert.equal(result.session, beforeSession);
});

test("claiming an older session rolls stale daily accounting to today", () => {
  const result = applySessionCompletion(
    player({ todayKey: "2026-07-29", todayXp: 12 }),
    session(),
    "2026-07-30",
  );

  assert.equal(result.player.xp, 100 + DAILY_SESSION_REWARD_XP);
  assert.equal(result.player.todayKey, "2026-07-30");
  assert.equal(result.player.todayXp, 0);
  assert.equal(result.player.completedDailySessions, 1);
});

test("completed session count is lifetime progress and never resets across missed days", () => {
  const result = applySessionCompletion(
    player({ completedDailySessions: 6, lastActiveDay: "2026-07-20" }),
    session({ day: "2026-07-29" }),
    "2026-08-03",
  );

  assert.equal(result.player.completedDailySessions, 7);
});
