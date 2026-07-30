// npx tsx lib/virtual-call/persistence.test.mjs
//
// The Virtual Call persistence + privacy contract, run against the real Dexie
// repository on fake-indexeddb — so these are the actual writes, not a
// description of them.
//
// Two promises are load-bearing here and they pull in opposite directions:
//   1. Minimal retention. The transcript of what she said is NOT written to
//      storage unless she opted in; the setting is enforced at the write, so a
//      caller that forgets the rule still cannot persist her words.
//   2. Deleting her words is not deleting her progress. The privacy control
//      strips transcripts and leaves every aggregate report row standing.
// A regression in either direction is silent in the UI, which is why it is
// pinned here.
import "fake-indexeddb/auto";
import { bindLocalDb, db } from "../db/dexie.ts";
import { DexieRepository } from "../db/dexie-repository.ts";
import { applyTranscriptRetention, DEFAULT_SETTINGS } from "../db/repository.ts";

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

/** Key-order-independent comparison, optionally ignoring named fields. */
const stable = (value, ignore = []) =>
  JSON.stringify(value, (key, val) =>
    val && typeof val === "object" && !Array.isArray(val)
      ? Object.fromEntries(
          Object.entries(val)
            .filter(([k]) => !ignore.includes(k))
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : val,
  );

globalThis.window = globalThis; // let bindLocalDb run under Node

const correction = (over = {}) => ({
  original: "I go yesterday",
  corrected: "I went yesterday",
  explanation: "Ayer = pasado, entonces 'went'.",
  kind: "grammar",
  fixedOnRetry: true,
  ...over,
});

const callRecord = (over = {}) => ({
  scenarioId: "coffee-order",
  mode: "natural",
  level: "A2",
  startedAt: 1_000,
  endedAt: 301_000,
  at: 301_000,
  durationMs: 300_000,
  learnerTurns: 8,
  cleanTurns: 6,
  metCriteria: true,
  corrections: [correction()],
  priorities: [correction()],
  vocabularyUsed: ["to go", "yesterday"],
  pronunciation: { scored: 1, averageScore: 82, worstWords: ["went"] },
  retriedCount: 1,
  retriedAcceptedCount: 1,
  transcript: [
    { role: "clara", text: "Hi! What did you do yesterday?", at: 1_100 },
    { role: "learner", text: "I go yesterday to the park", at: 4_200 },
  ],
  ...over,
});

await bindLocalDb("virtual-call-tester");
const repo = new DexieRepository();

// --- A. Defaults resolve for a learner who predates these fields ------------
// Her settings row was written before the Virtual Call existed, so it carries
// none of the three keys. Nothing may be silently switched on for her.
await db.settings.put({
  id: "app",
  instructorMode: false,
  speechRate: 0.9,
  recognitionLang: "en-US",
  soundEnabled: true,
  dailyGoal: 40,
  studentName: "Mariana",
  profileId: null,
  coachLanguage: "es",
  difficulty: "auto",
});
const legacyRow = await db.settings.get("app");
assert(legacyRow.callTranscriptRetention === undefined, "the stored row genuinely lacks the new field");

assert(DEFAULT_SETTINGS.callTranscriptRetention === "none", "retention default is 'none' (minimal by default)");
assert(DEFAULT_SETTINGS.callCorrectionMode === "natural", "correction-mode default is 'natural'");
assert(DEFAULT_SETTINGS.humorLevel === "light", "humor default is 'light'");

const resolved = await repo.getSettings();
assert(resolved.callTranscriptRetention === "none", "an existing learner resolves to 'none' retention");
assert(resolved.callCorrectionMode === "natural", "an existing learner resolves to 'natural' corrections");
assert(resolved.humorLevel === "light", "an existing learner resolves to 'light' humor");
assert(resolved.studentName === "Mariana", "merging defaults does not disturb her stored settings");

// --- B. The retention rule is pure and applied at the write ----------------
assert(applyTranscriptRetention(callRecord(), "keep").transcript !== undefined, "'keep' keeps the transcript");
for (const mode of ["none", "session", undefined]) {
  const out = applyTranscriptRetention(callRecord(), mode);
  assert(!("transcript" in out), `retention ${String(mode)} drops the transcript entirely`);
  assert(out.corrections.length === 1 && out.learnerTurns === 8, `retention ${String(mode)} keeps the report`);
}

// Default retention: the call is stored, her words are not.
await repo.saveVirtualCall(callRecord({ scenarioId: "not-kept", at: 100 }));
const [notKept] = await repo.getVirtualCalls();
assert(notKept.scenarioId === "not-kept", "the call is stored under the default setting");
assert(notKept.transcript === undefined, "under the default setting no transcript reaches storage");
assert(notKept.learnerTurns === 8 && notKept.priorities.length === 1, "the aggregate report is stored regardless");

// --- C. The record round-trips whole when she opted in ---------------------
await repo.saveSettings({ ...resolved, callTranscriptRetention: "keep" });
const kept = callRecord({ scenarioId: "kept", at: 200 });
const asSubmitted = structuredClone(kept); // Dexie stamps the new id onto the caller's object
await repo.saveVirtualCall(kept);
const stored = (await repo.getVirtualCalls()).find((c) => c.scenarioId === "kept");
assert(typeof stored.id === "number", "the stored call gets an auto-increment id");
assert(stable(stored, ["id"]) === stable(asSubmitted), "every field of the record round-trips unchanged");
assert(stored.transcript.length === 2 && stored.transcript[1].role === "learner", "the opted-in transcript is stored in order");
assert(stored.pronunciation.scored === 1, "pronunciation evidence survives the round trip");

// A call where pronunciation was never measured keeps the field absent —
// absent must never read as a score of zero.
await repo.saveVirtualCall(callRecord({ scenarioId: "unmeasured", at: 300, pronunciation: undefined, transcript: undefined }));
const unmeasured = (await repo.getVirtualCalls()).find((c) => c.scenarioId === "unmeasured");
assert(unmeasured.pronunciation === undefined, "an unmeasured call stores no pronunciation summary");

// --- D. History reads are newest-first and limitable ------------------------
const history = await repo.getVirtualCalls();
assert(history.length === 3, "every completed call is kept (append-only)");
assert(history[0].at >= history[1].at && history[1].at >= history[2].at, "calls come back newest first");
assert((await repo.getVirtualCalls(1)).length === 1, "the limit is honored");

// --- E. Deleting transcripts is not deleting her progress ------------------
const before = await repo.getVirtualCalls();
await repo.deleteVirtualCallTranscripts();
const after = await repo.getVirtualCalls();
assert(after.length === before.length, "no report row is removed by the transcript wipe");
assert(after.every((c) => c.transcript === undefined), "no transcript survives the wipe");
const keptAfter = after.find((c) => c.scenarioId === "kept");
const keptBefore = before.find((c) => c.scenarioId === "kept");
assert(
  stable(keptAfter, ["transcript"]) === stable(keptBefore, ["transcript"]),
  "the wiped call keeps its id and its entire report",
);
assert(keptAfter.corrections[0].corrected === "I went yesterday", "corrections survive the wipe");
assert(keptAfter.pronunciation.averageScore === 82, "measured pronunciation survives the wipe");
const untouched = after.find((c) => c.scenarioId === "unmeasured");
assert(untouched.learnerTurns === 8 && untouched.cleanTurns === 6, "calls that never had a transcript are untouched");
assert((await repo.getSettings()).callTranscriptRetention === "keep", "the wipe does not reset her retention choice");

// --- F. One call can still be removed outright -----------------------------
await repo.deleteVirtualCall(keptAfter.id);
const remaining = await repo.getVirtualCalls();
assert(remaining.length === 2 && !remaining.some((c) => c.scenarioId === "kept"), "deleteVirtualCall removes exactly one call");

// --- G. Starting over clears the calls too ---------------------------------
await repo.reset();
assert((await repo.getVirtualCalls()).length === 0, "reset() wipes virtual calls with the rest of the device data");

console.log(`virtual-call persistence: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
