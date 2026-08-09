// npx tsx lib/speech/owned-tts.test.mjs
import { OwnedTtsSession } from "./owned-tts.ts";

let ok = 0, fail = 0;
const assert = (condition, message) => condition ? ok++ : (fail++, console.log("FAIL", message));
const made = [], revoked = [];
const originalUrl = globalThis.URL;
globalThis.URL = { createObjectURL: () => { const url = `blob:${made.length + 1}`; made.push(url); return url; }, revokeObjectURL: (url) => revoked.push(url) };
const audio = { src: "", onended: null, onerror: null, plays: 0, pause() {}, load() {}, removeAttribute() { this.src = ""; }, async play() { this.plays++; } };
const owner = new OwnedTtsSession(audio);
let releaseFirst;
let firstSignal;
const first = owner.speak((signal) => { firstSignal = signal; return new Promise((resolve) => { releaseFirst = resolve; }); });
const second = owner.speak(async () => new Blob(["second"]));
releaseFirst(new Blob(["late"]));
assert(await first === "disposed" && firstSignal.aborted, "a new replay aborts the prior request");
assert(await second === "played" && audio.src === "blob:1" && audio.plays === 1, "only the current response can play or own state");
owner.dispose();
assert(audio.src === "" && revoked.filter((url) => url === "blob:1").length === 1, "dispose releases the one owned URL exactly once");

let releaseLate;
const late = owner.speak(() => new Promise((resolve) => { releaseLate = resolve; }));
owner.dispose();
releaseLate(new Blob(["after navigation"]));
assert(await late === "disposed" && audio.plays === 1, "a late response after navigation/unmount never plays or mutates audio");

audio.play = async function () { this.plays++; throw new Error("blocked"); };
assert(await owner.speak(async () => new Blob(["blocked"])) === "failed" && revoked.includes("blob:2"), "failed playback releases its URL");
globalThis.URL = originalUrl;
console.log(`owned-tts: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
