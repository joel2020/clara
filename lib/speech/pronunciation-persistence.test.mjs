// node --experimental-strip-types lib/speech/pronunciation-persistence.test.mjs
//
// Pronunciation evidence is useful only when it is bounded, private, and still
// attributable to the learner who made it. These tests exercise the real Dexie
// repository plus the cloud serialization/restore boundary. Raw provider data,
// learner transcripts, and media must never hitch a ride in the sync payload.
import "fake-indexeddb/auto";

globalThis.window = globalThis;

const { bindLocalDb, db, ClaraDB } = await import("../db/dexie.ts");
const { DexieRepository } = await import("../db/dexie-repository.ts");
const { DEFAULT_SETTINGS, mergeAttemptHistory } = await import("../db/repository.ts");
const sync = await import("../sync/supabase-sync.ts");

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };
const rejects = async (operation, msg) => {
  try { await operation(); assert(false, msg); } catch { assert(true, msg); }
};
const stable = (value) => JSON.stringify(value, (key, val) =>
  val && typeof val === "object" && !Array.isArray(val)
    ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => a.localeCompare(b)))
    : val,
);

const NOW = Date.UTC(2026, 7, 9, 12);
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";
const baseAttempt = (over = {}) => ({
  clientAttemptId: UUID_A,
  itemId: "coffee:three",
  lessonId: "coffee-order",
  categoryId: "conversation",
  phoneme: "th",
  target: "three coffees",
  heard: "tree coffees",
  score: 81.6,
  passed: false,
  at: NOW,
  ...over,
});

await bindLocalDb("pronunciation-owner-a");
const repo = new DexieRepository();
const initialPracticeBinding = repo.capturePracticeBinding();

// The production mutation caught here is storing the caller's object directly
// rather than reconstructing the explicit bounded Attempt contract.
const complete = baseAttempt({
  policyVersion: "latam-v1",
  providerStatus: "valid",
  fluency: 74.6,
  pronunciationScore: 0,
  accuracyScore: 81.6,
  completenessScore: 92,
  prosodyScore: 65,
  targetPhonemeScore: 74.6,
  weakestPhoneme: "θ",
  weakestWord: "three",
  attemptOrdinal: 2,
  pronunciationOutcome: "practiced-not-mastered",
  providerPayload: { NBest: [{ Words: [{ Word: "three" }] }] },
  transcript: "tree coffees",
  email: "learner@example.test",
  audio: { bytes: [1, 2, 3] },
  audio_url: "https://private.invalid/voice.wav",
  blob: new Blob(["voice"]),
  profileId: "pronunciation-owner-b",
});
await repo.recordAttempt(complete);
const [stored] = await repo.getAttempts({ itemId: complete.itemId });
for (const field of [
  "clientAttemptId", "policyVersion", "providerStatus", "fluency",
  "pronunciationScore", "accuracyScore", "completenessScore", "prosodyScore",
  "targetPhonemeScore", "weakestPhoneme", "weakestWord", "attemptOrdinal",
  "pronunciationOutcome",
]) {
  assert(stored?.[field] === complete[field], `bounded ${field} round-trips through the real repository`);
}
assert(stored?.pronunciationScore === 0, "a measured zero remains zero instead of becoming missing");
assert(
  stored?.score === 81.6 && stored?.fluency === 74.6 && stored?.targetPhonemeScore === 74.6,
  "threshold-sensitive decimal scores round-trip without integer loss",
);
for (const field of ["providerPayload", "transcript", "email", "audio", "audio_url", "blob", "profileId"]) {
  assert(!(field in (stored ?? {})), `local persistence drops non-contract field ${field}`);
}

// Invalid optional evidence is omitted, never coerced into a misleading score.
await repo.recordAttempt(baseAttempt({
  itemId: "coffee:invalid",
  clientAttemptId: UUID_C,
  at: NOW + 1,
  policyVersion: "latam-v2",
  providerStatus: "raw-provider-status",
  pronunciationScore: 101,
  accuracyScore: -1,
  completenessScore: Number.NaN,
  prosodyScore: Number.POSITIVE_INFINITY,
  targetPhonemeScore: "74",
  weakestPhoneme: "x".repeat(65),
  weakestWord: "word".repeat(40),
  attemptOrdinal: 4,
  pronunciationOutcome: "almost",
}));
const [invalid] = await repo.getAttempts({ itemId: "coffee:invalid" });
for (const field of [
  "policyVersion", "providerStatus", "pronunciationScore",
  "accuracyScore", "completenessScore", "prosodyScore", "targetPhonemeScore",
  "weakestPhoneme", "weakestWord", "attemptOrdinal", "pronunciationOutcome",
]) {
  assert(!(field in (invalid ?? {})), `invalid or unbounded ${field} is dropped`);
}
assert(invalid?.clientAttemptId === UUID_C, "a valid new-attempt UUID survives optional evidence cleanup");

// New writes must never silently become legacy attempts. UUID-less rows are a
// read/restore compatibility case only, not an identity mode callers can choose.
await rejects(
  () => repo.recordAttempt(baseAttempt({ itemId: "missing:uuid", clientAttemptId: undefined, at: NOW + 20 })),
  "a newly recorded attempt with an explicitly missing client UUID is rejected",
);
await rejects(
  () => repo.recordAttempt(baseAttempt({ itemId: "malformed:uuid", clientAttemptId: "not-a-uuid", at: NOW + 21 })),
  "a newly recorded attempt with a malformed client UUID is rejected",
);
assert((await repo.getAttempts({ itemId: "missing:uuid" })).length === 0, "missing UUID cannot downgrade a new write to legacy");
assert((await repo.getAttempts({ itemId: "malformed:uuid" })).length === 0, "malformed UUID cannot downgrade a new write to legacy");

const mutationFor = (clientAttemptId, suffix) => ({
  attempt: baseAttempt({ clientAttemptId, itemId: `atomic:${suffix}`, categoryId: "atomic", at: NOW + 30 + suffix.length }),
  progress: { passed: true, score: 92 },
  reward: { passed: true, combo: 1, score: 92, xpAward: 10, masteryStars: 3 },
  quest: true,
});

const assertMutationAbsent = async (mutation, label) => {
  assert((await repo.getAttempts({ itemId: mutation.attempt.itemId })).length === 0, `${label}: attempt rolls back`);
  assert((await repo.getProgress(mutation.attempt.itemId)) === undefined, `${label}: progress rolls back`);
  assert((await db.player.get("player")) === undefined, `${label}: player reward rolls back`);
};

for (const [boundary, table, hookName] of [
  ["before attempt write", db.attempts, "creating"],
  ["after attempt write", db.progress, "creating"],
  ["after progress write", db.player, "creating"],
]) {
  const mutation = mutationFor(
    boundary === "before attempt write" ? "44444444-4444-4444-8444-444444444444"
      : boundary === "after attempt write" ? "55555555-5555-4555-8555-555555555555"
        : "66666666-6666-4666-8666-666666666666",
    boundary.replaceAll(" ", "-"),
  );
  const fault = () => { throw new Error(boundary); };
  table.hook(hookName).subscribe(fault);
  await rejects(() => repo.commitPracticeAttempt(initialPracticeBinding, mutation), `${boundary} rejects the transaction`);
  table.hook(hookName).unsubscribe(fault);
  await assertMutationAbsent(mutation, boundary);
}

const idempotentMutation = mutationFor("77777777-7777-4777-8777-777777777777", "idempotent");
{
  const firstCommit = await repo.commitPracticeAttempt(initialPracticeBinding, idempotentMutation);
  const secondCommit = await repo.commitPracticeAttempt(initialPracticeBinding, idempotentMutation);
  assert(firstCommit.status === "committed", "first exact-once mutation commits");
  assert(secondCommit.status === "already-committed", "same stable UUID is recognized as already committed");
  assert((await repo.getAttempts({ itemId: idempotentMutation.attempt.itemId })).length === 1, "repeated commit stores one attempt");
  assert((await repo.getProgress(idempotentMutation.attempt.itemId))?.attempts === 1, "repeated commit applies progress once");
  assert((await db.player.get("player"))?.xp === 10, "repeated commit applies reward once");
}

// Required fields are a strict boundary: no epoch-zero/blank record is ever
// manufactured from inherited, accessor, implausible, or oversized input.
const inherited = Object.create(baseAttempt({ itemId: "inherited" }));
inherited.own = true;
await rejects(() => repo.recordAttempt(inherited), "an inherited attempt object is rejected");
const accessor = baseAttempt();
Object.defineProperty(accessor, "itemId", { get: () => "getter-id", enumerable: true });
await rejects(() => repo.recordAttempt(accessor), "an accessor-backed required field is rejected without treating it as data");
await rejects(() => repo.recordAttempt(baseAttempt({ target: "x".repeat(513) })), "oversized required text is rejected");
await rejects(() => repo.recordAttempt(baseAttempt({ at: 0 })), "epoch-zero timestamps are rejected");
await rejects(() => repo.recordAttempt(baseAttempt({ at: Number.MAX_SAFE_INTEGER + 1 })), "unsafe timestamps are rejected");
await rejects(() => repo.recordAttempt(baseAttempt({ itemId: "bad id with spaces" })), "unsafe identifiers are rejected");

// Technical availability is not learner performance and must not become history.
await rejects(() => repo.recordAttempt(baseAttempt({
  itemId: "coffee:skip",
  clientAttemptId: UUID_B,
  at: NOW + 2,
  policyVersion: "latam-v1",
  providerStatus: "technical-skip",
  fluency: 7,
  pronunciationScore: 12,
  accuracyScore: 9,
  weakestPhoneme: "θ",
  weakestWord: "three",
  attemptOrdinal: 1,
  pronunciationOutcome: "mastered",
  passed: true,
})), "contradictory technical evidence is rejected rather than converted into learner performance");
assert((await repo.getAttempts({ itemId: "coffee:skip" })).length === 0, "technical provider events never become historical learner attempts");
await db.attempts.add(baseAttempt({
  itemId: "raw:unavailable",
  clientAttemptId: UUID_B,
  at: NOW + 3,
  providerStatus: "unavailable",
}));
assert(
  (await repo.getAttempts({ itemId: "raw:unavailable" })).length === 0,
  "legacy/raw unavailable-provider rows are excluded from repository evidence reads",
);
const [conversationStats] = await repo.getCategoryStats();
assert(conversationStats?.attempts === 2, "all non-valid provider evidence is excluded from weakness statistics");

// v12 is additive: a bounded row written by the pre-evidence schema opens unchanged.
const legacyName = `clara-pronunciation-v11-${Date.now()}`;
const legacyDb = new (await import("dexie")).default(legacyName);
legacyDb.version(11).stores({ attempts: "++id, itemId, lessonId, categoryId, phoneme, at, passed" });
const legacyAttempt = baseAttempt({
  clientAttemptId: undefined,
  itemId: "legacy:ship",
  at: NOW - 1,
  score: 0,
  heard: "ship",
});
await legacyDb.table("attempts").add(legacyAttempt);
legacyDb.close();
const upgraded = new ClaraDB(legacyName);
const upgradedLegacy = await upgraded.attempts.where("itemId").equals("legacy:ship").first();
assert(
  stable({ ...upgradedLegacy, id: undefined }) === stable({ ...legacyAttempt, id: undefined }),
  "Dexie v12 leaves a bounded legacy attempt readable and unchanged",
);
assert(upgradedLegacy?.pronunciationScore === undefined, "legacy missing evidence remains missing");
upgraded.close();

// The cloud boundary is explicit because privacy and owner attribution can
// regress even while local storage tests stay green.
const cloud = sync.serializeAttemptForCloud("pronunciation-owner-a", complete);
assert(cloud?.profile_id === "pronunciation-owner-a", "cloud owner comes from the authenticated call context");
assert(cloud?.pronunciation_score === 0, "cloud serialization preserves a measured zero");
assert(
  cloud?.score === 81.6 && cloud?.fluency === 74.6 && cloud?.target_phoneme_score === 74.6,
  "cloud serialization preserves fractional scores",
);
assert(cloud?.client_attempt_id === UUID_A, "stable client attempt identity is serialized");
const cloudMissingPartner = sync.serializeAttemptForCloud(
  "pronunciation-owner-a",
  baseAttempt({ clientAttemptId: UUID_B, heardPartner: undefined }),
);
assert(cloudMissingPartner?.heard_partner === null, "cloud serialization preserves missing heard-partner evidence instead of coercing it to false");
assert(
  sync.serializeAttemptForCloud("pronunciation-owner-a", baseAttempt({ clientAttemptId: undefined })) === null,
  "new cloud serialization rejects a missing client UUID instead of creating a legacy row",
);
assert(
  sync.serializeAttemptForCloud("pronunciation-owner-a", baseAttempt({ clientAttemptId: "not-a-uuid" })) === null,
  "new cloud serialization rejects a malformed client UUID instead of creating a legacy row",
);
for (const field of ["heard", "transcript", "email", "audio", "audio_url", "blob", "provider_payload", "profileId", "user_id"]) {
  assert(!(field in (cloud ?? {})), `cloud serialization excludes private or caller-owned field ${field}`);
}

const cloudRow = {
  profile_id: "pronunciation-owner-a",
  client_attempt_id: UUID_B,
  item_id: "coffee:zero",
  lesson_id: "coffee-order",
  category_id: "conversation",
  phoneme: "th",
  target: "three coffees",
  heard: "private historical transcript",
  score: 81.6,
  passed: false,
  at: NOW + 4,
  policy_version: "latam-v1",
  provider_status: "valid",
  pronunciation_score: 0,
  accuracy_score: null,
  target_phoneme_score: 74.6,
  fluency: 74.6,
  weakest_phoneme: "θ",
  raw_provider_json: { secret: true },
};
const restored = sync.restoreAttemptFromCloud(cloudRow, "pronunciation-owner-a");
assert(restored?.pronunciationScore === 0, "restore preserves zero distinctly from null/missing");
assert(restored?.accuracyScore === undefined, "restore keeps a missing score missing");
assert(
  restored?.score === 81.6 && restored?.fluency === 74.6 && restored?.targetPhonemeScore === 74.6,
  "restore preserves threshold-sensitive fractional scores",
);
assert(restored?.clientAttemptId === UUID_B, "restore preserves stable client identity");
assert(restored?.heard === undefined, "restore does not repopulate a learner transcript from cloud");
assert(!("raw_provider_json" in (restored ?? {})), "restore drops unknown provider fields");
assert(sync.restoreAttemptFromCloud(cloudRow, "pronunciation-owner-b") === null, "restore rejects a row assigned to another owner");
const legacyCloudRow = { ...cloudRow, item_id: "legacy:cloud", at: NOW + 6 };
delete legacyCloudRow.client_attempt_id;
const restoredLegacy = sync.restoreAttemptFromCloud(legacyCloudRow, "pronunciation-owner-a");
assert(restoredLegacy?.itemId === "legacy:cloud", "a bounded genuine legacy cloud row remains restorable without a UUID");
assert(restoredLegacy?.clientAttemptId === undefined, "legacy restore keeps missing client identity missing");

await db.attempts.add(baseAttempt({
  clientAttemptId: undefined,
  itemId: "legacy:repository-read",
  at: NOW + 7,
}));
const [legacyRead] = await repo.getAttempts({ itemId: "legacy:repository-read" });
assert(legacyRead?.itemId === "legacy:repository-read", "bounded UUID-less IndexedDB history remains readable");
assert(legacyRead?.clientAttemptId === undefined, "legacy repository reads do not manufacture a client UUID");

// Client identity is the primary merge key. Legacy fallback includes the whole
// bounded attempt identity, so two different attempts in one millisecond survive.
const sameTime = NOW + 5;
const local = [baseAttempt({ clientAttemptId: UUID_A, itemId: "local", at: sameTime })];
const remote = [
  baseAttempt({ clientAttemptId: UUID_A, itemId: "retry-copy", at: sameTime }),
  baseAttempt({ clientAttemptId: UUID_B, itemId: "second", at: sameTime }),
  baseAttempt({ clientAttemptId: undefined, itemId: "legacy-a", at: sameTime }),
  baseAttempt({ clientAttemptId: undefined, itemId: "legacy-b", at: sameTime }),
];
const merged = mergeAttemptHistory(local, remote);
assert(merged.length === 3, "merge removes the client-id retry while preserving three distinct same-millisecond attempts");
assert(merged.some((a) => a.clientAttemptId === UUID_B), "a second stable-id attempt at the same timestamp survives");
assert(merged.filter((a) => a.clientAttemptId === undefined).length === 2, "legacy composite fallback preserves distinct same-millisecond attempts");

// Every cloud-synced optional field participates in legacy identity. Each row
// below differs from the local row in exactly one field; 0 and false must not
// collapse into the missing marker. Private recognized text is excluded.
const canonicalLegacy = baseAttempt({
  clientAttemptId: undefined,
  itemId: "legacy:canonical",
  at: NOW + 8,
  heard: "private version one",
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
const optionalLegacyVariants = [
  { heardPartner: false },
  { fluency: 0 },
  { policyVersion: "latam-v1" },
  { providerStatus: "valid" },
  { pronunciationScore: 0 },
  { accuracyScore: 0 },
  { completenessScore: 0 },
  { prosodyScore: 0 },
  { targetPhonemeScore: 0 },
  { weakestPhoneme: "θ" },
  { weakestWord: "three" },
  { attemptOrdinal: 1 },
  { pronunciationOutcome: "practiced-not-mastered" },
];
const canonicalMerged = mergeAttemptHistory(
  [canonicalLegacy],
  [
    { ...canonicalLegacy },
    { ...canonicalLegacy, heard: "different private recognition" },
    ...optionalLegacyVariants.map((variant) => ({ ...canonicalLegacy, ...variant })),
  ],
);
assert(canonicalMerged.length === optionalLegacyVariants.length, "every one-field legacy evidence difference survives while exact/private-text duplicates dedupe");
for (const variant of optionalLegacyVariants) {
  const [field, expected] = Object.entries(variant)[0];
  assert(canonicalMerged.some((attempt) => attempt[field] === expected), `legacy identity distinguishes ${field} from missing`);
}

// A persistence scope is captured before speech/provider awaits. Once the app
// binds another learner, that opaque scope must fail closed instead of letting
// A's finished capture resolve through the global proxy into B's database.
await bindLocalDb("pron-binding-a");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "pron-binding-a" });
const capturedA = repo.capturePracticeBinding?.();
assert(Boolean(capturedA), "pronunciation persistence exposes an opaque concrete account binding");
await bindLocalDb("pron-binding-b");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "pron-binding-b" });
const staleMutation = { attempt: baseAttempt({
  clientAttemptId: "88888888-8888-4888-8888-888888888888",
  itemId: "binding:stale",
  categoryId: "binding",
  at: NOW + 80,
}) };
await rejects(
  () => repo.commitPracticeAttempt(capturedA, staleMutation),
  "a binding captured for A explicitly rejects after rebinding to B",
);
assert((await db.attempts.count()) === 0, "a stale A commit never enters B's database");
await bindLocalDb("pron-binding-a");
assert((await db.attempts.count()) === 0, "a pre-commit account switch also leaves A unchanged");

console.log(`pronunciation persistence: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
