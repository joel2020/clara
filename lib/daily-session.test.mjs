// node lib/daily-session.test.mjs
//
// The daily plan is a learner-facing promise: the same evidence must produce the
// same short, bounded session, and a recorder outage must never be mistaken for
// something the learner needs to fix.
import assert from "node:assert/strict";
import { composeDailySession, isAuthoredDailyPronunciationActivity, migrateLegacyDailyPronunciationActivity, nextActivity, sessionProgress } from "./daily-session.ts";
import { LESSONS } from "./content/lessons.ts";

let ok = 0;
const test = (name, fn) => {
  try { fn(); ok++; }
  catch (error) { console.log("FAIL", name, error.message); process.exitCode = 1; }
};

const item = (id, phoneme = "v") => ({ id, text: id, ipa: "", mouthHint: "", kind: "word", categoryId: "sounds", phoneme });
const lesson = (id, items, order = 1) => ({ id, title: id, subtitle: "", description: "", kind: "sound-focus", categoryIds: ["sounds"], items, order });
const scenario = { id: "cafe", emoji: "☕", title: { es: "Café", en: "Cafe" }, blurb: { es: "", en: "" }, role: "barista", setting: "cafe", opener: { es: "", en: "" }, starters: [] };

test("shipped v1 pronunciation targets migrate from canonical curriculum identity only", () => {
  const legacy = {
    mode: "scored", game: "sound-sprint", selectionSource: "latam-prior", feature: "th",
    targets: ["th:three", "th:both", "th:thank"].map((id) => ({
      id, text: "FORGED", ipa: "/wrong/", mouthHint: "unsafe", kind: "phrase",
      categoryId: "wrong", phoneme: "wrong",
    })),
  };
  const migrated = migrateLegacyDailyPronunciationActivity(legacy);
  assert.ok(migrated);
  assert.equal(isAuthoredDailyPronunciationActivity(migrated), true);
  assert.deepEqual(migrated.targets.map((target) => target.id), ["th:three", "th:both", "th:thank"]);
  assert.deepEqual(migrated.targets.map((target) => target.text), ["three", "both", "thank"]);
  assert.equal(migrated.state.targetIndex, 0);
  assert.deepEqual(migrated.state.attemptEvents, []);
  assert.deepEqual(migrated.state.resolutions, [null, null, null]);
});

test("legacy pronunciation migration rejects unknown target identity", () => {
  assert.equal(migrateLegacyDailyPronunciationActivity({
    mode: "scored", game: "sound-sprint", selectionSource: "curriculum-fallback",
    targets: ["unknown:one", "unknown:two", "unknown:three"].map((id) => ({ id, text: "invented" })),
  }), null);
});

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

test("every normal session contains one scored pronunciation game with exactly three short authored targets", () => {
  for (const day of ["2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"]) {
    const plan = composeDailySession(fixture({ day }));
    const strict = plan.activities.filter((entry) => entry.pronunciation?.mode === "scored");
    assert.equal(strict.length, 1);
    assert.equal(strict[0].kind, "speak");
    assert.equal(strict[0].pronunciation.targets.length, 3);
    assert.ok(strict[0].pronunciation.targets.every((target) => target.text.length > 0 && target.text.length <= 80));
  }
});

test("a recent strict valid miss wins over due curriculum and personal weakness", () => {
  const now = 1_753_747_200_000;
  const plan = composeDailySession(fixture({
    now,
    lessons: [lesson("sounds", [item("due", "v"), item("recent-miss", "θ"), item("personal", "ɪ")])],
    progress: [
      { itemId: "due", lessonId: "sounds", categoryId: "sounds", phoneme: "v", attempts: 4, passes: 2, box: 1, dueAt: now - 10_000, lastResult: "fail", lastScore: 55, updatedAt: now - 10_000 },
      { itemId: "recent-miss", lessonId: "sounds", categoryId: "sounds", phoneme: "θ", attempts: 1, passes: 0, box: 1, dueAt: now + 10_000, lastResult: "fail", lastScore: 62, updatedAt: now - 1_000 },
      { itemId: "personal", lessonId: "sounds", categoryId: "sounds", phoneme: "ɪ", attempts: 3, passes: 1, box: 1, dueAt: now + 20_000, lastResult: "fail", lastScore: 44, updatedAt: now - 2_000 },
    ],
    attempts: [
      { itemId: "personal", passed: false, evidence: "valid", at: now - 2_000, providerStatus: "valid", policyVersion: "latam-v1", targetPhonemeScore: 40, weakestPhoneme: "short-i-long-ee" },
      { itemId: "recent-miss", passed: false, evidence: "valid", at: now - 1_000, providerStatus: "valid", policyVersion: "latam-v1", targetPhonemeScore: 62, weakestPhoneme: "th" },
    ],
  }));
  const speaking = plan.activities.find((entry) => entry.kind === "speak");
  assert.equal(speaking.pronunciation.selectionSource, "curriculum-fallback");
  assert.equal(speaking.sourceId, "i-vs-ii");
  assert.ok(speaking.pronunciation.targets.every((target) => target.lessonId === "i-vs-ii"));
});

test("lesson metadata maps structure markers without equality fallbacks", () => {
  const cases = [
    ["connected-speech", "linking", "connected-speech"],
    ["final-clusters", "ksts", "final-clusters"],
    ["word-stress", "noun", undefined],
    ["flap-t", "flap", "flap"],
    ["ed-endings", "t", "final-endings"],
  ];
  for (const [lessonId, phoneme, feature] of cases) {
    const now = 1_753_747_200_000;
    const target = item(`${lessonId}:target`, phoneme);
    const plan = composeDailySession(fixture({
      now,
      lessons: [lesson(lessonId, [target])],
      progress: [{ itemId: target.id, lessonId, categoryId: lessonId, phoneme, attempts: 1, passes: 0, box: 1, dueAt: now - 1, lastResult: "fail", lastScore: 40, updatedAt: now - 1 }],
    }));
    const speaking = plan.activities.find((entry) => entry.kind === "speak");
    assert.equal(speaking.pronunciation.feature, feature, lessonId);
    if (lessonId === "word-stress") assert.notEqual(speaking.pronunciation.targets[0].id, target.id, lessonId);
    else assert.equal(speaking.pronunciation.targets[0].id, target.id, lessonId);
  }
  const unknown = composeDailySession(fixture({ lessons: [lesson("custom-unknown", [item("unknown", "noun")])], progress: [] }));
  assert.equal(unknown.activities.find((entry) => entry.kind === "speak").pronunciation.feature, undefined);
});

test("a due item wins when there is no recent strict miss", () => {
  const plan = composeDailySession(fixture({ attempts: [] }));
  const speaking = plan.activities.find((entry) => entry.kind === "speak");
  assert.equal(speaking.pronunciation.selectionSource, "curriculum-fallback");
  assert.ok(speaking.pronunciation.targets.every((target) => target.lessonId === "i-vs-ii"));
});

test("a current personal weakness wins over the LATAM prior when no miss or due item exists", () => {
  const now = 1_753_747_200_000;
  const plan = composeDailySession(fixture({
    now,
    lessons: [lesson("sounds", [item("prior", "ɪ"), item("personal", "θ")])],
    progress: [
      { itemId: "prior", lessonId: "sounds", categoryId: "sounds", phoneme: "ɪ", attempts: 1, passes: 1, box: 3, dueAt: now + 10_000, lastResult: "pass", lastScore: 92, updatedAt: now - 10_000 },
      { itemId: "personal", lessonId: "sounds", categoryId: "sounds", phoneme: "θ", attempts: 3, passes: 1, box: 2, dueAt: now + 20_000, lastResult: "fail", lastScore: 56, updatedAt: now - 1_000 },
    ],
    attempts: [
      { itemId: "personal", passed: false, evidence: "valid", at: now - 10 * 86_400_000, providerStatus: "valid", policyVersion: "latam-v1", targetPhonemeScore: 42, weakestPhoneme: "th" },
      { itemId: "personal", passed: false, evidence: "valid", at: now - 11 * 86_400_000, providerStatus: "valid", policyVersion: "latam-v1", targetPhonemeScore: 52, weakestPhoneme: "th" },
    ],
  }));
  const speaking = plan.activities.find((entry) => entry.kind === "speak");
  assert.equal(speaking.pronunciation.selectionSource, "curriculum-fallback");
  assert.notEqual(speaking.pronunciation.targets[0].id, "personal");
});

test("legacy, technical, unavailable, and ungraded rows cannot steer strict speaking", () => {
  const now = 1_753_747_200_000;
  const unsafe = [
    { itemId: "unsafe", passed: false, evidence: "valid", at: now },
    { itemId: "unsafe", passed: false, evidence: "technical-failure", at: now, providerStatus: "valid", policyVersion: "latam-v1", targetPhonemeScore: 1 },
    { itemId: "unsafe", passed: false, evidence: "valid", at: now, providerStatus: "unavailable", policyVersion: "latam-v1", targetPhonemeScore: 1 },
    { itemId: "unsafe", passed: false, evidence: "valid", at: now, providerStatus: "valid", targetPhonemeScore: 1 },
  ];
  const plan = composeDailySession(fixture({
    now,
    lessons: [lesson("sounds", [item("safe", "ɪ"), item("unsafe", "θ")])],
    progress: [
      { itemId: "safe", lessonId: "sounds", categoryId: "sounds", phoneme: "ɪ", attempts: 1, passes: 1, box: 3, dueAt: now + 10_000, lastResult: "pass", lastScore: 95, updatedAt: now - 1_000 },
      { itemId: "unsafe", lessonId: "sounds", categoryId: "sounds", phoneme: "θ", attempts: 1, passes: 1, box: 3, dueAt: now + 10_000, lastResult: "pass", lastScore: 95, updatedAt: now },
    ],
    attempts: unsafe,
  }));
  const speaking = plan.activities.find((entry) => entry.kind === "speak");
  assert.equal(speaking.pronunciation.selectionSource, "curriculum-fallback");
  assert.notEqual(speaking.pronunciation.targets[0].id, "safe");
});

test("small and empty curriculum pools still produce a deterministic scored trio", () => {
  const one = composeDailySession(fixture({ lessons: [lesson("one", [item("only", "v")])], progress: [] }));
  const empty = composeDailySession(fixture({ lessons: [], progress: [], scenarios: [] }));
  assert.deepEqual(one, composeDailySession(fixture({ lessons: [lesson("one", [item("only", "v")])], progress: [] })));
  assert.equal(one.activities.find((entry) => entry.kind === "speak").pronunciation.targets.length, 3);
  assert.equal(empty.activities.find((entry) => entry.kind === "speak").pronunciation.targets.length, 3);
  assert.equal(new Set(one.activities.find((entry) => entry.kind === "speak").pronunciation.targets.map((target) => target.id)).size, 3);
  assert.equal(new Set(empty.activities.find((entry) => entry.kind === "speak").pronunciation.targets.map((target) => target.id)).size, 3);
  assert.ok(empty.activities.find((entry) => entry.kind === "speak").pronunciation.targets.every((target) => !target.id.startsWith("daily-safe:")));
});

test("Call Rescue uses one authored word with three explicit repair stages", () => {
  const th = LESSONS.find((entry) => entry.id === "th");
  const source = th.items.find((entry) => entry.kind === "word");
  const plans = Array.from({ length: 64 }, (_, offset) => composeDailySession(fixture({ day: `2026-09-${String(offset + 1).padStart(2, "0")}`, lessons: [th], progress: [{ itemId: source.id, lessonId: th.id, categoryId: source.categoryId, phoneme: source.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 60, updatedAt: 1 }] })));
  const call = plans.map((plan) => plan.activities.find((entry) => entry.kind === "speak").pronunciation).find((entry) => entry.game === "call-rescue");
  assert.ok(call);
  assert.equal(new Set(call.targets.map((target) => target.id)).size, 1);
  assert.equal(call.sourceTarget.id, source.id);
  assert.deepEqual(call.stages.map((stage) => stage.kind), ["call-keyword", "call-clarification", "call-confirmation"]);
  assert.ok(call.targets.every((target) => target.targetWord === source.text));
});

test("Call Rescue keeps the selected sound when the ranked item is a phrase", () => {
  const now = 1_753_747_200_000;
  const phrase = { ...item("phrase", "θ"), text: "Can you help me?", kind: "phrase" };
  const word = { ...item("three", "θ"), text: "three" };
  const inputs = Array.from({ length: 64 }, (_, offset) => fixture({
    day: `2026-11-${String(offset + 1).padStart(2, "0")}`,
    lessons: [lesson("th", [phrase, word])],
    progress: [{ itemId: "phrase", lessonId: "th", categoryId: "sounds", phoneme: "θ", attempts: 2, passes: 1, box: 1, dueAt: now - 1, lastResult: "fail", lastScore: 60, updatedAt: now - 1 }],
  }));
  const call = inputs.map(composeDailySession).map((plan) => plan.activities.find((entry) => entry.kind === "speak").pronunciation).find((entry) => entry.game === "call-rescue");
  assert.equal(call, undefined);
});

test("Echo Chain uses one authored phrase with clean cumulative recognition stages", () => {
  const connected = LESSONS.find((entry) => entry.id === "connected-speech");
  const source = connected.items[0];
  const plans = Array.from({ length: 64 }, (_, offset) => composeDailySession(fixture({ day: `2026-10-${String(offset + 1).padStart(2, "0")}`, lessons: [connected], progress: [{ itemId: source.id, lessonId: connected.id, categoryId: source.categoryId, phoneme: source.phoneme, attempts: 1, passes: 0, box: 1, dueAt: 0, lastResult: "fail", lastScore: 60, updatedAt: 1 }] })));
  const echo = plans.map((plan) => plan.activities.find((entry) => entry.kind === "speak").pronunciation).find((entry) => entry.game === "echo-chain");
  assert.ok(echo);
  assert.equal(new Set(echo.targets.map((target) => target.id)).size, 1);
  assert.equal(echo.sourceTarget.id, source.id);
  assert.ok(echo.stages.every((stage) => stage.kind === "echo-chunk" && stage.stressMarkedText && !/[A-Z]-[a-z]/.test(stage.text)));
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
