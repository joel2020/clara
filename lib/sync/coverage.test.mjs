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
const dailyStore = readFileSync("lib/daily-session-store.ts", "utf8");
const cloudWriters = sync + analytics;

// Every table declared on the Dexie class.
const stores = [...dexie.matchAll(/^\s{2}(\w+)!:\s*Table</gm)].map((m) => m[1]);
check(stores.length >= 14, `found the Dexie stores (${stores.length})`);

// Stores that are intentionally device-only, with the reason. Anything NOT here
// must have a cloud write path.
const DEVICE_ONLY = {
  settings: "synced through the durable profile-first settings outbox, while the row itself is local config keyed 'app'",
  examCheckpoints:
    "an unfinished stage sitting is deliberately account-local; only its bounded, atomic completion enters the cloud outbox",
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
for (const fn of ["pushConvItem", "pushQuests", "pushTalkSession", "pushExamAttempt", "pushCallScore", "pushDailySession"]) {
  check(sync.includes(`export function ${fn}`), `${fn} exists`);
}

// ...and EVERY exported push* must actually be called somewhere, not merely defined.
// Checking a hand-picked list missed pushCustomLesson, which sat unused for weeks
// while instructor-authored lessons quietly stayed on one device. So the list is
// derived from the source instead of maintained by hand.
const exportedPushers = [...sync.matchAll(/export function (push\w+)/g)].map((m) => m[1]);
check(exportedPushers.length >= 8, `found the exported push functions (${exportedPushers.length})`);
const callers = repo + dailyStore + readFileSync("lib/practice.ts", "utf8") + readFileSync("lib/hooks/useSettings.tsx", "utf8");
for (const fn of exportedPushers) {
  const durableReplacement = fn === "pushAttempt"
    ? sync.includes('kind === "attempt"') && sync.includes("attemptRow(profileId")
    : fn === "pushProgress"
      ? sync.includes('kind === "progress"') && sync.includes("progressRow(profileId")
      : fn === "pushExamAttempt"
        ? sync.includes('kind === "exam-completion"') && sync.includes('.rpc("complete_stage_exam"')
        : false;
  check(callers.includes(fn) || durableReplacement, `${fn} is called or its transactional outbox replacement is wired`);
}
check(sync.includes("export async function pullDailySession"), "pullDailySession exists");
check(dailyStore.includes("pullDailySession"), "daily store pulls the current session before merging locally");

// Attempt evidence crosses three persistence boundaries. Each must use the
// shared bounded allowlist or a future provider field can silently leak through
// the local row, retry payload, or cold-cache restore.
check(repo.includes("sanitizeAttempt"), "local attempt writes use the bounded sanitizer");
check(sync.includes("serializeAttemptForCloud"), "live and outbox attempt writes share the private cloud serializer");
check(sync.includes("restoreAttemptFromCloud"), "cloud attempt reads use the owner-checking restore mapper");
check(restore.includes("mergeAttemptHistory"), "cold-cache restore uses the bounded attempt merge");

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
