// node lib/db/scope.test.mjs
//
// The account-isolation invariant (audit P1, shared devices):
//   data belonging to user A must never appear, merge, or become attributable
//   to user B after signing out and switching accounts on the same device.
// Storage is isolated by DATABASE, not by cleanup: each account gets its own
// IndexedDB database, so these tests exercise the binding/claiming logic that
// decides which database is open — the only place isolation can fail.
import "fake-indexeddb/auto";
import { bindLocalDb, boundAccountId, db, dbNameFor, shouldClaimLegacy, ClaraDB } from "./dexie.ts";

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

// dexie.ts only self-initializes in a browser; in Node we drive bindLocalDb
// directly (globalThis.window is absent, so guard it on).
globalThis.window = globalThis; // let bindLocalDb run under Node

// --- naming and claim decision (pure) --------------------------------------
assert(dbNameFor(null) === "clara", "null account uses the legacy database");
assert(dbNameFor("User-A") === "clara-u-user-a", "account databases are normalized per user");
assert(shouldClaimLegacy(null, "a"), "unbound legacy data is claimed by the first account");
assert(shouldClaimLegacy(undefined, "a"), "missing profileId counts as unbound");
assert(shouldClaimLegacy("a", "a"), "legacy data already bound to this account is claimed");
assert(shouldClaimLegacy(" A ", "a"), "claim comparison is normalized");
assert(!shouldClaimLegacy("b", "a"), "legacy data bound to another account is NEVER claimed");

// --- live A → sign out → B → back to A -------------------------------------
const run = async () => {
  // Legacy device state: one shared database bound to account A (the
  // pre-scoping world after A had signed in), with real history.
  const legacy = new ClaraDB(dbNameFor(null));
  await legacy.settings.put({ id: "app", profileId: "user-a", studentName: "Alma", coachLanguage: "es", soundEnabled: true });
  await legacy.attempts.add({ itemId: "x:1", lessonId: "x", categoryId: "conversation", phoneme: "chunk", at: 111, passed: true, score: 90, transcript: "hi" });
  await legacy.progress.put({ itemId: "x:1", lessonId: "x", categoryId: "conversation", phoneme: "chunk", box: 3, dueAt: 1, updatedAt: 1 });
  legacy.close();

  // A signs in on this device: A claims the legacy data.
  await bindLocalDb("user-a");
  assert(boundAccountId() === "user-a", "bound to A");
  assert(db.name === "clara-u-user-a", "A gets an account-scoped database");
  assert((await db.attempts.count()) === 1, "A's legacy attempts were claimed");
  assert((await db.settings.get("app"))?.studentName === "Alma", "A's legacy settings were claimed");

  // A practices while signed in.
  await db.attempts.add({ itemId: "x:2", lessonId: "x", categoryId: "conversation", phoneme: "chunk", at: 222, passed: true, score: 95, transcript: "hello" });

  // A signs out, B signs in. B must see NOTHING of A's.
  await bindLocalDb("user-b");
  assert(boundAccountId() === "user-b", "bound to B");
  assert(db.name === "clara-u-user-b", "B gets a different database");
  assert((await db.attempts.count()) === 0, "B sees none of A's attempts");
  assert((await db.settings.get("app")) === undefined, "B sees none of A's settings (legacy stayed with A)");

  // B does some work (including an offline-looking write).
  await db.settings.put({ id: "app", profileId: "user-b", studentName: "Berta", coachLanguage: "es", soundEnabled: true });
  await db.attempts.add({ itemId: "y:1", lessonId: "y", categoryId: "conversation", phoneme: "chunk", at: 333, passed: false, score: 40, transcript: "uh" });

  // Interrupted transition: a re-bind to the SAME account must be a no-op.
  await bindLocalDb("user-b");
  assert((await db.attempts.count()) === 1, "re-binding B is idempotent");

  // Back to A: everything is exactly as A left it, nothing of B's.
  await bindLocalDb("user-a");
  const atsA = await db.attempts.toArray();
  assert(atsA.length === 2, "A returns to both original attempts");
  assert(atsA.every((a) => a.itemId.startsWith("x:")), "none of B's rows leaked into A");
  assert((await db.settings.get("app"))?.studentName === "Alma", "A's identity is intact");

  // The legacy database was claimed by copy, never deleted.
  const legacy2 = new ClaraDB(dbNameFor(null));
  assert((await legacy2.attempts.count()) === 1, "legacy database still holds its original data");
  legacy2.close();

  // A device whose legacy data belongs to A must NOT leak into a brand-new
  // account C even though C's database is empty (the claim decision).
  await bindLocalDb("user-c");
  assert((await db.attempts.count()) === 0, "C cannot claim A's legacy data");
  assert((await db.settings.get("app")) === undefined, "C starts truly empty");

  // Local (authless) mode binds back to the legacy database.
  await bindLocalDb(null);
  assert(db.name === "clara", "authless mode uses the legacy database");
  assert((await db.attempts.count()) === 1, "authless mode sees the original device data");
};

await run();

console.log(`scope: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
