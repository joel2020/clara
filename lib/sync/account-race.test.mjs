// npx tsx lib/sync/account-race.test.mjs
//
// Deterministic account-switch races for cloud restore/hydrate. A request that
// began for A may resolve after the app has rebound to B; no A result may touch
// either concrete database after that generation change.
import "fake-indexeddb/auto";

globalThis.window = globalThis;

const { bindLocalDb, db } = await import("../db/dexie.ts");
const { restoreProfile, hydrateFromCloud } = await import("./restore.ts");

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const emptyExtras = {
  pullExamsAndCalls: async () => null,
  pullTalkSessions: async () => null,
  pullConvItemsAndQuests: async () => null,
  pullCustomLessons: async () => [],
};
const player = {
  id: "player",
  xp: 999,
  currentStreak: 4,
  longestStreak: 5,
  lastActiveDay: "2026-08-09",
  todayKey: "2026-08-09",
  todayXp: 20,
  totalAttempts: 10,
  totalPasses: 8,
  bestCombo: 3,
  achievements: [],
  updatedAt: 10,
};

// Full restore: defer the first cloud read, switch to B, then release A.
await bindLocalDb("restore-race-a");
let restoreStarted = false;
const restoreGate = deferred();
const restoreSource = {
  ...emptyExtras,
  getProfile: async () => {
    restoreStarted = true;
    return restoreGate.promise;
  },
  pullProfileData: async () => ({
    attempts: [{
      clientAttemptId: "11111111-1111-4111-8111-111111111111",
      itemId: "a:item",
      lessonId: "a",
      categoryId: "conversation",
      phoneme: "th",
      target: "three",
      score: 81.6,
      passed: true,
      at: Date.UTC(2026, 7, 9, 12),
    }],
    progress: [{ itemId: "a:item", lessonId: "a", categoryId: "conversation", phoneme: "th", attempts: 1, passes: 1, box: 1, dueAt: 1, updatedAt: 1 }],
    player,
  }),
  pullPlayerAndProgress: async () => ({ progress: [], player: null }),
  pullSettings: async () => null,
};
const restoring = restoreProfile("restore-race-a", restoreSource);
await tick();
assert(restoreStarted, "restore accepts an injectable cloud source and is deterministically paused");
if (restoreStarted) {
  await bindLocalDb("restore-race-b");
  restoreGate.resolve({ id: "restore-race-a", name: "A", coachLanguage: "es" });
}
const restoreResult = await restoring;
assert(restoreResult === null, "stale full restore aborts after the account generation changes");
assert((await db.attempts.count()) === 0 && (await db.progress.count()) === 0, "stale A restore writes nothing into rebound B");
await bindLocalDb("restore-race-a");
assert((await db.attempts.count()) === 0 && (await db.progress.count()) === 0, "stale A restore also performs no late writes into closed A");

// Launch hydrate: both fetches begin, player response resolves after switch.
await bindLocalDb("hydrate-race-a");
let hydrateStarted = false;
const hydrateGate = deferred();
const hydrateSource = {
  ...emptyExtras,
  getProfile: async () => null,
  pullProfileData: async () => null,
  pullPlayerAndProgress: async () => {
    hydrateStarted = true;
    return hydrateGate.promise;
  },
  pullSettings: async () => ({ dailyGoal: 55 }),
};
const hydrating = hydrateFromCloud("hydrate-race-a", hydrateSource);
await tick();
assert(hydrateStarted, "hydrate accepts an injectable cloud source and is deterministically paused");
if (hydrateStarted) {
  await bindLocalDb("hydrate-race-b");
  hydrateGate.resolve({
    progress: [{ itemId: "hydrate:item", lessonId: "h", categoryId: "conversation", phoneme: "r", attempts: 1, passes: 1, box: 1, dueAt: 1, updatedAt: 1 }],
    player,
  });
}
const hydrateResult = await hydrating;
assert(hydrateResult === null, "stale hydrate returns no settings patch for the rebound account");
assert((await db.progress.count()) === 0 && (await db.player.count()) === 0, "stale hydrate writes no A player/progress into B");
await bindLocalDb("hydrate-race-a");
assert((await db.progress.count()) === 0 && (await db.player.count()) === 0, "stale hydrate performs no late writes into A");

// Authless/local mode still supports the remembered legacy sync code. It is a
// concrete null-account binding, and gains the same generation protection.
await bindLocalDb(null);
const legacySource = {
  ...emptyExtras,
  getProfile: async () => ({ id: "legacy-code", name: "Legacy", coachLanguage: "es" }),
  pullProfileData: async () => ({
    attempts: [{
      clientAttemptId: "33333333-3333-4333-8333-333333333333",
      itemId: "legacy:item",
      lessonId: "legacy",
      categoryId: "conversation",
      phoneme: "r",
      target: "right",
      score: 82.5,
      passed: true,
      at: Date.UTC(2026, 7, 9, 13),
    }],
    progress: [],
    player: null,
  }),
  pullPlayerAndProgress: async () => ({ progress: [], player: null }),
  pullSettings: async () => null,
};
const legacyResult = await restoreProfile("legacy-code", legacySource);
assert(legacyResult?.attempts === 1, "remembered sync-code restore remains available in local mode");
assert((await db.attempts.count()) === 1, "local-mode restore writes only to the captured legacy database");

console.log(`account restore races: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
