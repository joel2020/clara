// node --experimental-strip-types lib/speech/pronunciation-outbox.test.mjs
import "fake-indexeddb/auto";

globalThis.window = globalThis;

const { bindLocalDb, db } = await import("../db/dexie.ts");
const { DexieRepository } = await import("../db/dexie-repository.ts");
const { DEFAULT_SETTINGS } = await import("../db/repository.ts");
const { flushOutbox } = await import("../sync/outbox.ts");

let ok = 0, fail = 0;
const assert = (condition, message) => { if (condition) ok++; else { fail++; console.log("FAIL", message); } };
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const accountA = `pron-outbox-a-${suffix}`;
const accountB = `pron-outbox-b-${suffix}`;
const clientAttemptId = "51111111-1111-4111-8111-111111111111";
const intent = {
  attempt: {
    clientAttemptId,
    itemId: "outbox:coffee",
    lessonId: "outbox",
    categoryId: "conversation",
    phoneme: "f",
    target: "coffee",
    heard: "private learner speech",
    score: 95,
    passed: true,
    at: Date.UTC(2026, 7, 9, 15),
  },
  progress: { passed: true, score: 95 },
  reward: { passed: true, combo: 1, score: 95, xpAward: 10, masteryStars: 3 },
  quest: true,
};

await bindLocalDb(accountA);
// Deliberately forged legacy settings ownership: the captured account binding
// is authoritative and queued payloads may never select their own owner.
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: accountB });
const repo = new DexieRepository();
const binding = repo.capturePracticeBinding();
const committed = await repo.commitPracticeAttempt(binding, intent);
const rows = await db.outbox.orderBy("at").toArray();
assert(committed.status === "committed" && committed.outboxIds.length === 4, "local commit returns four durable state row ids");
assert(rows.map((row) => row.kind).sort().join(",") === "attempt,player,progress,quest", "attempt and all resulting state are queued in the same transaction");
assert(rows.every((row) => row.profileId === accountA), "captured concrete account owns every retry row despite forged settings or payload fields");
const queuedAttempt = rows.find((row) => row.kind === "attempt");
assert(queuedAttempt && !("heard" in queuedAttempt.payload), "the transactional attempt retry never retains recognized speech");
const originalIds = rows.map((row) => row.id);

let delivered = await flushOutbox(async () => false);
assert(delivered.delivered === 0 && delivered.remaining === 4, "a provider failure keeps the complete local state queue");
assert((await db.outbox.orderBy("at").toArray()).map((row) => row.id).join(",") === originalIds.join(","), "retry failure preserves stable outbox identities");

await bindLocalDb(accountB);
assert((await db.outbox.count()) === 0 && (await db.attempts.count()) === 0, "switching accounts exposes none of A's attempt or retry state in B");
await bindLocalDb(accountA);
assert((await db.outbox.orderBy("at").toArray()).map((row) => row.id).join(",") === originalIds.join(","), "rebind/restart resumes the exact same durable rows");

const duplicate = await repo.commitPracticeAttempt(binding, intent).catch(() => null);
assert(duplicate === null, "a token from the prior account generation is stale after rebind even for the same account");
const reboundRepo = new DexieRepository();
const duplicateOnCurrentBinding = await reboundRepo.commitPracticeAttempt(reboundRepo.capturePracticeBinding(), intent);
assert(duplicateOnCurrentBinding.status === "already-committed", "same UUID retry on a fresh binding is idempotently acknowledged");
assert((await db.outbox.count()) === 4, "same UUID retry creates no duplicate quest or outbox state");

delivered = await flushOutbox(async () => true);
assert(delivered.delivered === 4 && delivered.remaining === 0, "recovered delivery drains every state row exactly once");

console.log(`pronunciation outbox: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
