// node --experimental-strip-types lib/speech/pronunciation-atomic.test.mjs
//
// Real-Dexie pronunciation commit concurrency. Distinct captures may finish at
// the same time; every read-modify-write must therefore happen under the same
// transaction locks as the append and preserve cumulative learner state.
import "fake-indexeddb/auto";

globalThis.window = globalThis;

const { bindLocalDb, db } = await import("../db/dexie.ts");
const { DexieRepository } = await import("../db/dexie-repository.ts");
const { DEFAULT_SETTINGS } = await import("../db/repository.ts");
const { createDailyPronunciationGameState } = await import("./daily-pronunciation-game.ts");

let ok = 0, fail = 0;
const assert = (condition, message) => { if (condition) ok++; else { fail++; console.log("FAIL", message); } };

const NOW = Date.UTC(2026, 7, 9, 14);
const attempt = (clientAttemptId, offset = 0) => ({
  clientAttemptId,
  itemId: "atomic:three",
  lessonId: "atomic",
  categoryId: "conversation",
  phoneme: "θ",
  target: "three",
  score: 94,
  passed: true,
  at: NOW + offset,
});
const intent = (clientAttemptId, offset = 0) => ({
  attempt: attempt(clientAttemptId, offset),
  progress: { passed: true, score: 94 },
  reward: { passed: true, combo: 1, score: 94, xpAward: 10, masteryStars: 3 },
  quest: true,
});

const ACCOUNT = `pron-atomic-${Date.now()}`;
await bindLocalDb(ACCOUNT);
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: null, dailyGoal: 40 });
const repo = new DexieRepository();
const binding = repo.capturePracticeBinding();

const concurrent = await Promise.allSettled([
  repo.commitPracticeAttempt(binding, intent("11111111-1111-4111-8111-111111111111", 1)),
  repo.commitPracticeAttempt(binding, intent("22222222-2222-4222-8222-222222222222", 2)),
]);
const first = concurrent[0].status === "fulfilled" ? concurrent[0].value : null;
const second = concurrent[1].status === "fulfilled" ? concurrent[1].value : null;

assert(first?.status === "committed" && second?.status === "committed", "two overlapping distinct UUIDs both commit");
assert((await db.attempts.count()) === 2, "two overlapping distinct UUIDs preserve both history rows");
const progress = await db.progress.get("atomic:three");
assert(progress?.attempts === 2 && progress.passes === 2 && progress.box === 2, "transaction-fresh SRS accumulates both attempts");
const player = await db.player.get("player");
assert(player?.xp === 20 && player.totalAttempts === 2 && player.totalPasses === 2, "transaction-fresh player XP and counters accumulate both attempts");
assert(player?.stars === 6, "transaction-fresh stars accumulate both rewards");
const quests = await db.quests.get("2026-08-09");
assert(quests?.learn === 1 && quests.review === 1, "the first same-item commit learns and the concurrent follower reviews");
assert(first && second && first.rewards.xpGain + second.rewards.xpGain === 20, "each committed caller receives only its own attempt reward");
assert(first && second && Math.max(first.rewards.newXp, second.rewards.newXp) === 20, "one overlapping result reports the cumulative post-transaction XP");

const duplicateIntent = intent("33333333-3333-4333-8333-333333333333", 3);
const duplicateConcurrent = await Promise.allSettled([
  repo.commitPracticeAttempt(binding, duplicateIntent),
  repo.commitPracticeAttempt(binding, duplicateIntent),
]);
const duplicateFirst = duplicateConcurrent[0].status === "fulfilled" ? duplicateConcurrent[0].value : null;
const duplicateSecond = duplicateConcurrent[1].status === "fulfilled" ? duplicateConcurrent[1].value : null;
assert(
  duplicateFirst && duplicateSecond
    && [duplicateFirst.status, duplicateSecond.status].sort().join(",") === "already-committed,committed",
  "overlapping calls with one UUID produce one commit and one idempotent acknowledgement",
);
assert((await db.attempts.count()) === 3, "same-UUID overlap appends one history row");
assert((await db.progress.get("atomic:three"))?.attempts === 3, "same-UUID overlap applies SRS once");
assert((await db.player.get("player"))?.totalAttempts === 3, "same-UUID overlap applies player reward once");
const questsAfterDuplicate = await db.quests.get("2026-08-09");
assert(questsAfterDuplicate?.review === 2, "same-UUID overlap applies one quest event");

// Quest completion is part of the same fresh transaction, including its
// one-time player bonus; the caller's attempt reward remains attempt-only.
await db.quests.put({ day: "2026-08-09", talk: 1, review: 5, learn: 4, claimed: false });
const xpBeforeQuestBonus = (await db.player.get("player")).xp;
const bonusIntent = intent("44444444-4444-4444-8444-444444444444", 4);
bonusIntent.attempt.itemId = "atomic:new-for-quest";
const bonusCommit = await repo.commitPracticeAttempt(binding, bonusIntent);
const bonusPlayer = await db.player.get("player");
const bonusQuest = await db.quests.get("2026-08-09");
assert(bonusQuest?.learn === 5 && bonusQuest.claimed, "crossing the final quest target claims it exactly once");
assert(bonusPlayer?.xp === xpBeforeQuestBonus + 40, "attempt XP and the one-time quest bonus land in one player write");
assert(bonusCommit.status === "committed" && bonusCommit.rewards.xpGain === 10, "quest bonus does not inflate the caller's per-attempt reward animation");

// A graded daily attempt is one unit: attempt history, learner rewards, daily
// event evidence, and the daily-session retry row either all land or all roll back.
const dailyTargets = ["three", "Thursday", "thank you"].map((text, index) => ({
  id: `atomic:daily:${index}`, text, ipa: "/θ/", mouthHint: "", kind: index === 2 ? "phrase" : "word", categoryId: "atomic", phoneme: "θ",
}));
const dailyState = createDailyPronunciationGameState("sound-sprint", dailyTargets, dailyTargets);
const dailyRow = {
  id: `daily:${ACCOUNT}:2026-08-09`, version: 2, profileId: ACCOUNT, day: "2026-08-09",
  objective: { es: "Objetivo", en: "Objective" }, outcome: { es: "Resultado", en: "Outcome" }, assistance: "spanish-full",
  activities: [{ id: "speak", kind: "speak", title: { es: "Habla", en: "Speak" }, targetIds: dailyTargets.map((target) => target.id), sourceId: "atomic", reason: "transfer", estimatedMinutes: 2, status: "active", pronunciation: { mode: "scored", game: "sound-sprint", selectionSource: "curriculum-fallback", targets: dailyTargets, itemPool: dailyTargets, state: dailyState } }],
  currentActivityId: "speak", rewardClaimed: false, startedAt: null, completedAt: null, createdAt: NOW, updatedAt: NOW,
};
await db.dailySessions.put(dailyRow);
const dailyUuid = "55555555-5555-4555-8555-555555555555";
const dailyIntent = intent(dailyUuid, 5);
dailyIntent.attempt.itemId = dailyTargets[0].id;
dailyIntent.dailyPronunciation = {
  day: dailyRow.day, activityId: "speak", contentHash: dailyState.contentHash, at: NOW + 5,
  event: { id: dailyUuid, targetIndex: 0, outcome: "mastered", score: 94, ordinal: 1, at: NOW + 5 },
};
const failDailyWrite = () => { throw new Error("daily row failure"); };
db.dailySessions.hook("updating").subscribe(failDailyWrite);
const failedAtomic = await repo.commitPracticeAttempt(binding, dailyIntent).then(() => false, () => true);
db.dailySessions.hook("updating").unsubscribe(failDailyWrite);
assert(failedAtomic, "daily-row failure rejects the full graded commit");
assert((await db.attempts.where("clientAttemptId").equals(dailyUuid).count()) === 0, "daily-row failure rolls back the attempt UUID");
assert((await db.dailySessions.get(dailyRow.id)).activities[0].pronunciation.state.attemptEvents.length === 0, "daily-row failure rolls back daily evidence");
const outboxBeforeDaily = await db.outbox.count();
const dailyCommit = await repo.commitPracticeAttempt(binding, dailyIntent);
const dailyRetry = await repo.commitPracticeAttempt(binding, dailyIntent);
const persistedDaily = await db.dailySessions.get(dailyRow.id);
assert(dailyCommit.status === "committed" && dailyRetry.status === "already-committed", "the exact daily UUID retries idempotently once");
assert(persistedDaily.activities[0].pronunciation.state.attemptEvents.length === 1, "the daily UUID creates one event");
assert((await db.outbox.count()) === outboxBeforeDaily + 5, "attempt, progress, player, quest, and daily session share one durable outbox commit");

console.log(`pronunciation atomic: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
