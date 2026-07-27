// npx tsx lib/sync/coverage.test.mjs
//
// The product promise is that a student's progress follows her account, not her
// device. That promise is only as good as the list of things that actually sync,
// and the failure mode is silent: someone adds a Dexie store, ships it, and a
// student loses that data the next time she signs in somewhere else.
//
// So this test reads the source and fails if a store exists with no cloud path.
import { readFileSync } from "node:fs";

let ok = 0, fail = 0;
const check = (cond, m) => { if (cond) ok++; else { fail++; console.log("FAIL", m); } };

const dexie = readFileSync("lib/db/dexie.ts", "utf8");
const repo = readFileSync("lib/db/dexie-repository.ts", "utf8");
const sync = readFileSync("lib/sync/supabase-sync.ts", "utf8");
const restore = readFileSync("lib/sync/restore.ts", "utf8");
// Not all cloud writes live in the sync module: analytics writes events directly
// with the authenticated client, so the coverage check has to look there too.
const analytics = readFileSync("lib/analytics.ts", "utf8");
const cloudWriters = sync + analytics;

// Every table declared on the Dexie class.
const stores = [...dexie.matchAll(/^\s{2}(\w+)!:\s*Table</gm)].map((m) => m[1]);
check(stores.length >= 11, `found the Dexie stores (${stores.length})`);

// Stores that are intentionally device-only, with the reason. Anything NOT here
// must have a cloud write path.
const DEVICE_ONLY = {
  settings: "synced via pushSettings, but the row itself is local config keyed 'app'",
  recordings:
    "her voice audio as Blobs. Deliberately never uploaded: syncing student voice recordings is a privacy decision, and Postgres is the wrong place for audio anyway (Supabase Storage would be).",
};

for (const store of stores) {
  if (store in DEVICE_ONLY) continue;
  // A store is covered if the repository mirrors its writes or sync names it.
  const singular = store.replace(/ies$/, "y").replace(/s$/, "");
  const named = new RegExp(singular, "i");
  const covered = named.test(cloudWriters);
  check(covered, `store "${store}" has a cloud write path (add one, or document it as device-only)`);
}

// The three that were fixed in this pass must specifically be present.
for (const fn of ["pushConvItem", "pushQuests", "pushTalkSession", "pushExamAttempt", "pushCallScore"]) {
  check(sync.includes(`export function ${fn}`), `${fn} exists`);
}

// ...and must actually be CALLED from the repository, not merely defined.
for (const fn of ["pushConvItem", "pushQuests", "pushTalkSession", "pushExamAttempt", "pushCallScore"]) {
  check(repo.includes(fn), `${fn} is called from the repository (defined but unused is the same as broken)`);
}

// The read path must seed everything a fresh device needs.
for (const puller of ["pullProfileData", "pullSettings", "pullExamsAndCalls", "pullTalkSessions", "pullConvItemsAndQuests"]) {
  check(restore.includes(puller), `restore uses ${puller}`);
}

// Every preference a student would notice must round-trip through settings.
for (const col of ["coach_language", "difficulty", "sound_enabled", "instructor_mode", "student_name", "onboarding"]) {
  check(sync.includes(col), `settings sync includes ${col}`);
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
