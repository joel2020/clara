// npx tsx lib/sync/outbox.test.mjs
//
// Durable-sync outbox failure injection: retry order, account attribution,
// privacy allowlisting, historical scrub, and account-switch races.
import "fake-indexeddb/auto";

globalThis.window = globalThis;
if (!globalThis.addEventListener) globalThis.addEventListener = () => {};

const { bindLocalDb, db } = await import("../db/dexie.ts");
const { enqueueOutbox, flushOutbox, pendingOutboxCount } = await import("./outbox.ts");
const sync = await import("./supabase-sync.ts");
const { DEFAULT_SETTINGS, settingsSyncPayload } = await import("../db/repository.ts");

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const NOW = Date.UTC(2026, 7, 9, 12);
const uuid = (digit) => `${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
const attempt = (offset, over = {}) => ({
  clientAttemptId: uuid(String((offset % 8) + 1)),
  itemId: `x:${offset}`,
  lessonId: "x",
  categoryId: "conversation",
  phoneme: "chunk",
  target: "Can I have coffee?",
  heard: "private learner speech",
  at: NOW + offset,
  passed: true,
  score: 90.5,
  providerStatus: "valid",
  ...over,
});

await bindLocalDb("user-a");

// --- enqueue attribution + privacy allowlist --------------------------------
enqueueOutbox("attempt", "user-a", attempt(1, {
  transcript: "private",
  providerPayload: { raw: true },
  email: "learner@example.test",
  audio: new Uint8Array([1, 2]),
  audio_url: "https://private.invalid/voice.wav",
  blob: new Blob(["voice"]),
}));
enqueueOutbox("attempt", "USER-A", attempt(2)); // case-insensitive: same account
enqueueOutbox("attempt", "user-b", attempt(3)); // late callback after a switch: dropped
await wait(50);
assert((await pendingOutboxCount()) === 2, "own-account rows queue; another account's late row is dropped");
const queuedAttempt = await db.outbox.where("kind").equals("attempt").first();
for (const field of ["heard", "transcript", "providerPayload", "email", "audio", "audio_url", "blob"]) {
  assert(!(field in (queuedAttempt?.payload ?? {})), `attempt enqueue drops private field ${field}`);
}
assert(queuedAttempt?.payload?.score === 90.5, "attempt enqueue preserves fractional bounded evidence");

enqueueOutbox("attempt", "user-a", attempt(30, { clientAttemptId: undefined }));
enqueueOutbox("attempt", "user-a", attempt(31, { clientAttemptId: "not-a-uuid" }));
await wait(50);
assert((await pendingOutboxCount()) === 2, "new retry enqueue rejects missing or malformed client UUIDs instead of creating legacy rows");

// Invalid required attempt data is not retained in the retry queue.
enqueueOutbox("attempt", "user-a", { ...attempt(4), itemId: "", transcript: "still private" });
await wait(50);
assert((await pendingOutboxCount()) === 2, "invalid attempt payload is dropped instead of manufactured");

// --- transient failure: nothing is lost, retries are counted ----------------
let calls = 0;
const alwaysDown = async () => { calls++; return false; };
let res = await flushOutbox(alwaysDown);
assert(res.delivered === 0 && res.remaining === 2, "a down provider delivers nothing and keeps every safe row");
assert(calls === 1, "flush stops at the first failure instead of hammering");
assert((await db.outbox.orderBy("at").first())?.tries === 1, "the failed row's retry count is recorded");

// --- recovery: drains oldest-first, deletes only on success -----------------
const seen = [];
const nowUp = async (_kind, _profileId, payload) => { seen.push(payload.at); return true; };
res = await flushOutbox(nowUp);
assert(res.delivered === 2 && res.remaining === 0, "a recovered provider drains the queue");
assert(JSON.stringify(seen) === JSON.stringify([NOW + 1, NOW + 2]), "rows replay oldest-first");

// --- historical unsafe rows are scrubbed before replay ----------------------
await db.outbox.add({
  kind: "attempt",
  profileId: "user-a",
  payload: attempt(5, { clientAttemptId: undefined, transcript: "old secret", providerPayload: { raw: true }, audio_url: "private" }),
  at: NOW + 5,
  tries: 0,
});
let replayPayload;
res = await flushOutbox(async (_kind, _profileId, payload) => { replayPayload = payload; return false; });
assert(res.remaining === 1, "failed historical replay remains queued");
const scrubbed = await db.outbox.orderBy("at").first();
for (const field of ["heard", "transcript", "providerPayload", "audio_url"]) {
  assert(!(field in (replayPayload ?? {})) && !(field in (scrubbed?.payload ?? {})), `historical replay scrubs ${field} before delivery and retention`);
}
assert(!("clientAttemptId" in (replayPayload ?? {})), "a genuine historical UUID-less retry remains legacy after scrubbing");
await flushOutbox(async () => true);

// --- settings are durable, profile-first, and account-scoped ----------------
const settingsPayload = settingsSyncPayload("user-a", {
  ...DEFAULT_SETTINGS, profileId: "user-a", studentName: "Ana",
  onboarding: { name: "Ana", country: "Colombia", city: "Medellín", goal: "fluency", dailyMinutes: 10, selfLevel: "basics", level: "A1", completedAt: NOW },
});
enqueueOutbox("settings", "user-a", settingsPayload);
await wait(50);
res = await flushOutbox(async (kind) => kind !== "settings");
assert(res.delivered === 0 && res.remaining === 1, "a failed first settings upsert stays durably queued");
res = await flushOutbox(async () => true);
assert(res.delivered === 1 && res.remaining === 0, "the queued settings snapshot succeeds on the next idempotent retry");

await bindLocalDb("settings-race-a");
enqueueOutbox("settings", "settings-race-a", settingsSyncPayload("settings-race-a", { ...DEFAULT_SETTINGS, profileId: "settings-race-a", studentName: "Ana" }));
await wait(50);
await bindLocalDb("settings-race-b");
assert(await pendingOutboxCount() === 0, "learner B never sees learner A's deferred settings row");
await bindLocalDb("settings-race-a");
assert(await pendingOutboxCount() === 1, "learner A's deferred settings row remains in A's database after an account switch");
await flushOutbox(async () => true);
await bindLocalDb("user-a");

// The cloud existence matcher must use the exact same canonical identity as
// local restore merge. Same-time/core evidence with one optional difference is
// not already mirrored; an exact duplicate is.
const legacyPayload = attempt(40, {
  clientAttemptId: undefined,
  heardPartner: undefined,
  fluency: undefined,
  policyVersion: undefined,
  providerStatus: undefined,
  pronunciationScore: undefined,
  accuracyScore: undefined,
  completenessScore: undefined,
  prosodyScore: undefined,
  targetPhonemeScore: undefined,
  weakestPhoneme: undefined,
  weakestWord: undefined,
  attemptOrdinal: undefined,
  pronunciationOutcome: undefined,
});
const legacyCloudRow = (over = {}) => ({
  profile_id: "user-a",
  client_attempt_id: null,
  item_id: legacyPayload.itemId,
  lesson_id: legacyPayload.lessonId,
  category_id: legacyPayload.categoryId,
  phoneme: legacyPayload.phoneme,
  target: legacyPayload.target,
  score: legacyPayload.score,
  passed: legacyPayload.passed,
  heard_partner: null,
  at: legacyPayload.at,
  fluency: null,
  policy_version: null,
  provider_status: null,
  pronunciation_score: null,
  accuracy_score: null,
  completeness_score: null,
  prosody_score: null,
  target_phoneme_score: null,
  weakest_phoneme: null,
  weakest_word: null,
  attempt_ordinal: null,
  pronunciation_outcome: null,
  ...over,
});
assert(typeof sync.hasCanonicalLegacyAttempt === "function", "outbox exposes the shared canonical legacy existence matcher");
if (typeof sync.hasCanonicalLegacyAttempt === "function") {
  assert(sync.hasCanonicalLegacyAttempt("user-a", legacyPayload, [legacyCloudRow()]), "outbox matcher dedupes an exact legacy cloud copy");
  for (const [column, value] of [
    ["heard_partner", false],
    ["fluency", 0],
    ["policy_version", "latam-v1"],
    ["provider_status", "valid"],
    ["pronunciation_score", 0],
    ["accuracy_score", 0],
    ["completeness_score", 0],
    ["prosody_score", 0],
    ["target_phoneme_score", 0],
    ["weakest_phoneme", "θ"],
    ["weakest_word", "three"],
    ["attempt_ordinal", 1],
    ["pronunciation_outcome", "mastered"],
  ]) {
    assert(
      !sync.hasCanonicalLegacyAttempt("user-a", legacyPayload, [legacyCloudRow({ [column]: value })]),
      `outbox legacy matcher distinguishes ${column} from missing`,
    );
  }
}

// --- other durable kinds retain their established schemas ------------------
enqueueOutbox("exam-completion", "user-a", {
  attempt: {
    day: "2026-08-09", at: NOW + 9, level: "A1", score: 88, passed: true,
    sections: { readAloud: 88, repeat: 88, build: 88, shortAnswer: 88, retell: 88, openResponse: 88 }, weakest: "readAloud",
  },
  targetLevel: "A2",
});
await wait(50);
const combined = await db.outbox.where("kind").equals("exam-completion").first();
assert(combined && Object.keys(combined.payload).sort().join(",") === "attempt,targetLevel", "combined exam retry is an exact deep allowlist");
enqueueOutbox("exam-completion", "user-a", { ...combined.payload, providerPayload: { raw: true } });
enqueueOutbox("exam-completion", "user-a", { ...combined.payload, attempt: { ...combined.payload.attempt, transcript: "private" } });
enqueueOutbox("exam-completion", "user-a", { ...combined.payload, targetLevel: "C2" });
enqueueOutbox("exam-completion", "user-a", { attempt: combined.payload.attempt });
enqueueOutbox("exam-completion", "user-a", { ...combined.payload, targetLevel: 42 });
await wait(50);
assert(await db.outbox.where("kind").equals("exam-completion").count() === 1, "extra, private, missing, malformed, or noncanonical promotion payloads are rejected locally");
let combinedReplay;
res = await flushOutbox(async (kind, profileId, payload) => { combinedReplay = { kind, profileId, payload }; return true; });
assert(res.delivered === 1 && combinedReplay.kind === "exam-completion" && combinedReplay.profileId === "user-a", "combined exam completion replays as one owner-bound delivery");

enqueueOutbox("exam", "user-a", { day: "2026-07-27", at: NOW + 10, level: "A1", score: 80, passed: true, sections: {}, weakest: null });
await wait(50);
assert(await db.outbox.where("kind").equals("exam").count() === 0, "a passed exam cannot enter the legacy plain-exam retry path");

enqueueOutbox("exam", "user-a", { day: "2026-07-28", at: NOW + 11, level: "A1", score: 60, passed: false, sections: {}, weakest: null });
enqueueOutbox("call", "user-a", { scenarioId: "c1", at: NOW + 12, score: 70, checks: {} });
await wait(50);
const failSecond = async (kind) => kind !== "call";
res = await flushOutbox(failSecond);
assert(res.delivered === 1 && res.remaining === 1, "a mid-queue failure keeps the failed row and everything after it");
res = await flushOutbox(async () => true);
assert(res.remaining === 0, "the kept non-attempt row delivers on the next trigger");

// --- account switch isolates queues -----------------------------------------
enqueueOutbox("attempt", "user-a", attempt(12));
await wait(50);
await bindLocalDb("user-b");
assert((await pendingOutboxCount()) === 0, "B's outbox does not contain A's pending rows");
await bindLocalDb("user-a");
assert((await pendingOutboxCount()) === 1, "A's pending row is still waiting in A's database");
await flushOutbox(async () => true);

// --- deliver that throws is a failure, not a crash ---------------------------
enqueueOutbox("attempt", "user-a", attempt(13));
await wait(50);
res = await flushOutbox(async () => { throw new Error("boom"); });
assert(res.delivered === 0 && res.remaining === 1, "a throwing deliver keeps the row");
res = await flushOutbox(async () => true);
assert(res.remaining === 0, "and it still delivers later");

// --- switch during delivery cannot mutate same-numbered row in B -------------
await bindLocalDb("race-a");
enqueueOutbox("attempt", "race-a", attempt(20));
await wait(50);
const aId = (await db.outbox.orderBy("at").first())?.id;
const gate = deferred();
let deliveryStarted = false;
const flushing = flushOutbox(async () => {
  deliveryStarted = true;
  return gate.promise;
});
while (!deliveryStarted) await wait(0);

await bindLocalDb("race-b");
enqueueOutbox("exam", "race-b", { day: "2026-08-09", at: NOW + 21, level: "A1", score: 60, passed: false, sections: {}, weakest: null });
await wait(50);
const bRowBefore = await db.outbox.orderBy("at").first();
assert(bRowBefore?.id === aId, "A and B can have the same numeric outbox id in separate databases");
gate.resolve(true);
await flushing;
const bRowAfter = await db.outbox.get(bRowBefore.id);
assert(bRowAfter?.kind === "exam" && bRowAfter.tries === 0, "stale A flush never deletes or updates B's same-id row");
await bindLocalDb("race-a");
assert((await db.outbox.get(aId))?.kind === "attempt", "A row is safely left queued after a mid-delivery account switch");

console.log(`outbox: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
