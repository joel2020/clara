import { writeProfileThenSettings } from "./profile-settings-sync.ts";

let ok = 0, fail = 0;
const check = (value, message) => value ? ok++ : (fail++, console.log("FAIL", message));
const deferred = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const payload = (id = "learner-a") => ({ profile: { id, name: "Ana", coachLanguage: "es" }, settings: { profileId: id } });

const profileGate = deferred();
const order = [];
let profileWrites = 0;
const flights = new Map();
const deps = {
  writeProfile: async (profile) => { profileWrites++; order.push(`profile:${profile.id}`); return profileGate.promise; },
  writeSettings: async (settings) => { order.push(`settings:${settings.profileId}`); return true; },
};
const first = writeProfileThenSettings(payload(), deps, flights);
const concurrent = writeProfileThenSettings(payload(), deps, flights);
await Promise.resolve();
check(profileWrites === 1 && order.every((entry) => !entry.startsWith("settings:")), "concurrent settings writes single-flight profile creation and wait behind its FK");
profileGate.resolve(true);
check(await first && await concurrent && order[0] === "profile:learner-a" && order.slice(1).every((entry) => entry === "settings:learner-a"), "settings writes begin only after profile creation succeeds");

let settingsAttempts = 0;
const retryDeps = {
  writeProfile: async () => true,
  writeSettings: async () => ++settingsAttempts > 1,
};
check(!(await writeProfileThenSettings(payload(), retryDeps, new Map())) && await writeProfileThenSettings(payload(), retryDeps, new Map()), "a failed settings delivery remains retryable and its next idempotent attempt succeeds");

let released = false;
const switchGate = deferred();
const switchOrder = [];
const aWrite = writeProfileThenSettings(payload("learner-a"), {
  writeProfile: async () => switchGate.promise,
  writeSettings: async (settings) => { switchOrder.push(settings.profileId); return true; },
}, new Map());
const bWrite = writeProfileThenSettings(payload("learner-b"), {
  writeProfile: async () => true,
  writeSettings: async (settings) => { switchOrder.push(settings.profileId); return true; },
}, new Map()).then((value) => { released = value; });
await bWrite;
check(released && switchOrder.join(",") === "learner-b", "a deferred learner-A profile cannot block or relabel learner-B settings");
switchGate.resolve(true);
await aWrite;
check(switchOrder.join(",") === "learner-b,learner-a", "each completed settings write retains its own profile identity");

console.log(`profile-settings: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
