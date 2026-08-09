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

import { dailyPronunciationEvidence, hasRequiredScoredPronunciation, loadOrCreateDailySession } from "./daily-session-loader.ts";
import { composeDailySession } from "./daily-session.ts";
import { LESSONS } from "./content/lessons.ts";
import {
  getDailySession,
  saveDailySession,
} from "./daily-session-store.ts";
import { bindLocalDb, db } from "./db/dexie.ts";
import { createDailyPronunciationGameState } from "./speech/daily-pronunciation-game.ts";

const session = (updatedAt = 1, { version = 1, startedAt = null } = {}) => {
  const lesson = LESSONS.find((entry) => entry.id === "th");
  const targets = lesson.items.slice(0, 3).map((item) => ({ ...item, lessonId: lesson.id }));
  return ({
  id: "daily:loader-user:2026-07-29",
  version,
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
    pronunciation: {
      mode: "scored",
      game: "sound-sprint",
      selectionSource: "curriculum-fallback",
      targets,
      ...(version === 2 ? { itemPool: targets, state: createDailyPronunciationGameState("sound-sprint", targets, targets) } : {}),
    },
  }],
  currentActivityId: "speak",
  rewardClaimed: false,
  startedAt,
  completedAt: null,
  createdAt: 1,
  updatedAt,
  });
};

test.beforeEach(async () => {
  await bindLocalDb("loader-user");
  await db.dailySessions.clear();
});

test("an active legacy session is published byte-for-byte without composition", async () => {
  const saved = await saveDailySession(session(10, { startedAt: 5 }));
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

test("an active malformed legacy row is grandfathered byte-for-byte", async () => {
  const legacy = session(11, { startedAt: 5 });
  delete legacy.activities[0].pronunciation;
  const saved = await saveDailySession(legacy);
  let composeCalls = 0;
  const loaded = await loadOrCreateDailySession({
    day: legacy.day, load: getDailySession,
    compose: async () => { composeCalls += 1; return session(20, { version: 2 }); },
    save: saveDailySession, publish: () => {},
  });
  assert.equal(composeCalls, 0);
  assert.deepEqual(loaded, saved);
});

test("new v2 composition is durable before it is published", async () => {
  let rowAtPublish;

  const loaded = await loadOrCreateDailySession({
    day: "2026-07-29",
    load: getDailySession,
    compose: async () => session(20, { version: 2 }),
    save: saveDailySession,
    publish: (value) => {
      rowAtPublish = db.dailySessions.get(value.id);
    },
  });

  assert.deepEqual(await rowAtPublish, loaded);
  assert.deepEqual(await db.dailySessions.get(loaded.id), loaded);
});

test("an unstarted legacy row migrates to v2", async () => {
  await saveDailySession(session(10));
  const replacement = session(20, { version: 2 });
  let composeCalls = 0;
  const loaded = await loadOrCreateDailySession({
    day: "2026-07-29", load: getDailySession,
    compose: async () => { composeCalls += 1; return replacement; },
    save: saveDailySession, publish: () => {},
  });
  assert.equal(composeCalls, 1);
  assert.equal(loaded.version, 2);
});

test("an invalid new composition cannot publish an ungraded-only daily session", async () => {
  const invalid = session(30);
  delete invalid.activities[0].pronunciation;
  let saves = 0;
  let publishes = 0;

  const loaded = await loadOrCreateDailySession({
    day: "2026-07-29",
    load: async () => undefined,
    compose: async () => invalid,
    save: async (value) => { saves += 1; return value; },
    publish: () => { publishes += 1; },
  });

  assert.equal(loaded, null);
  assert.equal(saves, 0);
  assert.equal(publishes, 0);
});

test("the loader passes bounded policy/provider evidence without raw speech", () => {
  const mapped = dailyPronunciationEvidence({
    itemId: "th:three", lessonId: "th", categoryId: "th", phoneme: "θ", target: "three", heard: "tree",
    score: 62, passed: false, providerStatus: "valid", policyVersion: "latam-v1", targetPhonemeScore: 48,
    weakestPhoneme: "th", pronunciationOutcome: "practiced-not-mastered", at: 123,
  });
  assert.deepEqual(mapped, {
    itemId: "th:three", passed: false, at: 123, evidence: "valid", providerStatus: "valid", policyVersion: "latam-v1",
    targetPhonemeScore: 48, weakestPhoneme: "th", phoneme: "θ", pronunciationOutcome: "practiced-not-mastered",
  });
  assert.equal("heard" in mapped, false);
  assert.equal("target" in mapped, false);
});

test("format-aware loader accepts authored Echo and Call stages across deterministic seeds", () => {
  const scenario = { id: "cafe", emoji: "☕", title: { es: "Café", en: "Cafe" }, blurb: { es: "", en: "" }, role: "barista", setting: "cafe", opener: { es: "", en: "" }, starters: [] };
  const connected = LESSONS.find((entry) => entry.id === "connected-speech");
  const th = LESSONS.find((entry) => entry.id === "th");
  const inputs = [connected.items[0], th.items.find((item) => item.kind === "word")].flatMap((source) =>
    Array.from({ length: 96 }, (_, offset) => ({
      profileId: "loader-user", day: `2026-12-${String(offset + 1).padStart(2, "0")}`, now: 1_800_000_000_000,
      level: "A1", path: "general", lessons: [source.categoryId === "connected-speech" ? connected : th], scenarios: [scenario],
      progress: [{ itemId: source.id, lessonId: source.categoryId === "connected-speech" ? connected.id : th.id, categoryId: source.categoryId, phoneme: source.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 50, updatedAt: 1 }],
    })),
  );
  const plans = inputs.map(composeDailySession);
  assert.ok(plans.some((plan) => plan.activities.some((activity) => activity.pronunciation?.game === "echo-chain")));
  assert.ok(plans.some((plan) => plan.activities.some((activity) => activity.pronunciation?.game === "call-rescue")));
  assert.ok(plans.every(hasRequiredScoredPronunciation));
});

test("format-aware loader rejects duplicate Sprint targets and pairless Beat targets", () => {
  const sprint = session(1, { version: 2 });
  sprint.activities[0].pronunciation.targets[1] = { ...sprint.activities[0].pronunciation.targets[0] };
  sprint.activities[0].pronunciation.state = createDailyPronunciationGameState("sound-sprint", sprint.activities[0].pronunciation.targets);
  assert.equal(hasRequiredScoredPronunciation(sprint), false);
  const beat = session(1, { version: 2 });
  beat.activities[0].pronunciation.game = "beat-the-twin";
  beat.activities[0].pronunciation.state = createDailyPronunciationGameState("beat-the-twin", beat.activities[0].pronunciation.targets);
  assert.equal(hasRequiredScoredPronunciation(beat), false);
});
