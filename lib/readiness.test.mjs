// npx tsx lib/readiness.test.mjs
// (tsx, not bare node: readiness.ts imports through the "@/" alias.)
//
// The readiness score is the whole product's honesty surface — if it can be
// gamed, or reads as a real level before anything has been demonstrated, the
// destination it points at is worthless. These tests pin that down.
import { computeReadiness, TARGET_SCORE } from "./readiness.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };

const att = (score, passed, at) => ({ itemId: "i", lessonId: "l", categoryId: "c", phoneme: "p", target: "t", heard: "t", score, passed, at });
// lastResult is "pass" | "fail" | null — never a boolean.
const prog = (itemId, box, lastResult) => ({ itemId, lessonId: "l", categoryId: "c", phoneme: "p", attempts: 4, passes: 2, box, dueAt: 0, lastResult, lastScore: 60, updatedAt: 1 });

// --- Nothing practised yet -------------------------------------------------
const empty = computeReadiness({ attempts: [], progress: [], band: "A1", path: "general" });
eq(empty.score, 0, "empty score is 0");
eq(empty.blocker, null, "empty has no blocker");
eq(empty.provisional, true, "no passed exam means provisional");
eq(empty.target, TARGET_SCORE, "target is the B2 bar");
eq(empty.target, 80, "the B2 bar is 80");
eq(empty.band, "A1", "band passes through");

// --- Strong work outscores weak work --------------------------------------
const strong = computeReadiness({
  attempts: [att(95, true, 5), att(92, true, 4), att(90, true, 3)],
  progress: [prog("a", 5, "pass")],
  band: "B1",
  path: "general",
});
const weak = computeReadiness({
  attempts: [att(40, false, 5), att(45, false, 4), att(38, false, 3)],
  progress: [prog("a", 0, "fail")],
  band: "B1",
  path: "general",
});
eq(strong.score > weak.score, true, "strong attempts score higher than weak");

// --- Shape guarantees the UI relies on ------------------------------------
const blocked = computeReadiness({
  attempts: [att(90, true, 3), att(88, true, 2)],
  progress: [prog("a", 4, "pass")],
  band: "B1",
  path: "general",
});
eq(blocked.subskills.length, 4, "always four subskills");
eq(blocked.subskills.every((s) => s.score >= 0 && s.score <= 100), true, "subskills are 0..100");
eq(blocked.subskills.map((s) => s.key), ["intelligibility", "fluency", "listening", "interaction"], "stable subskill order");
eq(typeof blocked.blocker === "string" || blocked.blocker === null, true, "blocker is a key or null");

// The blocker must BE the lowest subskill, not merely some failing one.
const lowest = [...blocked.subskills].sort((a, b) => a.score - b.score)[0];
eq(blocked.blocker, lowest.atTarget ? null : lowest.key, "blocker is the lowest subskill");

// --- Provisional until an exam is actually passed --------------------------
const examined = computeReadiness({
  attempts: [att(85, true, 1)],
  progress: [prog("a", 5, "pass")],
  band: "B2",
  path: "job",
  examPassed: true,
});
eq(examined.provisional, false, "passed exam is not provisional");

// --- Degenerate input must not produce NaN or escape 0..100 ---------------
const odd = computeReadiness({ attempts: [att(0, false, 1)], progress: [], band: "A0", path: "job" });
eq(Number.isFinite(odd.score), true, "score is finite");
eq(odd.score >= 0 && odd.score <= 100, true, "score is bounded 0..100");

// --- Volume alone must not carry the score --------------------------------
// 400 barely-passed items should not reach the B2 bar: grinding easy material is
// exactly the failure mode the score contract forbids.
const ground = computeReadiness({
  attempts: Array.from({ length: 60 }, (_, i) => att(62, true, i)),
  progress: Array.from({ length: 400 }, (_, i) => prog(`i${i}`, 1, "pass")),
  band: "A2",
  path: "general",
});
eq(ground.score < TARGET_SCORE, true, "grinding volume does not reach the target");

// --- Measured fluency beats the proxy --------------------------------------
// Azure attempts carry a real FluencyScore; Web Speech attempts carry none. A
// missing value must mean "not measured", never "measured zero".
const withFluency = (score, passed, at, fluency) => ({ ...att(score, passed, at), fluency });

const proxyOnly = computeReadiness({ attempts: [att(90, true, 2), att(90, true, 1)], progress: [prog("a", 3, "pass")], band: "B1", path: "general" });
eq(proxyOnly.fluencyMeasured, false, "no fluency values means the proxy was used");

const measuredLow = computeReadiness({
  attempts: [withFluency(90, true, 2, 30), withFluency(90, true, 1, 40)],
  progress: [prog("a", 3, "pass")],
  band: "B1",
  path: "general",
});
eq(measuredLow.fluencyMeasured, true, "fluency values mark the score as measured");
eq(measuredLow.subskills.find((s) => s.key === "fluency").score, 35, "measured fluency is the mean of real values");
// Passing every attempt would have given the proxy 100; the real measurement is 35.
eq(measuredLow.subskills.find((s) => s.key === "fluency").score < proxyOnly.subskills.find((s) => s.key === "fluency").score, true, "a real low measurement overrides a flattering proxy");

// Unmeasured attempts are EXCLUDED, not counted as zero.
const mixedFluency = computeReadiness({
  attempts: [withFluency(90, true, 3, 80), att(90, true, 2), att(90, true, 1)],
  progress: [prog("a", 3, "pass")],
  band: "B1",
  path: "general",
});
eq(mixedFluency.subskills.find((s) => s.key === "fluency").score, 80, "unmeasured attempts do not drag the average down");

// Provider outages are not learner evidence, even if a malformed legacy row
// carries flattering score/pass values.
const withoutOutage = computeReadiness({ attempts: [att(50, false, 1)], progress: [], band: "A1", path: "general" });
const withOutage = computeReadiness({
  attempts: [att(50, false, 1), { ...att(100, true, 2), providerStatus: "unavailable", fluency: 100 }],
  progress: [],
  band: "A1",
  path: "general",
});
eq(withOutage.subskills, withoutOutage.subskills, "non-valid provider evidence cannot improve readiness or measured fluency");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
