// npx tsx lib/sync/outbox.test.mjs
//
// Durable-sync outbox (audit P1: failed one-shot inserts were never retried,
// so offline practice could be permanently cloud-orphaned). These are
// failure-injection tests: the deliver function is faked so we exercise the
// retry machinery itself — enqueue, ordering, stop-on-failure, drain,
// account attribution — without a network or Supabase.
import "fake-indexeddb/auto";

globalThis.window = globalThis;
if (!globalThis.addEventListener) globalThis.addEventListener = () => {};

const { bindLocalDb, db } = await import("../db/dexie.ts");
const { enqueueOutbox, flushOutbox, pendingOutboxCount } = await import("./outbox.ts");

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const attempt = (at) => ({ itemId: `x:${at}`, lessonId: "x", categoryId: "conversation", phoneme: "chunk", at, passed: true, score: 90 });

await bindLocalDb("user-a");

// --- enqueue attribution ----------------------------------------------------
enqueueOutbox("attempt", "user-a", attempt(1));
enqueueOutbox("attempt", "USER-A", attempt(2)); // case-insensitive: same account
enqueueOutbox("attempt", "user-b", attempt(3)); // late callback after a switch: dropped
await wait(50);
assert((await pendingOutboxCount()) === 2, "own-account rows queue; another account's late row is dropped");

// --- transient failure: nothing is lost, retries are counted ----------------
let calls = 0;
const alwaysDown = async () => { calls++; return false; };
let res = await flushOutbox(alwaysDown);
assert(res.delivered === 0 && res.remaining === 2, "a down provider delivers nothing and keeps every row");
assert(calls === 1, "flush stops at the first failure instead of hammering");
assert((await db.outbox.orderBy("at").first())?.tries === 1, "the failed row's retry count is recorded");

// --- recovery: drains oldest-first, deletes only on success -----------------
const seen = [];
const nowUp = async (kind, profileId, payload) => { seen.push(payload.at); return true; };
res = await flushOutbox(nowUp);
assert(res.delivered === 2 && res.remaining === 0, "a recovered provider drains the queue");
assert(JSON.stringify(seen) === JSON.stringify([1, 2]), "rows replay oldest-first");

// --- partial failure mid-queue ----------------------------------------------
enqueueOutbox("exam", "user-a", { day: "2026-07-28", at: 10, level: "A1", score: 80, passed: true, sections: {}, weakest: null });
enqueueOutbox("call", "user-a", { scenarioId: "c1", at: 11, score: 70, checks: {} });
await wait(50);
const failSecond = async (kind) => kind !== "call";
res = await flushOutbox(failSecond);
assert(res.delivered === 1 && res.remaining === 1, "a mid-queue failure keeps the failed row and everything after it");
res = await flushOutbox(async () => true);
assert(res.remaining === 0, "the kept row delivers on the next trigger");

// --- account switch isolates queues ------------------------------------------
enqueueOutbox("attempt", "user-a", attempt(4));
await wait(50);
await bindLocalDb("user-b");
assert((await pendingOutboxCount()) === 0, "B's outbox does not contain A's pending rows");
await bindLocalDb("user-a");
assert((await pendingOutboxCount()) === 1, "A's pending row is still waiting in A's database");

// --- deliver that throws is a failure, not a crash ---------------------------
res = await flushOutbox(async () => { throw new Error("boom"); });
assert(res.delivered === 0 && res.remaining === 1, "a throwing deliver keeps the row");
res = await flushOutbox(async () => true);
assert(res.remaining === 0, "and it still delivers later");

console.log(`outbox: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
