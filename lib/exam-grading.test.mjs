// node lib/exam-grading.test.mjs
//
// The void-not-zero contract for high-stakes grading (audit P1): a grader
// failure must never become a recorded score, and only an unambiguous numeric
// grade counts. Adversarial *content* (keyword salad, negation, injection) is
// the model's job — pinned by the hardened prompt in app/api/grade/route.ts
// and probed live in the Phase 0 verification — but every transport/shape
// failure is decided here, deterministically.
import { interpretGraderResponse, foldGradePaths, GRADER_RETRIES } from "./exam-grading.ts";

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
const folded = foldGradePaths({ repeat: ["azure", "azure", "transcript"], retell: ["llm"], build: [] });
assert(folded.repeat === "azure+transcript", "mixed per-item paths fold uniquely");
assert(folded.retell === "llm", "single path folds plainly");
assert(folded.build === "none", "an unscored section is visible as none");

assert(GRADER_RETRIES >= 1, "the client retries at least once before voiding");

console.log(`exam-grading: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
