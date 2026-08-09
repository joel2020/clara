import { readFileSync } from "node:fs";

let ok = 0, fail = 0;
const check = (value, message) => value ? ok++ : (fail++, console.log("FAIL", message));
const binder = readFileSync("components/profile-binder.tsx", "utf8");
const settings = readFileSync("lib/hooks/useSettings.tsx", "utf8");
const repository = readFileSync("lib/db/dexie-repository.ts", "utf8");
const sync = readFileSync("lib/sync/supabase-sync.ts", "utf8");

check(/await ensureProfile\([\s\S]{0,300}if \(cancelled\) return;[\s\S]{0,120}await update\(/.test(binder), "ProfileBinder awaits profile creation before settings update and stops after unmount/account switch");
check(/saveSettingsForPracticeBinding\(binding, next\)[\s\S]{0,1600}await flushOutbox\(\)\.catch/.test(settings), "every useSettings writer atomically queues its bound snapshot then attempts an immediate best-effort retry pass");
check(/transaction\("rw", \[binding\.database\.settings, binding\.database\.outbox\]/.test(repository), "local settings and their durable retry enter the captured account in one transaction");
check(/kind === "settings"[\s\S]{0,800}writeProfileThenSettings/.test(sync), "settings retry delivery uses the shared profile-first coordinator");
check(!settings.includes("pushSettings("), "no settings UI caller retains the fire-and-forget writer");

console.log(`profile-settings-wiring: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
