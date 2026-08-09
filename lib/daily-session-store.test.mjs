// node lib/daily-session-store.test.mjs
//
// Resumable daily-loop persistence. These checks exercise the merge policy and,
// below, the real account-scoped IndexedDB store so stale device state can never
// erase completed learner evidence.
import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://clara.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test-key";
globalThis.fetch = async () => new Response("[]", {
  status: 200,
  headers: { "content-type": "application/json" },
});

import {
  checkpointActivity,
  checkpointPronunciationGame,
  getDailySession,
  mergeDailySessions,
  saveDailySession,
} from "./daily-session-store.ts";
import { advanceDailyPronunciationGame, createDailyPronunciationGameState } from "./speech/daily-pronunciation-game.ts";

const activity = (kind, status, completedAt) => ({
  id: kind,
  kind,
  title: { es: kind, en: kind },
  targetIds: [`target:${kind}`],
  sourceId: `source:${kind}`,
  reason: "transfer",
  estimatedMinutes: 2,
  status,
  ...(completedAt === undefined ? {} : { completedAt }),
});

const session = ({
  version = 1,
  profileId = "user-a",
  day = "2026-07-29",
  activities = [activity("speak", "pending")],
  currentActivityId = activities[0]?.id ?? null,
  rewardClaimed = false,
  startedAt = null,
  completedAt = null,
  createdAt = 1,
  updatedAt = 1,
} = {}) => ({
  id: `daily:${profileId}:${day}`,
  version,
  profileId,
  day,
  objective: { es: "Objetivo", en: "Objective" },
  outcome: { es: "Resultado", en: "Outcome" },
  assistance: "spanish-full",
  activities,
  currentActivityId,
  rewardClaimed,
  startedAt,
  completedAt,
  createdAt,
  updatedAt,
});

const pronunciationActivity = () => {
  const targets = ["one", "two", "three"].map((text) => ({ id: `test:${text}`, text, ipa: "/tɛst/", mouthHint: "", kind: "word", categoryId: "test", phoneme: "t" }));
  return {
    ...activity("speak", "active"),
    sourceId: "test",
    targetIds: targets.map(({ id }) => id),
    pronunciation: { mode: "scored", game: "sound-sprint", selectionSource: "curriculum-fallback", targets, itemPool: targets, state: createDailyPronunciationGameState("sound-sprint", targets, targets) },
  };
};
const attemptEvent = (targetIndex, ordinal, outcome, score = 65) => ({
  type: "attempt",
  event: { id: `${targetIndex + 1}${ordinal}111111-1111-4111-8111-111111111111`, targetIndex, ordinal, outcome, score, at: ordinal },
});

test("completed evidence wins and rewards stay claimed", () => {
  const merged = mergeDailySessions(
    session({ activities: [activity("speak", "completed", 8)], rewardClaimed: true, updatedAt: 10 }),
    session({ activities: [activity("speak", "pending")], rewardClaimed: false, updatedAt: 20 }),
  );
  assert.equal(merged.activities[0].status, "completed");
  assert.equal(merged.activities[0].completedAt, 8);
  assert.equal(merged.rewardClaimed, true);
});

test("newer activity content survives while older terminal evidence is preserved", () => {
  const oldCompleted = {
    ...activity("speak", "completed", 8),
    title: { es: "Anterior", en: "Old" },
    targetIds: ["target:old"],
  };
  const newPending = {
    ...activity("speak", "pending"),
    title: { es: "Nuevo", en: "New" },
    targetIds: ["target:new"],
  };
  const merged = mergeDailySessions(
    session({ activities: [newPending], updatedAt: 20 }),
    session({ activities: [oldCompleted], updatedAt: 10 }),
  );
  assert.deepEqual(merged.activities[0].title, { es: "Nuevo", en: "New" });
  assert.deepEqual(merged.activities[0].targetIds, ["target:new"]);
  assert.equal(merged.activities[0].status, "completed");
  assert.equal(merged.activities[0].completedAt, 8);
});

test("daily-session merge unions equal-sequence pronunciation UUID branches", () => {
  const speaking = pronunciationActivity();
  const leftState = advanceDailyPronunciationGame(speaking.pronunciation.state, attemptEvent(0, 1, "retry", 61));
  const rightState = advanceDailyPronunciationGame(speaking.pronunciation.state, {
    ...attemptEvent(0, 1, "mastered", 92),
    event: { ...attemptEvent(0, 1, "mastered", 92).event, id: "99111111-1111-4111-8111-111111111111" },
  });
  const branch = (state, updatedAt) => session({ day: "2026-08-11", version: 2, updatedAt, activities: [{ ...speaking, pronunciation: { ...speaking.pronunciation, state } }] });
  const merged = mergeDailySessions(branch(leftState, 20), branch(rightState, 20));
  const state = merged.activities[0].pronunciation.state;
  assert.equal(state.attemptEvents.length, 2);
  assert.equal(state.sessions[0].status, "mastered");
});

test("daily-session merge fails closed for incompatible pronunciation content", () => {
  const speaking = pronunciationActivity();
  const incompatible = {
    ...speaking,
    pronunciation: {
      ...speaking.pronunciation,
      state: { ...speaking.pronunciation.state, contentHash: "daily-pronunciation-v2:deadbeef" },
    },
  };
  assert.throws(
    () => mergeDailySessions(
      session({ day: "2026-08-11", version: 2, updatedAt: 20, activities: [speaking] }),
      session({ day: "2026-08-11", version: 2, updatedAt: 10, activities: [incompatible] }),
    ),
    /incompatible pronunciation/i,
  );
});

test("a newer legacy branch cannot erase an older validated v2 pronunciation game", () => {
  const speaking = pronunciationActivity();
  const { itemPool: _pool, state: _state, ...legacyPronunciation } = speaking.pronunciation;
  const merged = mergeDailySessions(
    session({ day: "2026-08-11", version: 1, updatedAt: 30, activities: [{ ...speaking, pronunciation: legacyPronunciation }] }),
    session({ day: "2026-08-11", version: 2, updatedAt: 20, activities: [speaking] }),
  );
  assert.equal(merged.version, 2);
  assert.deepEqual(merged.activities[0].pronunciation, speaking.pronunciation);
});

test("newer clients without pronunciation cannot erase an older shipped v1 pronunciation object", () => {
  const speaking = pronunciationActivity();
  const { itemPool: _pool, state: _state, ...shippedV1 } = speaking.pronunciation;
  const older = session({ day: "2026-08-15", version: 1, updatedAt: 10, activities: [{ ...speaking, pronunciation: shippedV1 }] });
  const newer = session({ day: "2026-08-15", version: 2, updatedAt: 20, activities: [{ ...speaking, pronunciation: undefined }] });
  for (const [left, right] of [[newer, older], [older, newer]]) {
    assert.deepEqual(mergeDailySessions(left, right).activities[0].pronunciation, shippedV1);
  }
  const newest = session({ day: "2026-08-15", version: 2, updatedAt: 30, activities: [{ ...speaking, pronunciation: undefined }] });
  const sequential = mergeDailySessions(newest, mergeDailySessions(newer, older));
  assert.deepEqual(sequential.activities[0].pronunciation, shippedV1);
});

test("checkpoint saves before returning, advances, and never regresses completion", async () => {
  globalThis.window = globalThis;
  const { bindLocalDb } = await import("./db/dexie.ts");
  await bindLocalDb("user-a");
  await saveDailySession(session({
    activities: [activity("speak", "active"), activity("reflect", "pending")],
    currentActivityId: "speak",
  }));

  const completed = await checkpointActivity({
    day: "2026-07-29",
    activityId: "speak",
    status: "completed",
    at: 30,
  });
  assert.equal(completed.activities[0].status, "completed");
  assert.equal(completed.activities[0].completedAt, 30);
  assert.equal(completed.currentActivityId, "reflect");
  assert.equal((await getDailySession("2026-07-29"))?.activities[0].status, "completed");

  const staleTechnicalFailure = await checkpointActivity({
    day: "2026-07-29",
    activityId: "speak",
    status: "technical-skip",
    at: 40,
  });
  assert.equal(staleTechnicalFailure.activities[0].status, "completed");
  assert.equal(staleTechnicalFailure.activities[0].completedAt, 30);
});

test("pronunciation checkpoints resume exact counts and classify terminal evidence", async () => {
  globalThis.window = globalThis;
  const { bindLocalDb } = await import("./db/dexie.ts");
  await bindLocalDb("user-a");
  const speaking = pronunciationActivity();
  await saveDailySession(session({ day: "2026-08-09", activities: [speaking, activity("reflect", "pending")], currentActivityId: "speak" }));
  let state = advanceDailyPronunciationGame(speaking.pronunciation.state, attemptEvent(0, 1, "retry"));
  let saved = await checkpointPronunciationGame({ day: "2026-08-09", activityId: "speak", contentHash: state.contentHash, state, at: 10 });
  assert.equal(saved.activities[0].pronunciation.state.sessions[0].validAttempts, 1);
  assert.deepEqual(await checkpointPronunciationGame({ day: "2026-08-09", activityId: "speak", contentHash: state.contentHash, state, at: 11 }), saved);
  state = advanceDailyPronunciationGame(state, attemptEvent(0, 2, "retry"));
  state = advanceDailyPronunciationGame(state, attemptEvent(0, 3, "retry"));
  saved = await checkpointPronunciationGame({ day: "2026-08-09", activityId: "speak", contentHash: state.contentHash, state, at: 12 });
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 0, resolution: "graded-practiced" });
  saved = await checkpointPronunciationGame({ day: "2026-08-09", activityId: "speak", contentHash: state.contentHash, state, at: 13 });
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 1, resolution: "technical" });
  saved = await checkpointPronunciationGame({ day: "2026-08-09", activityId: "speak", contentHash: state.contentHash, state, at: 15 });
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 2, resolution: "ungraded" });
  saved = await checkpointPronunciationGame({ day: "2026-08-09", activityId: "speak", contentHash: state.contentHash, state, at: 16 });
  assert.equal(saved.activities[0].status, "completed");
  assert.equal(saved.currentActivityId, "reflect");
});

test("all technical or ungraded targets never complete the activity", async () => {
  globalThis.window = globalThis;
  const { bindLocalDb } = await import("./db/dexie.ts");
  await bindLocalDb("user-a");
  const speaking = pronunciationActivity();
  await saveDailySession(session({ day: "2026-08-10", activities: [speaking], currentActivityId: "speak" }));
  let state = speaking.pronunciation.state;
  for (let index = 0; index < 3; index += 1) {
    state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: index, resolution: index === 1 ? "ungraded" : "technical" });
    await checkpointPronunciationGame({ day: "2026-08-10", activityId: "speak", contentHash: state.contentHash, state, at: 21 + index * 2 });
  }
  const saved = await getDailySession("2026-08-10");
  assert.equal(saved.activities[0].status, "technical-skip");
  assert.equal(saved.activities[0].completedAt, undefined);
});

test("corrupt active v2 pronunciation can be archived and replaced once", async () => {
  globalThis.window = globalThis;
  const { bindLocalDb, db } = await import("./db/dexie.ts");
  const { DexieRepository } = await import("./db/dexie-repository.ts");
  await bindLocalDb("user-recovery");
  const speaking = pronunciationActivity();
  speaking.pronunciation.state = { ...speaking.pronunciation.state, version: 99, contentHash: "x".repeat(500), providerPayload: { private: true } };
  const row = session({ profileId: "user-recovery", day: "2026-08-12", activities: [speaking], currentActivityId: "speak" });
  await db.dailySessions.put(row);
  const repository = new DexieRepository();
  const binding = repository.capturePracticeBinding();
  const recovered = await repository.replaceCorruptDailyPronunciation(binding, { day: row.day, activityId: "speak", at: 50 });
  const pronunciation = recovered.activities[0].pronunciation;
  assert.equal(pronunciation.state.version, 2);
  assert.notEqual(pronunciation.state.contentHash, "x".repeat(500));
  assert.deepEqual(pronunciation.recoveryArchive, [{ at: 50, version: null, contentHash: null }]);
  const outboxCount = await db.outbox.count();
  const reloaded = await repository.replaceCorruptDailyPronunciation(binding, { day: row.day, activityId: "speak", at: 51 });
  assert.deepEqual(reloaded, recovered);
  assert.equal(await db.outbox.count(), outboxCount);
});

test("a started shipped v1 pronunciation activity recovers without erasing session progress", async () => {
  globalThis.window = globalThis;
  const { bindLocalDb, db } = await import("./db/dexie.ts");
  const { DexieRepository } = await import("./db/dexie-repository.ts");
  const { isAuthoredDailyPronunciationActivity } = await import("./daily-session.ts");
  await bindLocalDb("user-v1-recovery");
  const legacyTargets = ["th:three", "th:both", "th:thank"].map((id) => ({
    id, text: "untrusted old text", ipa: "/wrong/", mouthHint: "wrong", kind: "phrase", categoryId: "wrong", phoneme: "wrong",
  }));
  const speak = {
    ...activity("speak", "active"), sourceId: "th", targetIds: legacyTargets.map(({ id }) => id),
    pronunciation: { mode: "scored", game: "sound-sprint", selectionSource: "latam-prior", feature: "th", targets: legacyTargets },
  };
  const reflect = activity("reflect", "completed", 9);
  const row = session({
    profileId: "user-v1-recovery", day: "2026-08-13", version: 1,
    activities: [speak, reflect], currentActivityId: "speak", rewardClaimed: true,
    startedAt: 7, createdAt: 3, updatedAt: 11,
  });
  await db.dailySessions.put(row);
  const repository = new DexieRepository();
  const binding = repository.capturePracticeBinding();
  const recovered = await repository.replaceCorruptDailyPronunciation(binding, { day: row.day, activityId: "speak", at: 50 });
  const pronunciation = recovered.activities[0].pronunciation;
  assert.equal(recovered.version, 2);
  assert.equal(recovered.startedAt, 7);
  assert.equal(recovered.rewardClaimed, true);
  assert.equal(recovered.activities[1].status, "completed");
  assert.equal(recovered.activities[1].completedAt, 9);
  assert.equal(recovered.activities[0].sourceId, "th");
  assert.equal(isAuthoredDailyPronunciationActivity(pronunciation), true);
  assert.deepEqual(pronunciation.targets.map((target) => target.text), ["three", "both", "thank"]);
  assert.deepEqual(pronunciation.state.attemptEvents, []);
  assert.deepEqual(pronunciation.state.resolutions, [null, null, null]);
  assert.equal(await db.outbox.count(), 1);
});

test("shipped v1 recovery rejects unknown metadata and leaves the row untouched", async () => {
  globalThis.window = globalThis;
  const { bindLocalDb, db } = await import("./db/dexie.ts");
  const { DexieRepository } = await import("./db/dexie-repository.ts");
  await bindLocalDb("user-v1-unknown");
  const targets = ["unknown:one", "unknown:two", "unknown:three"].map((id) => ({ id, text: "invented" }));
  const speak = { ...activity("speak", "active"), pronunciation: {
    mode: "scored", game: "sound-sprint", selectionSource: "curriculum-fallback", targets,
  } };
  const row = session({ profileId: "user-v1-unknown", day: "2026-08-14", version: 1, activities: [speak], startedAt: 5 });
  await db.dailySessions.put(row);
  const repository = new DexieRepository();
  await assert.rejects(
    repository.replaceCorruptDailyPronunciation(repository.capturePracticeBinding(), { day: row.day, activityId: "speak", at: 50 }),
    /canonical/i,
  );
  assert.deepEqual(await db.dailySessions.get(row.id), row);
  assert.equal(await db.outbox.count(), 0);
});

test("daily rows remain account-scoped and reject stale cross-account attribution", async () => {
  globalThis.window = globalThis;
  const { bindLocalDb } = await import("./db/dexie.ts");
  await bindLocalDb("user-a");
  assert.equal((await getDailySession("2026-07-29"))?.profileId, "user-a");

  await bindLocalDb("user-b");
  assert.equal(await getDailySession("2026-07-29"), undefined);
  await assert.rejects(
    saveDailySession(session({ profileId: "user-a" })),
    /bound account/i,
  );

  await saveDailySession(session({ profileId: "user-b" }));
  assert.equal((await getDailySession("2026-07-29"))?.profileId, "user-b");
  await bindLocalDb("user-a");
  assert.equal((await getDailySession("2026-07-29"))?.profileId, "user-a");
});

test("concurrent checkpoints preserve disjoint activity completions", async () => {
  globalThis.window = globalThis;
  globalThis.fetch = async () => new Response("[]", {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  const { bindLocalDb } = await import("./db/dexie.ts");
  await bindLocalDb("user-a");
  await saveDailySession(session({
    day: "2026-07-30",
    activities: [activity("speak", "pending"), activity("reflect", "pending")],
    currentActivityId: "speak",
  }));

  await Promise.all([
    checkpointActivity({ day: "2026-07-30", activityId: "speak", status: "completed", at: 100 }),
    checkpointActivity({ day: "2026-07-30", activityId: "reflect", status: "completed", at: 101 }),
  ]);

  const saved = await getDailySession("2026-07-30");
  assert.deepEqual(
    saved?.activities.map((entry) => [entry.id, entry.status]),
    [["speak", "completed"], ["reflect", "completed"]],
  );
  assert.equal(saved?.currentActivityId, null);
});

test("stale disjoint cloud writes merge monotonically through the RPC boundary", async () => {
  globalThis.window = globalThis;
  const requests = [];
  let cloud = null;
  globalThis.fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init });
    const incoming = JSON.parse(String(init.body)).p_payload;
    if (!cloud) {
      cloud = structuredClone(incoming);
    } else {
      const byId = new Map(cloud.activities.map((entry) => [entry.id, entry]));
      for (const entry of incoming.activities) {
        const existing = byId.get(entry.id);
        if (!existing) byId.set(entry.id, entry);
        else if (entry.status === "completed" && existing.status !== "completed") byId.set(entry.id, entry);
      }
      const newer = incoming.updatedAt >= cloud.updatedAt ? incoming : cloud;
      cloud = {
        ...newer,
        activities: newer.activities.map((entry) => byId.get(entry.id)),
        rewardClaimed: cloud.rewardClaimed || incoming.rewardClaimed,
        updatedAt: Math.max(cloud.updatedAt, incoming.updatedAt),
      };
    }
    return new Response(JSON.stringify(cloud), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const { deliverQueued } = await import("./sync/supabase-sync.ts");
  const first = session({
    activities: [activity("speak", "completed", 60), activity("reflect", "pending")],
    updatedAt: 70,
  });
  const staleDisjoint = session({
    activities: [activity("speak", "pending"), activity("reflect", "completed", 50)],
    rewardClaimed: true,
    updatedAt: 55,
  });
  assert.equal(await deliverQueued("daily-session", "user-a", first), true);
  assert.equal(await deliverQueued("daily-session", "user-a", staleDisjoint), true);
  assert.ok(requests.every((request) => request.url.includes("/rest/v1/rpc/merge_daily_session")));
  assert.deepEqual(
    cloud.activities.map((entry) => [entry.id, entry.status]),
    [["speak", "completed"], ["reflect", "completed"]],
  );
  assert.equal(cloud.rewardClaimed, true);
  const args = JSON.parse(String(requests[1].init.body));
  assert.equal(args.p_day, "2026-07-29");
  assert.equal(args.p_payload.profileId, "user-a");
  assert.equal("profile_id" in args, false);

  const { bindLocalDb, db } = await import("./db/dexie.ts");
  const { enqueueOutbox, flushOutbox } = await import("./sync/outbox.ts");
  await bindLocalDb("user-a");
  await db.outbox.clear();
  enqueueOutbox("daily-session", "user-a", staleDisjoint);
  await new Promise((resolve) => setTimeout(resolve, 20));
  let result = await flushOutbox(async () => false);
  assert.deepEqual(result, { delivered: 0, remaining: 1 });
  assert.equal((await db.outbox.toArray())[0].tries, 1);
  assert.equal((await db.outbox.toArray())[0].profileId, "user-a");
  result = await flushOutbox(async () => true);
  assert.deepEqual(result, { delivered: 1, remaining: 0 });
});

test("get pulls only the requested day and merges before local save", async () => {
  const requests = [];
  const remote = session({
    activities: [activity("speak", "pending")],
    rewardClaimed: true,
    updatedAt: 90,
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    requests.push({ url, init });
    if ((init.method ?? "GET") === "GET") {
      return new Response(JSON.stringify([{
        profile_id: "user-a",
        day: "2026-07-29",
        version: 1,
        payload: remote,
        updated_at: 90,
      }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("[]", {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };
  const { bindLocalDb, db } = await import("./db/dexie.ts");
  await bindLocalDb("user-a");
  const merged = await getDailySession("2026-07-29");
  assert.equal(merged?.activities.find((entry) => entry.id === "speak")?.status, "completed");
  assert.equal(merged?.rewardClaimed, true);
  assert.equal(merged?.updatedAt, 90);
  assert.equal((await db.dailySessions.get(merged.id)).rewardClaimed, true);
  const pull = requests.find((request) => (request.init.method ?? "GET") === "GET");
  assert.ok(pull);
  assert.match(pull.url, /day=eq\.2026-07-29/);
});
