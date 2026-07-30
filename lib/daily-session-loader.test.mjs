// node lib/daily-session-loader.test.mjs
//
// The hook's initialization boundary must resume durable state before asking
// for fresh evidence, and a newly composed plan must be durable before publish.
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

import { loadOrCreateDailySession } from "./daily-session-loader.ts";
import {
  getDailySession,
  saveDailySession,
} from "./daily-session-store.ts";
import { bindLocalDb, db } from "./db/dexie.ts";

const session = (updatedAt = 1) => ({
  id: "daily:loader-user:2026-07-29",
  version: 1,
  profileId: "loader-user",
  day: "2026-07-29",
  objective: { es: "Objetivo", en: "Objective" },
  outcome: { es: "Resultado", en: "Outcome" },
  assistance: "spanish-full",
  activities: [{
    id: "speak",
    kind: "speak",
    title: { es: "Habla", en: "Speak" },
    targetIds: [],
    sourceId: "lesson",
    reason: "level-next",
    estimatedMinutes: 2,
    status: "pending",
  }],
  currentActivityId: "speak",
  rewardClaimed: false,
  startedAt: null,
  completedAt: null,
  createdAt: 1,
  updatedAt,
});

test.beforeEach(async () => {
  await bindLocalDb("loader-user");
  await db.dailySessions.clear();
});

test("saved session is published without reading composition evidence", async () => {
  const saved = await saveDailySession(session(10));
  let composeCalls = 0;
  const published = [];

  const loaded = await loadOrCreateDailySession({
    day: "2026-07-29",
    load: getDailySession,
    compose: async () => {
      composeCalls += 1;
      return session(20);
    },
    save: saveDailySession,
    publish: (value) => published.push(value),
  });

  assert.equal(composeCalls, 0);
  assert.deepEqual(loaded, saved);
  assert.deepEqual(published, [saved]);
});

test("new composition is durable before it is published", async () => {
  let rowAtPublish;

  const loaded = await loadOrCreateDailySession({
    day: "2026-07-29",
    load: getDailySession,
    compose: async () => session(20),
    save: saveDailySession,
    publish: (value) => {
      rowAtPublish = db.dailySessions.get(value.id);
    },
  });

  assert.deepEqual(await rowAtPublish, loaded);
  assert.deepEqual(await db.dailySessions.get(loaded.id), loaded);
});
