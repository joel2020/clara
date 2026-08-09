import "fake-indexeddb/auto";
import { bindLocalDb, captureDbBinding, db } from "./db/dexie.ts";
import { DexieRepository } from "./db/dexie-repository.ts";
import { DEFAULT_SETTINGS, StaleExamLevelError } from "./db/repository.ts";

let ok = 0, fail = 0;
const assert = (condition, message) => condition ? ok++ : (fail++, console.log("FAIL", message));
const attempt = (overrides = {}) => ({
  day: "2026-08-09", at: 100, level: "A1", score: 91, passed: true,
  sections: { readAloud: 90, repeat: 92, build: 91, shortAnswer: 90, retell: 91, openResponse: 92 }, weakest: "readAloud",
  gradePaths: { readAloud: "azure", repeat: "azure" }, ...overrides,
});
const identity = (overrides = {}) => ({
  day: "2026-08-09", sourceLevel: "A1", candidateLevel: "A2",
  seed: "2026-08-09:A2", contentVersion: "stage-content-v1", contentHash: "0123456789abcdef",
  ...overrides,
});
const checkpoint = (overrides = {}) => ({
  id: "active", version: 1, sequence: 0, sessionId: "session-a", profileId: "exam-bound-a",
  ...identity(), startedAt: 100, status: "running", sectionIdx: 0, itemIdx: 0,
  scores: {}, gradePaths: {}, speaking: { status: "ready", learnerMisses: 0, validAcousticAttempts: 0 },
  ...overrides,
});

globalThis.window = globalThis;
await bindLocalDb("exam-bound-a");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "exam-bound-a", onboarding: { name: "Ana", country: "Colombia", city: "Medellín", goal: "fluency", dailyMinutes: 10, selfLevel: "beginner", level: "A1", completedAt: 1 } });
const repo = new DexieRepository();
const binding = repo.capturePracticeBinding();
await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint(), null);
const restored = await repo.getExamCheckpointForPracticeBinding(binding, identity());
assert(restored?.startedAt === 100, "a real Dexie checkpoint survives repository reload");
await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint({ sequence: 1, itemIdx: 1 }), { sessionId: "session-a", sequence: 0 });
const staleWriteRejected = await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint({ sequence: 1 })).then(() => false, () => true);
assert(staleWriteRejected && (await db.examCheckpoints.get("active")).itemIdx === 1, "checkpoint transitions are monotonic");
const staleClearRejected = await repo.clearExamCheckpointForPracticeBinding(binding, { sessionId: "session-a", sequence: 0 }).then(() => false, () => true);
assert(staleClearRejected && await db.examCheckpoints.count() === 1, "a stale component cannot clear a newer checkpoint after CAS conflict");
const promoted = { name: "Ana", country: "Colombia", city: "Medellín", goal: "fluency", dailyMinutes: 10, selfLevel: "beginner", level: "A2", completedAt: 1 };
await repo.saveExamAttemptForPracticeBinding(binding, attempt(), promoted, identity(), { sessionId: "session-a", sequence: 1 });
await repo.saveExamAttemptForPracticeBinding(binding, attempt(), promoted, identity());
assert(await db.examAttempts.count() === 1, "replaying a final exam save is exact-once");
assert((await db.settings.get("app")).onboarding.level === "A2", "the passed sitting and level promotion commit atomically");
assert(await db.examCheckpoints.count() === 0, "completion deletes the matching checkpoint atomically");
assert(await db.outbox.where("kind").equals("exam-completion").count() === 1, "completion queues one combined cloud transaction exactly once");
const conflictRejected = await repo.saveExamAttemptForPracticeBinding(binding, attempt({ score: 70 }), promoted).then(() => false, () => true);
assert(conflictRejected && await db.examAttempts.count() === 1, "a mutated replay with the same sitting id is rejected");
const failedPromotionRejected = await repo.saveExamAttemptForPracticeBinding(binding, attempt({ at: 101, passed: false }), promoted).then(() => false, () => true);
assert(failedPromotionRejected && await db.examAttempts.count() === 1, "a failed sitting cannot partially persist a promotion");

await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint({ sessionId: "session-old", day: "2026-08-08" }), null);
assert(await repo.getExamCheckpointForPracticeBinding(binding, identity()) === null && await db.examCheckpoints.count() === 1, "an identity mismatch is hidden but preserved without destructive cleanup");
assert((await repo.peekExamCheckpointForPracticeBinding(binding))?.sessionId === "session-old", "the readonly owner-bound probe can recover the frozen sitting");
await repo.clearExamCheckpointForPracticeBinding(binding, { sessionId: "session-old", sequence: 0 });
await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint({ sessionId: "session-void" }), null);
await repo.clearExamCheckpointForPracticeBinding(binding, { sessionId: "session-void", sequence: 0 });
assert(await db.examCheckpoints.count() === 0, "a technical void clears the durable sitting");

const accepted = checkpoint({
  sessionId: "session-pending", status: "pending-advance", scores: { build: [100] }, gradePaths: { build: ["mechanical"] },
  pendingAdvance: { completedSectionIdx: 2, completedItemIdx: 0, nextSectionIdx: 2, nextItemIdx: 1, feedback: null, delayMs: 400 },
  sectionIdx: 2, itemIdx: 0,
});
await repo.saveExamCheckpointForPracticeBinding(binding, accepted, null);
const acceptedReload = await repo.getExamCheckpointForPracticeBinding(binding, identity());
assert(acceptedReload?.status === "pending-advance" && acceptedReload.scores.build.length === 1, "an accepted answer survives interruption before its feedback timer");
await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint({ sessionId: "session-pending", sequence: 1, sectionIdx: 2, itemIdx: 1, scores: { build: [100] }, gradePaths: { build: ["mechanical"] } }), { sessionId: "session-pending", sequence: 0 });
const duplicateAdvance = await repo.saveExamCheckpointForPracticeBinding(binding, checkpoint({ sessionId: "session-pending", sequence: 1, sectionIdx: 2, itemIdx: 1, scores: { build: [100, 100] }, gradePaths: { build: ["mechanical", "mechanical"] } }), { sessionId: "session-pending", sequence: 0 }).then(() => false, () => true);
assert(duplicateAdvance && (await db.examCheckpoints.get("active")).scores.build.length === 1, "timer/Continue races advance an accepted score exactly once");
await repo.clearExamCheckpointForPracticeBinding(binding, { sessionId: "session-pending", sequence: 1 });

await bindLocalDb("invalid-pass-missing");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "invalid-pass-missing", onboarding: { ...promoted, level: "A1" } });
const missingRepo = new DexieRepository();
const missingBinding = missingRepo.capturePracticeBinding();
const missingPromotionRejected = await missingRepo.saveExamAttemptForPracticeBinding(missingBinding, attempt({ at: 150 })).then(() => false, () => true);
assert(missingPromotionRejected && await db.examAttempts.count() === 0 && await db.outbox.count() === 0
  && (await db.settings.get("app")).onboarding.level === "A1", "a passed attempt without promotion rolls back every local effect");

await bindLocalDb("invalid-pass-wrong");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "invalid-pass-wrong", onboarding: { ...promoted, level: "A1" } });
const wrongRepo = new DexieRepository();
const wrongBinding = wrongRepo.capturePracticeBinding();
const wrongPromotionRejected = await wrongRepo.saveExamAttemptForPracticeBinding(wrongBinding, attempt({ at: 151 }), { ...promoted, level: "C2" }).then(() => false, () => true);
assert(wrongPromotionRejected && await db.examAttempts.count() === 0 && await db.outbox.count() === 0
  && (await db.settings.get("app")).onboarding.level === "A1", "a noncanonical passed promotion rolls back attempt, settings, and outbox");

await bindLocalDb("failed-plain");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "failed-plain", onboarding: { ...promoted, level: "A1" } });
const failedRepo = new DexieRepository();
const failedBinding = failedRepo.capturePracticeBinding();
await failedRepo.saveExamAttemptForPracticeBinding(failedBinding, attempt({ at: 152, score: 60, passed: false }));
assert(await db.examAttempts.count() === 1 && await db.outbox.where("kind").equals("exam").count() === 1
  && (await db.settings.get("app")).onboarding.level === "A1", "a failed exam saves only the plain attempt without promotion");
const inconsistentFailureRejected = await failedRepo.saveExamAttemptForPracticeBinding(failedBinding, attempt({ at: 153, score: 91, passed: false })).then(() => false, () => true);
assert(inconsistentFailureRejected && await db.examAttempts.count() === 1 && await db.outbox.count() === 1, "a high-scoring attempt cannot bypass promotion by claiming it failed");

await bindLocalDb("stale-level");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "stale-level", onboarding: { ...promoted, level: "B2" } });
const staleLevelRepo = new DexieRepository();
const staleLevelBinding = staleLevelRepo.capturePracticeBinding();
await staleLevelRepo.saveExamCheckpointForPracticeBinding(staleLevelBinding, checkpoint({ profileId: "stale-level", sessionId: "stale-level-session" }), null);
const staleLevelError = await staleLevelRepo.saveExamAttemptForPracticeBinding(
  staleLevelBinding, attempt({ at: 154 }), promoted, identity(), { sessionId: "stale-level-session", sequence: 0 },
).then(() => null, (error) => error);
assert(staleLevelError instanceof StaleExamLevelError, "transaction-fresh source mismatch raises the dedicated stale-level domain error");
assert((await db.settings.get("app")).onboarding.level === "B2" && await db.examCheckpoints.count() === 1
  && await db.examAttempts.count() === 0 && await db.outbox.count() === 0, "a later stored level cannot be downgraded and leaves every pass mutation untouched");

await bindLocalDb("exam-bound-b");
const bConcrete = captureDbBinding().database;
await bindLocalDb("exam-race-a");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "exam-race-a" });
const raceRepo = new DexieRepository();
const raceBinding = raceRepo.capturePracticeBinding();
const aConcrete = captureDbBinding().database;
await bConcrete.open();
const originalGet = aConcrete.settings.get.bind(aConcrete.settings);
aConcrete.settings.get = async (...args) => {
  const value = await originalGet(...args);
  globalThis.__claraDb = bConcrete;
  globalThis.__claraDbAccount = "exam-bound-b";
  globalThis.__claraDbGeneration = (globalThis.__claraDbGeneration ?? 0) + 1;
  return value;
};
const rejected = await raceRepo.saveExamAttemptForPracticeBinding(raceBinding, attempt({ at: 200 }), promoted).then(() => false, () => true);
aConcrete.settings.get = originalGet;
assert(rejected, "an account switch during final save rejects the sitting");
assert(await aConcrete.examAttempts.count() === 0, "the stale learner transaction rolls back");
assert(await bConcrete.examAttempts.count() === 0, "the stale sitting never crosses into learner B");

console.log(`exam-persistence: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
