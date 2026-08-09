import "fake-indexeddb/auto";
import { bindLocalDb, captureDbBinding, db } from "./db/dexie.ts";
import { DexieRepository } from "./db/dexie-repository.ts";
import { DEFAULT_SETTINGS, sanitizeSettingsSyncPayload, settingsSyncPayload } from "./db/repository.ts";

globalThis.window = globalThis;
let ok = 0, fail = 0;
const check = (value, message) => value ? ok++ : (fail++, console.log("FAIL", message));
const settings = (profileId, dailyGoal = 40) => ({
  ...DEFAULT_SETTINGS, profileId, studentName: "Ana", dailyGoal,
  onboarding: { name: "Ana", country: "Colombia", city: "Medellín", goal: "fluency", dailyMinutes: 10, selfLevel: "basics", level: "A1", completedAt: 1 },
});

await bindLocalDb("settings-a");
const repo = new DexieRepository();
const binding = repo.capturePracticeBinding();
await repo.saveSettingsForPracticeBinding(binding, settings("settings-a", 50));
const queued = await db.outbox.where("kind").equals("settings").first();
check((await db.settings.get("app")).dailyGoal === 50 && queued?.profileId === "settings-a", "a settings update and its retry commit atomically to the captured account");
check(JSON.stringify(queued?.payload).includes('"voiceConsent":null') && !JSON.stringify(queued?.payload).includes("callTranscriptRetention"), "settings retry payload carries only the bounded consent state and excludes transcript preferences");
const spokenInjection = settings("settings-a", 50);
spokenInjection.onboarding.subscores = { listening: 3, vocabulary: 3, grammar: 3, reading: 3, speaking: "my private spoken transcript" };
check(settingsSyncPayload("settings-a", spokenInjection) === null, "spoken text cannot cross the numeric onboarding-subscore allowlist");
const validPayload = queued?.payload;
for (const invalid of [
  { ...validPayload, settings: { ...validPayload.settings, onboarding: { ...validPayload.settings.onboarding, nested: { transcript: "private" } } } },
  { ...validPayload, settings: { ...validPayload.settings, onboarding: { ...validPayload.settings.onboarding, subscores: { listening: NaN, vocabulary: 1, grammar: 1, reading: 1, speaking: 1 } } } },
  { ...validPayload, settings: { ...validPayload.settings, onboarding: { ...validPayload.settings.onboarding, completedAt: Number.MAX_VALUE } } },
]) check(sanitizeSettingsSyncPayload(invalid) === null, "malformed, non-finite, or oversized onboarding data is rejected at replay");
const inherited = Object.create({ transcript: "private" });
Object.assign(inherited, validPayload);
check(sanitizeSettingsSyncPayload(inherited) === null, "prototype-bearing settings payloads are rejected");
await repo.saveSettingsForPracticeBinding(binding, { ...settings("settings-a", 50), voiceConsent: { version: 2, at: 10 } });
await repo.saveSettingsForPracticeBinding(binding, { ...settings("settings-a", 50), voiceConsent: null });
const consentRows = await db.outbox.where("kind").equals("settings").toArray();
check(consentRows.length === 1 && consentRows[0].payload.settings.voiceConsent === null, "a durable withdrawal coalesces and wins over a stale queued grant");

await bindLocalDb("settings-b");
const bConcrete = captureDbBinding().database;
await bindLocalDb("settings-race-a");
await db.settings.put(settings("settings-race-a", 40));
const raceRepo = new DexieRepository();
const raceBinding = raceRepo.capturePracticeBinding();
const aConcrete = captureDbBinding().database;
await bConcrete.open();
const originalPut = aConcrete.settings.put.bind(aConcrete.settings);
aConcrete.settings.put = async (...args) => {
  const result = await originalPut(...args);
  globalThis.__claraDb = bConcrete;
  globalThis.__claraDbAccount = "settings-b";
  globalThis.__claraDbGeneration = (globalThis.__claraDbGeneration ?? 0) + 1;
  return result;
};
const rejected = await raceRepo.saveSettingsForPracticeBinding(raceBinding, settings("settings-race-a", 80)).then(() => false, () => true);
aConcrete.settings.put = originalPut;
check(rejected && (await aConcrete.settings.get("app")).dailyGoal === 40 && await aConcrete.outbox.count() === 0, "an account switch rolls back both learner-A settings and retry row");
check(await bConcrete.settings.count() === 0 && await bConcrete.outbox.count() === 0, "a stale learner-A update never creates a learner-B settings row");

console.log(`settings-persistence: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
