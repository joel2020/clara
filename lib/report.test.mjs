// npx tsx lib/report.test.mjs
//
// This is the only artefact that leaves the app and goes to a recruiter, so the
// non-negotiables are: it shows nothing until an exam is passed, it never claims a
// band higher than one she demonstrated, and every number is measured rather than
// estimated.
import { buildReport } from "./report.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };

const DAY = 86_400_000;
const att = (at, passed) => ({ itemId: "i", lessonId: "l", categoryId: "c", phoneme: "p", target: "t", heard: "t", score: passed ? 90 : 40, passed, at });
const prog = (itemId, box) => ({ itemId, lessonId: "l", categoryId: "c", phoneme: "p", attempts: 4, passes: 3, box, dueAt: 0, lastResult: "pass", lastScore: 85, updatedAt: 1 });
const exam = (level, passed, at, score = 80) => ({ day: "d", at, level, score, passed, sections: {}, weakest: null });
const call = (at, score) => ({ scenarioId: "double-charge", at, score, checks: {} });

// --- Nothing until an exam is passed ---------------------------------------
const none = buildReport({ attempts: [att(1, true)], progress: [prog("a", 5)], exams: [], calls: [] });
eq(none.ready, false, "no exam means not ready");
eq(none.band, null, "no exam means no band claimed");
eq(none.examScore, null, "no exam means no score");

// A FAILED sitting must not produce a band.
const failedOnly = buildReport({ attempts: [], progress: [], exams: [exam("B1", false, 5)], calls: [] });
eq(failedOnly.ready, false, "a failed sitting does not make a report");
eq(failedOnly.band, null, "a failed sitting claims no band");

// --- The band is what she demonstrated, promoted by exactly one -------------
const passedB1 = buildReport({ attempts: [], progress: [], exams: [exam("B1", true, 10, 82)], calls: [] });
eq(passedB1.ready, true, "a passed sitting makes a report");
eq(passedB1.band, "B2", "passing at B1 certifies B2");
eq(passedB1.examScore, 82, "the passing score is carried");
eq(passedB1.passedAt, 10, "the sitting date is carried");

// With several passes, the highest wins — and a later FAILED attempt at a higher
// level must not inflate it.
const mixed = buildReport({
  attempts: [],
  progress: [],
  exams: [exam("A2", true, 5), exam("B1", true, 10), exam("B2", false, 20)],
  calls: [],
});
eq(mixed.band, "B2", "highest passed sitting wins, failures ignored");

// The ceiling holds.
eq(buildReport({ attempts: [], progress: [], exams: [exam("C2", true, 1)], calls: [] }).band, "C2", "C2 cannot be exceeded");

// --- Every number is measured ---------------------------------------------
const full = buildReport({
  attempts: [att(1 * DAY, true), att(1 * DAY, false), att(2 * DAY, true), att(2 * DAY, true)],
  progress: [prog("a", 5), prog("b", 5), prog("c", 2)],
  exams: [exam("B1", true, 3 * DAY, 78)],
  calls: [call(1, 70), call(2, 90)],
});
eq(full.practiceSessions, 4, "practice sessions counts attempts");
eq(full.activeDays, 2, "active days counts distinct days");
eq(full.accuracy, 75, "accuracy is passes over attempts");
eq(full.phrasesMastered, 2, "only mastered items count");
eq(full.callsCompleted, 2, "calls are counted");
eq(full.callAverage, 80, "call average is the mean");

// No calls yet is null, not a fake zero — zero would read as "scored badly".
eq(full.callsCompleted > 0, true, "sanity");
eq(buildReport({ attempts: [], progress: [], exams: [exam("A1", true, 1)], calls: [] }).callAverage, null, "no calls means null, not 0");

// --- The document id is stable and does not leak the profile id ------------
const a = buildReport({ attempts: [], progress: [], exams: [exam("B1", true, 99)], calls: [], profileId: "mariana-secret" });
const b = buildReport({ attempts: [], progress: [], exams: [exam("B1", true, 99)], calls: [], profileId: "mariana-secret" });
eq(a.id, b.id, "the id is stable for the same inputs");
eq(a.id.includes("mariana"), false, "the id does not contain the profile id");
eq(/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(a.id), true, "the id is a short hex pair");

// Empty everything must not throw or produce NaN.
const empty = buildReport({ attempts: [], progress: [], exams: [], calls: [] });
eq(empty.accuracy, 0, "no attempts is 0 accuracy, not NaN");
eq(empty.activeDays, 0, "no attempts is 0 active days");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
