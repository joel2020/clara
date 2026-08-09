// npx tsx lib/speech/stage-assessment-preflight.test.mjs
import { assessEnabled, requireAssessmentCapability, resetAssessmentCapabilityForTests } from "./azure.ts";
import { readFileSync } from "node:fs";

let ok = 0, fail = 0;
const assert = (condition, message) => condition ? ok++ : (fail++, console.log("FAIL", message));
const originalFetch = globalThis.fetch;

let calls = 0;
globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ enabled: true }), { status: 200 }); };
resetAssessmentCapabilityForTests();
await requireAssessmentCapability();
assert(calls === 1, "a cold cache resolves capability before capture");

calls = 0;
let release;
globalThis.fetch = () => { calls++; return new Promise((resolve) => { release = resolve; }); };
resetAssessmentCapabilityForTests();
const concurrent = [assessEnabled(), assessEnabled(), requireAssessmentCapability()];
release(new Response(JSON.stringify({ enabled: true }), { status: 200 }));
assert((await Promise.all(concurrent)).every((value) => value === true || value === undefined) && calls === 1, "racing preflights share one capability probe");

globalThis.fetch = async () => { throw new Error("offline"); };
resetAssessmentCapabilityForTests();
assert(await requireAssessmentCapability().then(() => false, () => true), "probe failure blocks required assessment");

let resolveAborted;
globalThis.fetch = () => new Promise((resolve) => { resolveAborted = resolve; });
resetAssessmentCapabilityForTests();
const aborted = new AbortController();
const pendingAbort = requireAssessmentCapability(aborted.signal).then(() => false, (error) => error?.name === "AbortError");
aborted.abort();
resolveAborted(new Response(JSON.stringify({ enabled: true }), { status: 200 }));
assert(await pendingAbort, "navigation/account cancellation wins a deferred capability probe");

const recognitionSource = readFileSync("lib/speech/recognition.ts", "utf8");
const requiredPath = recognitionSource.slice(recognitionSource.indexOf("export async function createRequiredAssessmentRecognition"));
assert(requiredPath.indexOf("await requireAssessmentCapability(opts.signal)") < requiredPath.indexOf("return createRecognition")
  && requiredPath.includes("if (!hasMediaRecording()) throw new RecognitionError(\"technical-skip\"")
  && requiredPath.indexOf("if (opts.signal?.aborted)") < requiredPath.indexOf("return createRecognition")
  && !requiredPath.slice(0, requiredPath.indexOf("return createRecognition")).includes("startRecognition("),
"the stage path preflights before capture and contains no transcript/Web Speech fallback");

globalThis.fetch = originalFetch;
resetAssessmentCapabilityForTests();
console.log(`stage-assessment-preflight: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
