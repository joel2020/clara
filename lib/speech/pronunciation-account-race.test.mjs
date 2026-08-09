// node --experimental-strip-types lib/speech/pronunciation-account-race.test.mjs
import "fake-indexeddb/auto";

globalThis.window = globalThis;

const { bindLocalDb, captureDbBinding, db } = await import("../db/dexie.ts");
const { DexieRepository } = await import("../db/dexie-repository.ts");
const { DEFAULT_SETTINGS } = await import("../db/repository.ts");
const { advanceDailyPronunciationGame, createDailyPronunciationGameState } = await import("./daily-pronunciation-game.ts");

let ok = 0, fail = 0;
const assert = (condition, message) => { if (condition) ok++; else { fail++; console.log("FAIL", message); } };
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const names = (phase) => ({ a: `race-${phase}-a-${suffix}`, b: `race-${phase}-b-${suffix}` });
const makeIntent = (clientAttemptId) => ({
  attempt: {
    clientAttemptId,
    itemId: "race:three",
    lessonId: "race",
    categoryId: "conversation",
    phoneme: "θ",
    target: "three",
    score: 92,
    passed: true,
    at: Date.UTC(2026, 7, 9, 14),
  },
  progress: { passed: true, score: 92 },
  reward: { passed: true, combo: 1, score: 92, xpAward: 10, masteryStars: 3 },
  quest: true,
});

async function seedAndCapture(account) {
  await bindLocalDb(account);
  await db.settings.put({ ...DEFAULT_SETTINGS, profileId: account });
  const repo = new DexieRepository();
  return { repo, token: repo.capturePracticeBinding(), concrete: captureDbBinding().database };
}

const raceTargets = ["three", "Thursday", "thank you"].map((text, index) => ({ id: `race:${index}`, text, ipa: "/θ/", mouthHint: "", kind: index === 2 ? "phrase" : "word", categoryId: "race", phoneme: "θ" }));
const dailyRow = (account, game, state) => ({
  id: `daily:${account}:2026-08-09`, version: 2, profileId: account, day: "2026-08-09",
  objective: { es: "Objetivo", en: "Objective" }, outcome: { es: "Resultado", en: "Outcome" }, assistance: "spanish-full",
  activities: [{ id: "speak", kind: "speak", title: { es: "Habla", en: "Speak" }, targetIds: raceTargets.map((target) => target.id), sourceId: "race", reason: "transfer", estimatedMinutes: 2, status: "active", pronunciation: { mode: "scored", game, selectionSource: "curriculum-fallback", targets: raceTargets, itemPool: raceTargets, state } }],
  currentActivityId: "speak", rewardClaimed: false, startedAt: null, completedAt: null, createdAt: 1, updatedAt: 1,
});

async function counts(account) {
  await bindLocalDb(account);
  return {
    attempts: await db.attempts.count(),
    progress: await db.progress.count(),
    player: await db.player.count(),
    quests: await db.quests.count(),
    outbox: await db.outbox.count(),
  };
}

// A diagnosis-history read is tied to the capture binding as strictly as the
// write. Switching after the concrete A query resolves makes the read reject;
// the caller can never continue with B's history under A's speech result.
{
  const account = names("history");
  await bindLocalDb(account.b);
  const bConcrete = captureDbBinding().database;
  const { repo, token, concrete } = await seedAndCapture(account.a);
  await repo.recordAttempt(makeIntent("40000000-0000-4000-8000-000000000000").attempt);
  await bConcrete.open();
  const originalWhere = concrete.attempts.where.bind(concrete.attempts);
  concrete.attempts.where = (...args) => {
    const clause = originalWhere(...args);
    const originalEquals = clause.equals.bind(clause);
    clause.equals = (...equalsArgs) => {
      const collection = originalEquals(...equalsArgs);
      const originalToArray = collection.toArray.bind(collection);
      collection.toArray = async () => {
        const rows = await originalToArray();
        globalThis.__claraDb = bConcrete;
        globalThis.__claraDbAccount = account.b;
        globalThis.__claraDbGeneration = (globalThis.__claraDbGeneration ?? 0) + 1;
        return rows;
      };
      return collection;
    };
    return clause;
  };
  const rejected = await repo.getAttemptsForPracticeBinding(token, { itemId: "race:three", limit: 80 }).then(() => false, () => true);
  concrete.attempts.where = originalWhere;
  assert(rejected, "a binding-scoped history read rejects when its account changes after the concrete query");
  assert((await db.attempts.count()) === 0, "a stale A history read never resolves through B's attempt table");
}

// Switch during transaction-fresh precommit reads: A rolls back and B is clean.
{
  const account = names("read");
  const { repo, token, concrete } = await seedAndCapture(account.a);
  const originalGet = concrete.settings.get.bind(concrete.settings);
  concrete.settings.get = async (...args) => {
    const value = await originalGet(...args);
    await bindLocalDb(account.b);
    return value;
  };
  const rejected = await repo.commitPracticeAttempt(token, makeIntent("41111111-1111-4111-8111-111111111111")).then(() => false, () => true);
  concrete.settings.get = originalGet;
  assert(rejected, "an account switch during transaction-fresh reads rejects the commit");
  assert(Object.values(await counts(account.b)).every((n) => n === 0), "a read-phase race never writes A data into B");
  assert(Object.values(await counts(account.a)).every((n) => n === 0), "a read-phase race rolls back A completely");
}

// Switch after the append but before dependent writes: the whole A unit aborts.
{
  const account = names("inside");
  await bindLocalDb(account.b);
  const bConcrete = captureDbBinding().database;
  const { repo, token, concrete } = await seedAndCapture(account.a);
  await bConcrete.open();
  const originalAdd = concrete.attempts.add.bind(concrete.attempts);
  concrete.attempts.add = async (...args) => {
    const key = await originalAdd(...args);
    // Flip the active generation synchronously at the exact IndexedDB boundary;
    // the callback's next guard must reject so Dexie can roll back this unit.
    globalThis.__claraDb = bConcrete;
    globalThis.__claraDbAccount = account.b;
    globalThis.__claraDbGeneration = (globalThis.__claraDbGeneration ?? 0) + 1;
    return key;
  };
  const rejected = await repo.commitPracticeAttempt(token, makeIntent("42222222-2222-4222-8222-222222222222")).then(() => false, () => true);
  concrete.attempts.add = originalAdd;
  assert(rejected, "an account switch inside the write transaction rejects the commit");
  assert(Object.values(await counts(account.b)).every((n) => n === 0), "an in-transaction race never writes A data into B");
  assert(Object.values(await counts(account.a)).every((n) => n === 0), "an in-transaction race rolls back A's partial append");
}

// Switch after IndexedDB commits but before the caller receives success: A is
// durably complete (including retry rows), B remains untouched, caller fails closed.
{
  const account = names("after");
  const { repo, token, concrete } = await seedAndCapture(account.a);
  const originalTransaction = concrete.transaction.bind(concrete);
  concrete.transaction = async (...args) => {
    const value = await originalTransaction(...args);
    await bindLocalDb(account.b);
    return value;
  };
  const rejected = await repo.commitPracticeAttempt(token, makeIntent("43333333-3333-4333-8333-333333333333")).then(() => false, () => true);
  concrete.transaction = originalTransaction;
  assert(rejected, "a switch after local commit fails closed instead of reporting the wrong account success");
  assert(Object.values(await counts(account.b)).every((n) => n === 0), "a postcommit race leaves B unchanged");
  const a = await counts(account.a);
  assert(a.attempts === 1 && a.progress === 1 && a.player === 1 && a.quests === 1, "a postcommit race leaves A's local unit complete");
}

// Every non-attempt game checkpoint captures A before its UI action. A switch
// after the concrete daily-row read rejects listen, choice, technical, and
// graded-resolution routes without creating anything in B.
for (const route of ["listen", "choose", "technical", "resolve"]) {
  const account = names(`checkpoint-${route}`);
  await bindLocalDb(account.b);
  const bConcrete = captureDbBinding().database;
  const { repo, token, concrete } = await seedAndCapture(account.a);
  await bConcrete.open();
  const game = route === "listen" || route === "choose" ? "beat-the-twin" : "sound-sprint";
  let current = createDailyPronunciationGameState(game, raceTargets);
  if (route === "choose") current = advanceDailyPronunciationGame(current, { type: "listen", targetIndex: 0 });
  if (route === "resolve") current = advanceDailyPronunciationGame(current, { type: "attempt", event: { id: "49999999-9999-4999-8999-999999999999", targetIndex: 0, outcome: "mastered", score: 92, ordinal: 1, at: 1 } });
  const originalRow = dailyRow(account.a, game, current);
  await concrete.dailySessions.put(originalRow);
  const next = route === "listen"
    ? advanceDailyPronunciationGame(current, { type: "listen", targetIndex: 0 })
    : route === "choose"
      ? advanceDailyPronunciationGame(current, { type: "choose", targetIndex: 0, choiceId: raceTargets[0].id })
      : route === "technical"
        ? advanceDailyPronunciationGame(current, { type: "resolve", targetIndex: 0, resolution: "technical" })
        : advanceDailyPronunciationGame(current, { type: "resolve", targetIndex: 0, resolution: "graded-mastered" });
  const originalWhere = concrete.dailySessions.where.bind(concrete.dailySessions);
  concrete.dailySessions.where = (...args) => {
    const clause = originalWhere(...args);
    const originalEquals = clause.equals.bind(clause);
    clause.equals = (...equalsArgs) => {
      const collection = originalEquals(...equalsArgs);
      const originalFirst = collection.first.bind(collection);
      collection.first = async () => {
        const row = await originalFirst();
        globalThis.__claraDb = bConcrete;
        globalThis.__claraDbAccount = account.b;
        globalThis.__claraDbGeneration = (globalThis.__claraDbGeneration ?? 0) + 1;
        return row;
      };
      return collection;
    };
    return clause;
  };
  const rejected = await repo.checkpointDailyPronunciation(token, { day: originalRow.day, activityId: "speak", contentHash: current.contentHash, state: next, at: 2 }).then(() => false, () => true);
  concrete.dailySessions.where = originalWhere;
  assert(rejected, `${route} checkpoint rejects after its captured account changes`);
  assert((await bConcrete.dailySessions.count()) === 0 && (await bConcrete.outbox.count()) === 0, `${route} checkpoint never mutates B`);
  const unchanged = await concrete.dailySessions.get(originalRow.id);
  assert(JSON.stringify(unchanged) === JSON.stringify(originalRow), `${route} checkpoint rolls A back unchanged`);
}

// A shipped v1 migration is the same captured-account checkpoint: switching
// after its source row is read rolls A back and cannot create B data.
{
  const account = names("legacy-migration");
  await bindLocalDb(account.b);
  const bConcrete = captureDbBinding().database;
  const { repo, token, concrete } = await seedAndCapture(account.a);
  await bConcrete.open();
  const legacyTargets = ["th:three", "th:both", "th:thank"].map((id) => ({ id, text: "untrusted" }));
  const originalRow = {
    id: `daily:${account.a}:2026-08-10`, version: 1, profileId: account.a, day: "2026-08-10",
    objective: { es: "Objetivo", en: "Objective" }, outcome: { es: "Resultado", en: "Outcome" }, assistance: "spanish-full",
    activities: [{ id: "speak", kind: "speak", title: { es: "Habla", en: "Speak" }, targetIds: legacyTargets.map(({ id }) => id), sourceId: "th", reason: "transfer", estimatedMinutes: 2, status: "active", pronunciation: { mode: "scored", game: "sound-sprint", selectionSource: "latam-prior", feature: "th", targets: legacyTargets } }],
    currentActivityId: "speak", rewardClaimed: false, startedAt: 1, completedAt: null, createdAt: 1, updatedAt: 1,
  };
  await concrete.dailySessions.put(originalRow);
  const originalWhere = concrete.dailySessions.where.bind(concrete.dailySessions);
  concrete.dailySessions.where = (...args) => {
    const clause = originalWhere(...args);
    const originalEquals = clause.equals.bind(clause);
    clause.equals = (...equalsArgs) => {
      const collection = originalEquals(...equalsArgs);
      const originalFirst = collection.first.bind(collection);
      collection.first = async () => {
        const row = await originalFirst();
        globalThis.__claraDb = bConcrete;
        globalThis.__claraDbAccount = account.b;
        globalThis.__claraDbGeneration = (globalThis.__claraDbGeneration ?? 0) + 1;
        return row;
      };
      return collection;
    };
    return clause;
  };
  const rejected = await repo.replaceCorruptDailyPronunciation(token, { day: originalRow.day, activityId: "speak", at: 2 }).then(() => false, () => true);
  concrete.dailySessions.where = originalWhere;
  assert(rejected, "a shipped v1 migration rejects after its captured account changes");
  assert((await bConcrete.dailySessions.count()) === 0 && (await bConcrete.outbox.count()) === 0, "a shipped v1 migration never mutates B");
  const unchanged = await concrete.dailySessions.get(originalRow.id);
  assert(JSON.stringify(unchanged) === JSON.stringify(originalRow), "a shipped v1 migration rolls A back unchanged");
}

console.log(`pronunciation account race: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
