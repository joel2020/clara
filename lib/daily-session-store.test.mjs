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
  getDailySession,
  mergeDailySessions,
  saveDailySession,
} from "./daily-session-store.ts";

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
  version: 1,
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
