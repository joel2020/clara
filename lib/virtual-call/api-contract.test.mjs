// Security and cost properties of the Virtual Call routes, pinned against the
// route source.
//
// These are the things that are invisible when they break: a removed auth check
// still returns 200, an unwindowed history still answers, and a log line that
// quietly starts carrying learner speech looks like nothing at all. Each
// assertion below is a property someone could delete in a refactor without any
// test failing otherwise.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const turn = readFileSync(join(ROOT, "app/api/virtual-call/turn/route.ts"), "utf8");
const report = readFileSync(join(ROOT, "app/api/virtual-call/report/route.ts"), "utf8");
const providers = readFileSync(join(ROOT, "lib/virtual-call/providers.ts"), "utf8");

let ok = 0;
let fail = 0;
const check = (cond, msg) => {
  if (cond) ok++;
  else {
    fail++;
    console.log("FAIL", msg);
  }
};

for (const [name, src] of [["turn", turn], ["report", report]]) {
  check(src.includes("guardApi(request)"), `${name}: same-origin and flood guard runs`);
  check(src.includes("requireUser(request)"), `${name}: authentication is required`);
  // Ordering matters: parsing an unauthenticated body is work done for free.
  check(
    src.indexOf("requireUser") < src.indexOf("request.text()"),
    `${name}: auth is checked before the body is read`,
  );
  check(
    src.indexOf("guardApi") < src.indexOf("requireUser"),
    `${name}: the cheap origin check runs before the network auth call`,
  );
  check(src.includes("MAX_BODY_BYTES"), `${name}: the request body is capped`);
  check(/status:\s*413/.test(src), `${name}: an oversized body is rejected with 413`);
  check(src.includes('runtime = "nodejs"'), `${name}: pins the node runtime`);
  check(/maxDuration\s*=\s*\d+/.test(src), `${name}: caps its own execution time`);
}

// Cost controls that a client cannot be trusted to apply to itself.
check(turn.includes("MAX_UTTERANCE_CHARS"), "turn: the utterance is length-capped");
check(turn.includes("CONTEXT_WINDOW_TURNS"), "turn: history is windowed server-side, not just client-side");
check(/slice\(-CONTEXT_WINDOW_TURNS/.test(turn), "turn: the window is actually applied to the history");
check(turn.includes("MAX_HISTORY_TEXT"), "turn: each history entry is length-capped");

// The mock must never answer a real learner.
check(
  /NODE_ENV === "production"[\s\S]{0,80}return null/.test(turn),
  "turn: the development mock is refused in production",
);
check(providers.includes("MockCallBrain"), "the mock brain exists for keyless development");

// Learner speech must not reach the platform logs.
const logCalls = [...turn.matchAll(/console\.(error|log|warn)\(([\s\S]*?)\);/g)].map((m) => m[2]);
check(logCalls.length > 0, "turn: upstream failures are logged at all");
for (const call of logCalls) {
  check(!/\butterance\b/.test(call), "turn: no log statement includes the learner's utterance");
  check(!/\breply\b/.test(call), "turn: no log statement includes Clara's reply");
  check(!/\bhistory\b/.test(call), "turn: no log statement includes the conversation history");
}
const reportLogs = [...report.matchAll(/console\.(error|log|warn)\(([\s\S]*?)\);/g)].map((m) => m[2]);
for (const call of reportLogs) {
  check(!/\bfacts\b/.test(call), "report: no log statement dumps the call facts");
  check(!/\bprose\b/.test(call), "report: no log statement dumps the generated prose");
}

// A failed report must still give her something.
check(report.includes("fallbackProse"), "report: has assembled copy when the model is unavailable");
check(
  /catch\s*\(/.test(report) && /catch[\s\S]*?fallbackProse/.test(report),
  "report: a model failure falls back rather than costing her the review",
);

// Validation of untrusted input.
check(turn.includes("unknown_scenario"), "turn: an unknown scenario is rejected");
check(turn.includes("empty_utterance"), "turn: an empty utterance is rejected");
check(/mode === "practice" \? "practice" : "natural"/.test(turn), "turn: the mode is coerced to a known value");
check(/coachLanguage === "en" \? "en" : "es"/.test(turn), "turn: the coach language is coerced to a known value");

console.log(`virtual-call api contract: ${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
