// npx tsx lib/exams.test.mjs
//
// The exam is what makes a level earned rather than claimed, so the properties
// that must hold are: it cannot be attempted early, it cannot be passed by
// abandoning it, a fail costs nothing but a day, and a pass promotes exactly one
// stage.
import { examEligibility, scoreExam, canAttemptToday, UNLOCK_RATIO, PASS_SCORE, SECTIONS } from "./exams.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };

// box 5 == MASTERED_BOX; lastResult is "pass" | "fail" | null.
const prog = (itemId, box) => ({ itemId, lessonId: "l", categoryId: "c", phoneme: "p", attempts: 4, passes: 3, box, dueAt: 0, lastResult: "pass", lastScore: 80, updatedAt: 1 });
const pool = Array.from({ length: 10 }, (_, i) => `it${i}`);

// --- Eligibility -----------------------------------------------------------
eq(examEligibility([], pool).eligible, false, "no progress cannot attempt");
eq(examEligibility([], pool).remaining, 8, "needs 8 of 10 mastered");
eq(examEligibility([], []).eligible, false, "an empty pool is never eligible");

const sevenMastered = pool.slice(0, 7).map((id) => prog(id, 5));
eq(examEligibility(sevenMastered, pool).eligible, false, "70 percent is not enough");
eq(examEligibility(sevenMastered, pool).remaining, 1, "one item short");

const eightMastered = pool.slice(0, 8).map((id) => prog(id, 5));
eq(examEligibility(eightMastered, pool).eligible, true, "80 percent unlocks the exam");
eq(examEligibility(eightMastered, pool).mastered, 8, "counts mastered items");

// Practised but unmastered items must not count toward the gate.
const busyButUnmastered = pool.map((id) => prog(id, 4));
eq(examEligibility(busyButUnmastered, pool).eligible, false, "grinding without mastering does not unlock");
eq(UNLOCK_RATIO, 0.8, "unlock ratio is 80 percent");

// Progress on items OUTSIDE the band must not unlock this band's exam.
const elsewhere = Array.from({ length: 20 }, (_, i) => prog(`other${i}`, 5));
eq(examEligibility(elsewhere, pool).eligible, false, "mastery elsewhere does not unlock this stage");

// --- Scoring and promotion -------------------------------------------------
const all = (score) => SECTIONS.map((s) => ({ key: s.key, score }));

const strong = scoreExam(all(90), "B1");
eq(strong.passed, true, "90 across the board passes");
eq(strong.level, "B2", "a pass promotes exactly one stage");

const weakAttempt = scoreExam(all(50), "B1");
eq(weakAttempt.passed, false, "50 across the board fails");
eq(weakAttempt.level, "B1", "a fail does not change the level");
eq(typeof weakAttempt.weakest, "string", "a fail names the weakest section");

// An abandoned exam must not pass: missing sections score zero, not skipped.
const abandoned = scoreExam([{ key: "readAloud", score: 100 }], "A2");
eq(abandoned.passed, false, "answering one section only cannot pass");
eq(abandoned.sections.length, SECTIONS.length, "every section is reported");
eq(abandoned.sections.filter((s) => s.score === 0).length, SECTIONS.length - 1, "unanswered sections score zero");

// The open-ended sections carry more weight than the scripted ones.
const scriptedOnly = scoreExam(
  SECTIONS.map((s) => ({ key: s.key, score: s.key === "retell" || s.key === "openResponse" ? 0 : 100 })),
  "B1",
);
const openOnly = scoreExam(
  SECTIONS.map((s) => ({ key: s.key, score: s.key === "retell" || s.key === "openResponse" ? 100 : 0 })),
  "B1",
);
eq(scriptedOnly.score < 100 && scriptedOnly.score > 0, true, "scripted-only is partial credit");
eq(openOnly.score > 0, true, "open-only earns its weight");
eq(scoreExam(all(PASS_SCORE), "A1").passed, true, "exactly the pass mark passes");
eq(scoreExam(all(PASS_SCORE - 1), "A1").passed, false, "one below the pass mark fails");

// The ceiling must not overflow past C2.
eq(scoreExam(all(95), "C2").level, "C2", "C2 cannot be promoted further");

// Degenerate scores are clamped rather than trusted.
eq(scoreExam([{ key: "readAloud", score: 500 }, ...all(100).slice(1)], "A1").score <= 100, true, "score is clamped to 100");
eq(Number.isFinite(scoreExam([{ key: "readAloud", score: NaN }], "A1").score), true, "NaN cannot escape");

// --- One attempt per day ---------------------------------------------------
eq(canAttemptToday(null, "2026-07-27"), true, "a first attempt is allowed");
eq(canAttemptToday("2026-07-26", "2026-07-27"), true, "yesterday's attempt does not block today");
eq(canAttemptToday("2026-07-27", "2026-07-27"), false, "a second attempt the same day is blocked");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
