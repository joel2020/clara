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
import { applyTranscriptRetention, DEFAULT_SETTINGS, virtualCallOutboxPayload } from "../db/repository.ts";
import { virtualCallRow } from "../sync/supabase-sync.ts";

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };
const PRIVATE_SENTINEL = "student.private+call@example.com SSN 123-45-6789 " + "X".repeat(200);

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
  pronunciation: {
    diagnosticTargets: [{
      assessmentKind: "free", policyVersion: "latam-v1", outcome: "diagnostic",
      targetWord: "went", targetSound: "final /t/", cueKey: "pronunciation.cue.es.final-endings",
      referenceSentence: "I went yesterday.", source: "provider",
    }],
    scripted: { graded: 1, mastered: 1, practiced: 0, unavailable: 0, averageScore: 82 },
  },
  retriedCount: 1,
  retriedAcceptedCount: 1,
  transcript: [
    { role: "guide", text: "Hi! What did you do yesterday?", at: 1_100 },
    { role: "learner", text: "I go yesterday to the park", at: 4_200 },
  ],
  ...over,
});

await bindLocalDb("virtual-call-tester");
const repo = new DexieRepository();

// --- Free learner text exists durably only in the opted-in local transcript --
const privateRecord = callRecord({
  scenarioId: "privacy-sentinel",
  startedAt: 40,
  endedAt: 50,
  at: 50,
  corrections: [correction({ original: PRIVATE_SENTINEL, corrected: PRIVATE_SENTINEL, explanation: PRIVATE_SENTINEL })],
  priorities: [correction({ original: PRIVATE_SENTINEL, corrected: PRIVATE_SENTINEL, explanation: PRIVATE_SENTINEL })],
  vocabularyUsed: [PRIVATE_SENTINEL],
  pronunciation: {
    diagnosticTargets: [{
      assessmentKind: "free", policyVersion: "latam-v1", outcome: "diagnostic",
      targetWord: PRIVATE_SENTINEL, targetSound: "/θ/ and /ð/", cueKey: "pronunciation.cue.es.th",
      referenceSentence: PRIVATE_SENTINEL, source: "provider",
    }],
    scripted: { graded: 1, mastered: 0, practiced: 1, unavailable: 0, averageScore: 61 },
  },
  transcript: [{ role: "learner", text: PRIVATE_SENTINEL, at: 45 }],
});
await bindLocalDb("virtual-call-privacy-none");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "virtual-call-privacy-none", callTranscriptRetention: "none" });
const privacyNoneRepo = new DexieRepository();
await privacyNoneRepo.saveVirtualCall(privateRecord);
const [privacyNone] = await privacyNoneRepo.getVirtualCalls();
assert(privacyNone.transcript === undefined, "retention off removes the sentinel transcript");
assert(!JSON.stringify(privacyNone).includes(PRIVATE_SENTINEL), "retention off deep-strips email, SSN, and long free-text sentinels from every durable field");

await bindLocalDb("virtual-call-privacy-keep");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "virtual-call-privacy-keep", callTranscriptRetention: "keep" });
const privacyKeepRepo = new DexieRepository();
await privacyKeepRepo.saveVirtualCall(privateRecord);
const [privacyKeep] = await privacyKeepRepo.getVirtualCalls();
assert(privacyKeep.transcript?.[0]?.text === PRIVATE_SENTINEL, "retention opt-in keeps the exact sentinel only in the local transcript field");
const { transcript: localTranscriptOnly, ...privacyKeepReport } = privacyKeep;
assert(localTranscriptOnly?.length === 1 && !JSON.stringify(privacyKeepReport).includes(PRIVATE_SENTINEL),
  "retention opt-in never duplicates free learner text into durable report fields");
const cloudRow = virtualCallRow("virtual-call-privacy-keep", privateRecord);
assert(!JSON.stringify(cloudRow).includes(PRIVATE_SENTINEL), "cloud row deep-strips the email, SSN, long text, transcript, corrections, priorities, vocabulary, and pronunciation fragments");
const outboxPayload = virtualCallOutboxPayload(privateRecord);
assert(outboxPayload && !JSON.stringify(outboxPayload).includes(PRIVATE_SENTINEL), "virtual-call outbox payload is independently deep-allowlisted");

await bindLocalDb("virtual-call-tester");

// --- Captured-account call writes are replay-safe -------------------------
await bindLocalDb("virtual-call-bound");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "virtual-call-bound", callTranscriptRetention: "none" });
const boundRepo = new DexieRepository();
const boundToken = boundRepo.capturePracticeBinding();
const bounded = callRecord({
  scenarioId: "bound", startedAt: 10, endedAt: 20, at: 20, transcript: undefined,
  pronunciation: {
    diagnosticTargets: [{ ...callRecord().pronunciation.diagnosticTargets[0], rawProviderPayload: { secret: true } }],
    scripted: { graded: 999, mastered: 999, practiced: 999, unavailable: 999, averageScore: 82, transcript: "private" },
    rawAudio: "private",
  },
});
await boundRepo.saveVirtualCallForPracticeBinding(boundToken, bounded);
await boundRepo.saveVirtualCallForPracticeBinding(boundToken, bounded);
assert((await db.virtualCalls.count()) === 1, "replaying one captured call write is exact-once locally");
const [boundedStored] = await db.virtualCalls.toArray();
assert(!JSON.stringify(boundedStored.pronunciation).includes("private") && !JSON.stringify(boundedStored.pronunciation).includes("rawProviderPayload"),
  "call persistence strips raw provider, audio, and transcript-like pronunciation fields");
assert(boundedStored.pronunciation.scripted.graded === 24 && boundedStored.pronunciation.scripted.mastered === 24,
  "call persistence bounds and reconciles scripted pronunciation counts");

await bindLocalDb("virtual-call-race-b");
const bConcrete = (await import("../db/dexie.ts")).captureDbBinding().database;
await bindLocalDb("virtual-call-race-a");
await db.settings.put({ ...DEFAULT_SETTINGS, profileId: "virtual-call-race-a", callTranscriptRetention: "none" });
const raceRepo = new DexieRepository();
const raceToken = raceRepo.capturePracticeBinding();
const aConcrete = (await import("../db/dexie.ts")).captureDbBinding().database;
await bConcrete.open();
const originalGet = aConcrete.settings.get.bind(aConcrete.settings);
aConcrete.settings.get = async (...args) => {
  const value = await originalGet(...args);
  globalThis.__claraDb = bConcrete;
  globalThis.__claraDbAccount = "virtual-call-race-b";
  globalThis.__claraDbGeneration = (globalThis.__claraDbGeneration ?? 0) + 1;
  return value;
};
const raceRejected = await raceRepo.saveVirtualCallForPracticeBinding(raceToken, callRecord({ scenarioId: "race", at: 30 })).then(() => false, () => true);
aConcrete.settings.get = originalGet;
assert(raceRejected, "a call write rejects when the mic-start learner binding becomes stale");
assert((await bConcrete.virtualCalls.count()) === 0, "a stale call write never crosses into learner B");
assert((await aConcrete.virtualCalls.count()) === 0, "a stale call write rolls learner A back unchanged");

await bindLocalDb("virtual-call-tester");

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
await repo.saveVirtualCall(kept);
const stored = (await repo.getVirtualCalls()).find((c) => c.scenarioId === "kept");
assert(typeof stored.id === "number", "the stored call gets an auto-increment id");
assert(JSON.stringify(stored.corrections) === JSON.stringify([{ kind: "grammar", fixedOnRetry: true }]),
  "opted-in call reports persist only bounded correction evidence outside the transcript");
assert(stored.transcript.length === 2 && stored.transcript[1].role === "learner", "the opted-in transcript is stored in order");
assert(stored.pronunciation.scripted.graded === 1, "pronunciation evidence survives the round trip");

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
assert(keptAfter.corrections[0].kind === "grammar" && keptAfter.corrections[0].fixedOnRetry === true,
  "bounded correction evidence survives the wipe");
assert(keptAfter.pronunciation.scripted.averageScore === 82, "measured pronunciation survives the wipe");
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

// --- The transcript must never reach the cloud -----------------------------
// /privacidad promises a kept conversation stays on her device. The report now
// syncs so it survives an iOS storage eviction, which makes this the one place
// a leak could be introduced: a future field added to VirtualCallRecord must
// not ride along into the payload.
{
  const { readFileSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const sync = readFileSync(join(ROOT, "lib/sync/supabase-sync.ts"), "utf8");
  const repositorySource = readFileSync(join(ROOT, "lib/db/dexie-repository.ts"), "utf8");
  const boundSave = repositorySource.slice(
    repositorySource.indexOf("async saveVirtualCallForPracticeBinding"),
    repositorySource.indexOf("async deleteVirtualCallTranscripts"),
  );
  const builder = sync.slice(sync.indexOf("function virtualCallRow"), sync.indexOf("export function pushVirtualCall"));

  assert(builder.length > 0, "virtualCallRow exists in the sync module");
  assert(!/transcript/i.test(builder), "the cloud row builder never references the transcript");
  // Named columns, not a spread: a spread would carry any new field silently.
  assert(!/\.\.\.v\b/.test(builder) && !/\.\.\.record/.test(builder),
    "the cloud row names its columns instead of spreading the record");
  assert(!boundSave.includes("this.mirror(") && boundSave.includes("binding.accountId"),
    "the cloud call write uses the captured learner identity, never the active global database");
  const sql = readFileSync(join(ROOT, "supabase/virtual_calls.sql"), "utf8");
  assert(!/transcript/i.test(sql.split("--").filter((l) => !l.startsWith(" ")).join("")) || !/^\s*transcript/m.test(sql),
    "the table has no transcript column");
  assert(/enable row level security/i.test(sql), "the table enables row level security");
  assert(/profile_id = \(select auth\.uid\(\)\)::text/.test(sql), "rows are readable only by their owner");
}

console.log(`virtual-call persistence: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
