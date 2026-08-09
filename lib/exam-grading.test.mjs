// node lib/exam-grading.test.mjs
//
// The void-not-zero contract for high-stakes grading (audit P1): a grader
// failure must never become a recorded score, and only an unambiguous numeric
// grade counts. Adversarial *content* (keyword salad, negation, injection) is
// the model's job — pinned by the hardened prompt in app/api/grade/route.ts
// and probed live in the Phase 0 verification — but every transport/shape
// failure is decided here, deterministically.
import {
  interpretGraderResponse,
  initialStageSpeakingState,
  transitionStageSpeaking,
  foldGradePaths,
  GRADER_RETRIES,
  interpretCaptureFailure,
} from "./exam-grading.ts";

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };
const kind = (s, b) => interpretGraderResponse(s, b).kind;

// A clean grade is a grade.
const good = interpretGraderResponse(200, { score: 72, fix: "Di 'I went', no 'I go'." });
assert(good.kind === "scored" && good.score === 72 && good.fix?.startsWith("Di"), "a numeric grade with a fix scores");
assert(interpretGraderResponse(200, { score: 0, fix: "" }).kind === "scored", "an honest zero (empty answer) is still a grade");

// Clamping and rounding — the grader's number is advisory shape, not gospel.
assert(interpretGraderResponse(200, { score: 130, fix: null }).score === 100, "scores clamp to 100");
assert(interpretGraderResponse(200, { score: -5, fix: null }).score === 0, "scores clamp to 0");
assert(interpretGraderResponse(200, { score: 66.6, fix: null }).score === 67, "scores round");

// Every transport/shape failure is UNAVAILABLE — never a zero, never a pass.
assert(kind(503, { error: "not_configured" }) === "unavailable", "grader not configured voids");
assert(kind(502, { error: "Couldn't grade that answer." }) === "unavailable", "upstream model failure voids");
assert(kind(401, {}) === "unavailable", "auth failure voids rather than zeroing the learner");
assert(kind(429, {}) === "unavailable", "rate limiting voids");
assert(kind(200, null) === "unavailable", "empty body voids");
assert(kind(200, "ok") === "unavailable", "non-object body voids");
assert(kind(200, {}) === "unavailable", "missing score voids");
assert(kind(200, { score: "85" }) === "unavailable", "stringly-typed score voids (no coercion surprises)");
assert(kind(200, { score: NaN }) === "unavailable", "NaN voids");
assert(kind(200, { score: Infinity }) === "unavailable", "Infinity voids");

// fix is optional and sanitized.
assert(interpretGraderResponse(200, { score: 50 }).fix === null, "missing fix is null");
assert(interpretGraderResponse(200, { score: 50, fix: "   " }).fix === null, "blank fix is null");

// Path audit trail folds deterministically.
const folded = foldGradePaths({ repeat: ["azure", "azure"], retell: ["llm"], build: [] });
assert(folded.repeat === "azure", "duplicate per-item paths fold uniquely");
assert(folded.retell === "llm", "single path folds plainly");
assert(folded.build === "none", "an unscored section is visible as none");

assert(GRADER_RETRIES >= 1, "the client retries at least once before voiding");

const evidence = (overrides = {}) => ({
  providerStatus: "valid", pronunciationScore: 85, accuracyScore: 85,
  completenessScore: 95, targetPhonemeScore: 80, targetRecognized: true,
  ...overrides,
});

for (const level of ["A0", "A1"]) {
  const passed = transitionStageSpeaking(initialStageSpeakingState(), { type: "acoustic", cefr: level, evidence: evidence() });
  assert(passed.accepted && passed.state.status === "mastered" && passed.score === 86, `${level} passes exact boundaries without prosody`);
}
for (const level of ["A2", "B1", "B2", "C1", "C2"]) {
  const missing = transitionStageSpeaking(initialStageSpeakingState(), { type: "acoustic", cefr: level, evidence: evidence() });
  assert(missing.disposition === "void" && missing.state.status === "voided", `${level} missing prosody voids instead of scoring`);
  const passed = transitionStageSpeaking(initialStageSpeakingState(), { type: "acoustic", cefr: level, evidence: evidence({ prosodyScore: 70 }) });
  assert(passed.state.status === "mastered", `${level} passes the exact prosody boundary`);
}

let misses = initialStageSpeakingState();
for (const ordinal of [1, 2, 3]) {
  const result = transitionStageSpeaking(misses, { type: "acoustic", cefr: "B1", evidence: evidence({ pronunciationScore: 84, prosodyScore: 70 }) });
  misses = result.state;
  assert(misses.learnerMisses === ordinal && misses.validAcousticAttempts === ordinal, `valid miss ${ordinal} is bounded and counted`);
  assert(misses.status === (ordinal === 3 ? "practice-required" : "retry"), `valid miss ${ordinal} has the correct status`);
}
const afterTerminal = transitionStageSpeaking(misses, { type: "acoustic", cefr: "B1", evidence: evidence({ prosodyScore: 70 }) });
assert(!afterTerminal.accepted && afterTerminal.state === misses, "a terminal practice-required item rejects further captures");

for (const passOrdinal of [1, 2, 3]) {
  let state = initialStageSpeakingState();
  for (let ordinal = 1; ordinal < passOrdinal; ordinal++) {
    state = transitionStageSpeaking(state, { type: "acoustic", cefr: "B1", evidence: evidence({ pronunciationScore: 84, prosodyScore: 70 }) }).state;
  }
  const passed = transitionStageSpeaking(state, { type: "acoustic", cefr: "B1", evidence: evidence({ prosodyScore: 70 }) });
  assert(passed.state.status === "mastered" && passed.state.validAcousticAttempts === passOrdinal, `a learner can master on valid attempt ${passOrdinal}`);
}
const mastered = transitionStageSpeaking(initialStageSpeakingState(), { type: "acoustic", cefr: "B1", evidence: evidence({ prosodyScore: 70 }) }).state;
assert(!transitionStageSpeaking(mastered, { type: "no-speech" }).accepted, "a mastered item rejects stale capture events");

const restored = JSON.parse(JSON.stringify(transitionStageSpeaking(initialStageSpeakingState(), { type: "no-speech" }).state));
const afterRestore = transitionStageSpeaking(restored, { type: "acoustic", cefr: "B1", evidence: evidence({ pronunciationScore: 84, prosodyScore: 70 }) });
assert(afterRestore.state.learnerMisses === 2 && afterRestore.state.validAcousticAttempts === 1, "serialized state resumes deterministically without resetting misses");

for (const [field, value] of [["pronunciationScore", 84.999], ["accuracyScore", 84.999], ["completenessScore", 94.999], ["targetPhonemeScore", 79.999], ["prosodyScore", 69.999]]) {
  const result = transitionStageSpeaking(initialStageSpeakingState(), { type: "acoustic", cefr: "B1", evidence: evidence({ prosodyScore: 70, [field]: value }) });
  assert(result.state.status === "retry", `${field} below its exact boundary is a learner retry`);
}
const wrongTarget = transitionStageSpeaking(initialStageSpeakingState(), { type: "acoustic", cefr: "B1", evidence: evidence({ prosodyScore: 70, targetRecognized: false }) });
assert(wrongTarget.state.status === "retry", "target identity is graded from structured evidence, never transcript similarity");

let silence = initialStageSpeakingState();
for (const ordinal of [1, 2, 3]) silence = transitionStageSpeaking(silence, { type: "no-speech" }).state;
assert(silence.status === "practice-required" && silence.learnerMisses === 3 && silence.validAcousticAttempts === 0, "three no-speech captures exhaust without fabricating evidence");

const untouched = initialStageSpeakingState();
for (const type of ["consent", "cancelled"]) {
  const retry = transitionStageSpeaking(untouched, { type });
  assert(retry.accepted && retry.disposition === "retry" && retry.state === untouched, `${type} is retryable without a miss`);
}
for (const code of ["silent", "permission", "device", "network", "malformed", "incomplete", "technical-skip"]) {
  const voided = transitionStageSpeaking(untouched, { type: "technical", code });
  assert(voided.disposition === "void" && voided.state.learnerMisses === 0, `${code} voids with no learner miss`);
}

assert(interpretCaptureFailure("no-speech").kind === "learner-zero", "Azure no-match/no-speech cannot evade exam scoring");
assert(interpretCaptureFailure("silent").kind === "void", "a silent/device capture is technical, not learner performance");
assert(interpretCaptureFailure("technical-skip").kind === "void", "a provider outage voids instead of scoring zero");
assert(interpretCaptureFailure("network").kind === "void", "a grading network outage remains non-recorded");
assert(interpretCaptureFailure("consent").kind === "retry", "declined consent stays on the item without a score");
assert(interpretCaptureFailure("cancelled").kind === "retry", "an explicit user cancellation stays retryable");
for (const code of [
  "unsupported",
  "not-allowed",
  "service-not-allowed",
  "start-failed",
  "audio-capture",
  "technical-skip",
  "network",
  "future-provider-code",
  "",
  undefined,
]) {
  assert(interpretCaptureFailure(code).kind === "void", `${String(code)} fails closed to a voided exam`);
}

console.log(`exam-grading: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
