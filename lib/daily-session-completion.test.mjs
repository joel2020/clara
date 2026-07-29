// node lib/daily-session-completion.test.mjs
//
// Completion is a two-row commit: the claim guard and player reward must become
// durable together, based on the player row current inside that transaction.
import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://clara.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
globalThis.window = globalThis;
globalThis.fetch = async () => new Response("[]", {
  status: 200,
  headers: { "content-type": "application/json" },
});

import {
  claimSessionCompletion,
  saveDailySession,
} from "./daily-session-store.ts";
import { DAILY_SESSION_REWARD_XP } from "./daily-session-reward.ts";
import { bindLocalDb, db } from "./db/dexie.ts";
import { DEFAULT_PLAYER } from "./db/repository.ts";

const activity = (id, status = "completed") => ({
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

const session = (day = "2026-07-29") => ({
  id: `daily:reward-user:${day}`,
  version: 1,
  profileId: "reward-user",
  day,
  objective: { es: "Objetivo", en: "Objective" },
  outcome: { es: "Resultado", en: "Outcome" },
  assistance: "spanish-full",
  activities: [activity("speak"), activity("reflect", "technical-skip")],
  currentActivityId: null,
  rewardClaimed: false,
  startedAt: 100,
  completedAt: 200,
  createdAt: 50,
  updatedAt: 200,
});

const player = (overrides = {}) => ({
  ...DEFAULT_PLAYER,
  xp: 100,
  stars: 8,
  todayKey: "2026-07-29",
  todayXp: 12,
  updatedAt: 100,
  ...overrides,
});

test.beforeEach(async () => {
  await bindLocalDb("reward-user");
  await db.transaction("rw", [db.dailySessions, db.player, db.settings], async () => {
    await db.dailySessions.clear();
    await db.player.clear();
    await db.settings.clear();
    await db.player.put(player());
  });
});

test("two concurrent claimers award one persisted reward", async () => {
  await saveDailySession(session());

  const results = await Promise.all([
    claimSessionCompletion({ day: "2026-07-29", today: "2026-07-29" }),
    claimSessionCompletion({ day: "2026-07-29", today: "2026-07-29" }),
  ]);
  const persistedPlayer = await db.player.get("player");
  const persistedSession = await db.dailySessions.get(
    "daily:reward-user:2026-07-29",
  );

  assert.deepEqual(
    results.map((result) => result?.reward.xp).sort((a, b) => a - b),
    [0, DAILY_SESSION_REWARD_XP],
  );
  assert.equal(persistedPlayer.xp, 100 + DAILY_SESSION_REWARD_XP);
  assert.equal(persistedSession.rewardClaimed, true);
});

test("claim merges into the player row current at commit time", async () => {
  await saveDailySession(session());
  await db.player.put(player({
    xp: 135,
    stars: 21,
    totalAttempts: 24,
    totalPasses: 19,
    ownedCosmetics: ["acc-flower"],
    updatedAt: 190,
  }));

  await claimSessionCompletion({
    day: "2026-07-29",
    today: "2026-07-29",
  });
  const persisted = await db.player.get("player");

  assert.equal(persisted.xp, 135 + DAILY_SESSION_REWARD_XP);
  assert.equal(persisted.totalAttempts, 24);
  assert.equal(persisted.totalPasses, 19);
  assert.deepEqual(persisted.ownedCosmetics, ["acc-flower"]);
});

test("a failure after the player put rolls back both completion writes", async () => {
  await saveDailySession(session());
  const originalPut = db.dailySessions.put;
  db.dailySessions.put = async () => {
    throw new Error("forced session write failure");
  };
  try {
    await assert.rejects(
      claimSessionCompletion({ day: "2026-07-29", today: "2026-07-29" }),
      /forced session write failure/,
    );
  } finally {
    db.dailySessions.put = originalPut;
  }

  assert.equal((await db.player.get("player")).xp, 100);
  assert.equal(
    (await db.dailySessions.get("daily:reward-user:2026-07-29"))
      .rewardClaimed,
    false,
  );
});

test("claim resolves only after both reward rows are durable", async () => {
  await saveDailySession(session());

  const result = await claimSessionCompletion({
    day: "2026-07-29",
    today: "2026-07-29",
  });
  const [persistedPlayer, persistedSession] = await Promise.all([
    db.player.get("player"),
    db.dailySessions.get("daily:reward-user:2026-07-29"),
  ]);

  assert.deepEqual(persistedPlayer, result.player);
  assert.deepEqual(persistedSession, result.session);
  assert.equal(persistedSession.rewardClaimed, true);
});

test("claiming yesterday preserves today's XP accounting", async () => {
  await db.player.put(player({
    xp: 150,
    todayKey: "2026-07-30",
    todayXp: 7,
    updatedAt: 300,
  }));
  await saveDailySession(session("2026-07-29"));

  await claimSessionCompletion({
    day: "2026-07-29",
    today: "2026-07-30",
  });
  const persisted = await db.player.get("player");

  assert.equal(persisted.xp, 150 + DAILY_SESSION_REWARD_XP);
  assert.equal(persisted.todayKey, "2026-07-30");
  assert.equal(persisted.todayXp, 7);
});
