// npx tsx lib/closet-progress-persistence.test.mjs
import "fake-indexeddb/auto";
import Dexie from "dexie";

globalThis.window = globalThis;

const { bindLocalDb, db, ClaraDB } = await import("./db/dexie.ts");
const { DexieRepository } = await import("./db/dexie-repository.ts");
const { FIRST_PASSED_INTERVIEW_CALL } = await import("./milestone.ts");

let ok = 0, fail = 0;
const check = (condition, message) => {
  if (condition) ok++;
  else { fail++; console.log("FAIL", message); }
};

await bindLocalDb("closet-progress-test");
const repo = new DexieRepository();
const legacyDefault = await repo.getPlayerStats();
check(legacyDefault.completedDailySessions === 0, "new and legacy players default to zero completed sessions");
check(legacyDefault.unlockedMilestones.length === 0, "new and legacy players default to no milestones");

await repo.saveCallScore({ scenarioId: "double-charge", at: 100, score: 79, checks: {} });
check((await repo.getPlayerStats()).unlockedMilestones.length === 0, "a failed call does not persist the milestone");

await repo.saveCallScore({ scenarioId: "double-charge", at: 200, score: 80, checks: {} });
await repo.saveCallScore({ scenarioId: "wrong-item", at: 300, score: 95, checks: {} });
const earned = await repo.getPlayerStats();
check(
  earned.unlockedMilestones.filter((id) => id === FIRST_PASSED_INTERVIEW_CALL).length === 1,
  "passing calls persist the Closet milestone exactly once",
);

// Exercise the actual v13 → v14 Dexie upgrade instead of relying only on read defaults.
const legacyName = "clara-closet-v13-upgrade-test";
const old = new Dexie(legacyName);
old.version(13).stores({ player: "id" });
await old.table("player").put({ id: "player", xp: 7, updatedAt: 1 });
old.close();
const upgraded = new ClaraDB(legacyName);
const migrated = await upgraded.player.get("player");
check(migrated?.completedDailySessions === 0, "Dexie v14 backfills the lifetime counter");
check(Array.isArray(migrated?.unlockedMilestones) && migrated.unlockedMilestones.length === 0, "Dexie v14 backfills the milestone set");
upgraded.close();
await Dexie.delete(legacyName);
db.close();

console.log(`${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
