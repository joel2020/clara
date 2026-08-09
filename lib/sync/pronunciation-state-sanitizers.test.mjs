// node --experimental-strip-types lib/sync/pronunciation-state-sanitizers.test.mjs
const {
  DEFAULT_PLAYER,
  playerOutboxPayload,
  progressOutboxPayload,
  questOutboxPayload,
} = await import("../db/repository.ts");

let ok = 0, fail = 0;
const assert = (condition, message) => { if (condition) ok++; else { fail++; console.log("FAIL", message); } };
const now = Date.UTC(2026, 7, 9, 15);

const progress = progressOutboxPayload({
  itemId: "coffee:one", lessonId: "coffee", categoryId: "conversation", phoneme: "f",
  attempts: 2, passes: 1, box: 0, dueAt: now, lastResult: "fail", lastScore: 72, updatedAt: now,
  profileId: "attacker", transcript: "private", providerPayload: { raw: true },
});
assert(progress?.itemId === "coffee:one", "valid progress survives the strict retry boundary");
assert(progress && !("profileId" in progress) && !("transcript" in progress) && !("providerPayload" in progress), "progress retry drops ownership and unexpected/private fields");
assert(progressOutboxPayload({ ...progress, passes: 3 }) === null, "impossible progress counters are rejected");

const player = playerOutboxPayload({
  ...DEFAULT_PLAYER, xp: 10, totalAttempts: 1, totalPasses: 1, stars: 3, updatedAt: now,
  profileId: "attacker", email: "private@example.test", avatarBase: "private-local-avatar",
});
assert(player?.xp === 10 && player.stars === 3, "valid cumulative player state survives the strict retry boundary");
assert(player && !("profileId" in player) && !("email" in player) && !("avatarBase" in player), "player retry drops ownership, PII, and device-local avatar fields");
assert(playerOutboxPayload({ ...DEFAULT_PLAYER, xp: Number.NaN }) === null, "non-finite player totals are rejected");

const quest = questOutboxPayload({ day: "2026-08-09", talk: 1, review: 2, learn: 3, claimed: false, profileId: "attacker", note: "private" });
assert(quest?.review === 2 && !("profileId" in quest) && !("note" in quest), "quest retry keeps only bounded quest state");
assert(questOutboxPayload({ ...quest, day: "tomorrow" }) === null, "malformed quest days are rejected");

console.log(`pronunciation state sanitizers: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
