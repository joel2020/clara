// node lib/daily-session.test.mjs
//
// The daily plan is a learner-facing promise: the same evidence must produce the
// same short, bounded session, and a recorder outage must never be mistaken for
// something the learner needs to fix.
import assert from "node:assert/strict";
import { composeDailySession, nextActivity, sessionProgress } from "./daily-session.ts";

let ok = 0;
const test = (name, fn) => {
  try { fn(); ok++; }
  catch (error) { console.log("FAIL", name, error.message); process.exitCode = 1; }
};

const item = (id, phoneme = "v") => ({ id, text: id, ipa: "", mouthHint: "", kind: "word", categoryId: "sounds", phoneme });
const lesson = (id, items, order = 1) => ({ id, title: id, subtitle: "", description: "", kind: "sound-focus", categoryIds: ["sounds"], items, order });
const scenario = { id: "cafe", emoji: "☕", title: { es: "Café", en: "Cafe" }, blurb: { es: "", en: "" }, role: "barista", setting: "cafe", opener: { es: "", en: "" }, starters: [] };

function fixture(overrides = {}) {
  const now = 1_753_747_200_000;
  const worked = item("worked", "v");
  const other = item("other", "ɪ");
  const weakPhoneme = overrides.weakPhoneme ?? "ɪ";
  return {
    profileId: "student-1",
    day: "2026-07-29",
    now,
    level: "A1",
    path: "general",
    lessons: [lesson("sounds", [worked, other])],
    scenarios: [scenario],
    progress: [{ itemId: weakPhoneme === "ɪ" ? "other" : "worked", lessonId: "sounds", categoryId: "sounds", phoneme: weakPhoneme, attempts: 4, passes: 1, box: 0, dueAt: now - 1_000, lastResult: "fail", lastScore: 35, updatedAt: now - 10_000 }],
    attempts: [],
    ...overrides,
  };
}

test("stable plan responds to evidence", () => {
  const a = composeDailySession(fixture({ day: "2026-07-29", level: "A1", weakPhoneme: "ɪ" }));
  const b = composeDailySession(fixture({ day: "2026-07-29", level: "A1", weakPhoneme: "v" }));
  assert.deepEqual(composeDailySession(fixture({ day: "2026-07-29", level: "A1", weakPhoneme: "ɪ" })), a);
  assert.notDeepEqual(a.activities.map(x => x.targetIds), b.activities.map(x => x.targetIds));
  assert.equal(a.assistance, "spanish-full");
});

test("technical failures are not weaknesses", () => {
  const plan = composeDailySession(fixture({
    attempts: [{ itemId: "worked", passed: false, evidence: "technical-failure" }],
  }));
  assert.equal(plan.activities.some(x => x.reason === "recent-mistake" && x.targetIds.includes("worked")), false);
});

test("the composer keeps one short activity per purpose", () => {
  const plan = composeDailySession(fixture());
  assert.equal(plan.activities.length, 6);
  assert.equal(new Set(plan.activities.map((activity) => activity.kind)).size, 6);
  assert.ok(plan.activities.reduce((minutes, activity) => minutes + activity.estimatedMinutes, 0) <= 15);
  assert.ok(plan.activities.some((activity) => activity.reason === "review-due"));
});

test("larger recentMinutes de-prioritizes more-repeated tied candidates", () => {
  const now = 1_753_747_200_000;
  const repeated = { itemId: "a-repeated", lessonId: "sounds", categoryId: "sounds", phoneme: "v", attempts: 10, passes: 5, box: 1, dueAt: now - 1_000, lastResult: "fail", lastScore: 50, updatedAt: now - 10_000 };
  const fresh = { ...repeated, itemId: "z-fresh", attempts: 2, passes: 1 };
  const input = fixture({
    now,
    lessons: [lesson("sounds", [item("a-repeated"), item("z-fresh")])],
    progress: [repeated, fresh],
  });
  assert.equal(composeDailySession({ ...input, recentMinutes: 1 }).activities[0].targetIds[0], "a-repeated");
  assert.equal(composeDailySession({ ...input, recentMinutes: 1_000 }).activities[0].targetIds[0], "z-fresh");
});

test("progress and next activity ignore technical skips", () => {
  const plan = composeDailySession(fixture());
  plan.activities[0].status = "completed";
  plan.activities[1].status = "technical-skip";
  assert.deepEqual(sessionProgress(plan), { completed: 1, total: 6, percentage: 17 });
  assert.equal(nextActivity(plan)?.id, plan.activities[2].id);
});

console.log(`${ok} ok, ${process.exitCode ? 1 : 0} failed`);
