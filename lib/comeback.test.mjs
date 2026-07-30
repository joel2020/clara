// npx tsx lib/comeback.test.mjs
//
// A missed day is the moment an app is most tempted to use pressure. These
// tests hold the opposite line: the session gets shorter and starts with the
// one review that matters, nothing about the learner's streak or progress
// changes, and no string the learner can see trades on loss or guilt.
import assert from "node:assert/strict";
import { composeDailySession } from "./daily-session.ts";
import { composeComebackSession, missedLocalDays, selectNotification } from "./comeback.ts";

let ok = 0;
const test = (name, fn) => {
  try { fn(); ok++; }
  catch (error) { console.log("FAIL", name, error.message); process.exitCode = 1; }
};

const item = (id, phoneme = "v") => ({ id, text: id, ipa: "", mouthHint: "", kind: "word", categoryId: "sounds", phoneme });
const lesson = (id, items, order = 1) => ({ id, title: id, subtitle: "", description: "", kind: "sound-focus", categoryIds: ["sounds"], items, order });
const scenario = { id: "cafe", emoji: "", title: { es: "Café", en: "Cafe" }, blurb: { es: "", en: "" }, role: "barista", setting: "cafe", opener: { es: "", en: "" }, starters: [] };

const NOW = 1_753_747_200_000;

function fixture(overrides = {}) {
  return {
    profileId: "student-1",
    day: "2026-07-29",
    now: NOW,
    level: "A1",
    path: "general",
    lessons: [lesson("sounds", [item("worked", "v"), item("other", "ɪ")])],
    scenarios: [scenario],
    progress: [
      { itemId: "other", lessonId: "sounds", categoryId: "sounds", phoneme: "ɪ", attempts: 4, passes: 1, box: 0, dueAt: NOW - 1_000, lastResult: "fail", lastScore: 35, updatedAt: NOW - 10_000 },
      { itemId: "worked", lessonId: "sounds", categoryId: "sounds", phoneme: "v", attempts: 3, passes: 3, box: 3, dueAt: NOW + 500_000, lastResult: "pass", lastScore: 90, updatedAt: NOW - 20_000 },
    ],
    attempts: [],
    lastActiveDay: "2026-07-26",
    ...overrides,
  };
}

const minutes = (session) => session.activities.reduce((total, entry) => total + entry.estimatedMinutes, 0);

test("missed days are counted in whole local days", () => {
  assert.equal(missedLocalDays(null, "2026-07-29"), 0);        // never practiced
  assert.equal(missedLocalDays("2026-07-29", "2026-07-29"), 0); // practiced today
  assert.equal(missedLocalDays("2026-07-28", "2026-07-29"), 0); // practiced yesterday
  assert.equal(missedLocalDays("2026-07-27", "2026-07-29"), 1);
  assert.equal(missedLocalDays("2026-07-22", "2026-08-01"), 9); // across a month edge
});

test("a missed day makes the session shorter, not longer", () => {
  const input = fixture();
  const normal = composeDailySession(input);
  const comeback = composeComebackSession(input);
  assert.ok(minutes(comeback) < minutes(normal), `${minutes(comeback)} should be under ${minutes(normal)}`);
  assert.ok(minutes(comeback) >= 5 && minutes(comeback) <= 8, `budget was ${minutes(comeback)}`);
  assert.ok(comeback.activities.length < normal.activities.length);
});

test("zero missed days is the ordinary session, untouched", () => {
  for (const lastActiveDay of ["2026-07-29", "2026-07-28", null]) {
    const input = fixture({ lastActiveDay });
    assert.deepEqual(composeComebackSession(input), composeDailySession(input));
  }
});

test("one important review is prioritized, and only one", () => {
  const comeback = composeComebackSession(fixture());
  assert.equal(comeback.activities[0].kind, "retrieve");
  assert.equal(comeback.activities[0].reason, "review-due");
  assert.deepEqual(comeback.activities[0].targetIds, ["other"]);
  assert.equal(comeback.activities.filter((entry) => entry.kind === "retrieve").length, 1);
  assert.equal(comeback.activities.filter((entry) => entry.reason === "review-due").length, 1);
  assert.equal(comeback.activities.some((entry) => entry.kind === "learn"), false); // no new material while catching up
  assert.equal(comeback.currentActivityId, comeback.activities[0].id);
});

test("streak state rules are preserved: nothing is reset or invented", () => {
  const input = fixture({ lastActiveDay: "2026-06-01" }); // a long gap
  const before = structuredClone(input);
  const comeback = composeComebackSession(input);
  assert.deepEqual(input, before); // the composer reads evidence, it never rewrites it
  const normal = composeDailySession(input);
  assert.equal(comeback.id, normal.id);
  assert.equal(comeback.day, normal.day);
  assert.equal(comeback.profileId, normal.profileId);
  assert.equal(comeback.assistance, normal.assistance);
  assert.deepEqual(Object.keys(comeback).filter((key) => /streak|freeze|penalt/i.test(key)), []);
  assert.equal(comeback.rewardClaimed, false);
  assert.equal(comeback.startedAt, null);
  assert.equal(comeback.completedAt, null);
});

test("the same evidence always produces the same comeback", () => {
  assert.deepEqual(composeComebackSession(fixture()), composeComebackSession(fixture()));
});

test("a learner who practiced today is not reminded", () => {
  assert.equal(selectNotification(reminder({ practicedToday: true, dueReviews: 9 })), null);
});

test("reminders name something specific before anything generic", () => {
  const speaking = selectNotification(reminder({ unfinishedSpeaking: true, dueReviews: 4 }));
  assert.match(speaking.title, /hablada/);

  const due = selectNotification(reminder({ dueReviews: 4 }));
  assert.match(due.title, /4 repasos/);
  assert.match(selectNotification(reminder({ dueReviews: 1 })).title, /1 repaso listo/);
  assert.match(selectNotification(reminder({ lang: "en", dueReviews: 1 })).title, /1 review is ready/);

  const ready = selectNotification(reminder({ readyActivity: { es: "Di una respuesta clara", en: "Say a clear response" } }));
  assert.match(ready.body, /Di una respuesta clara/);

  const nothingKnown = selectNotification(reminder({}));
  assert.match(nothingKnown.title, /Cinco minutos/); // still concrete about the ask
});

test("a known name is used without changing the message", () => {
  const named = selectNotification(reminder({ name: "Mariana Ruiz", dueReviews: 2 }));
  assert.ok(named.body.startsWith("Mariana, "));
  assert.equal(named.title, selectNotification(reminder({ dueReviews: 2 })).title);
});

// Loss aversion is the default voice of streak apps. It is banned here, in both
// languages, in every string a learner can see.
const GUILT = [
  /\blose\b/i, /\blosing\b/i, /\blost\b/i, /\bdying\b/i, /\bdie\b/i,
  /misses you/i, /miss(es)? your/i, /don'?t disappoint/i, /keep it alive/i,
  /before it'?s gone/i, /last chance/i, /don'?t break/i,
  /\bperdiste\b/i, /vas a perder/i, /\bpierdes\b/i, /\bperder\b/i,
  /te extraña/i, /\bmuriendo\b/i, /no la dejes/i, /última oportunidad/i,
  /te falta/i, /\bfallaste\b/i,
];

function guiltFree(label, strings) {
  for (const value of strings) {
    for (const pattern of GUILT) {
      assert.equal(pattern.test(value), false, `${label}: "${value}" matches ${pattern}`);
    }
  }
}

test("comeback copy welcomes without guilt", () => {
  const comeback = composeComebackSession(fixture());
  guiltFree("session", [
    comeback.objective.es, comeback.objective.en,
    comeback.outcome.es, comeback.outcome.en,
    ...comeback.activities.flatMap((entry) => [entry.title.es, entry.title.en]),
  ]);
});

test("reminder copy invites without guilt", () => {
  const contexts = [
    {}, { unfinishedSpeaking: true }, { dueReviews: 1 }, { dueReviews: 7 },
    { readyActivity: { es: "Escucha el contraste", en: "Hear the contrast" } },
  ];
  for (const lang of ["es", "en"]) {
    for (const name of [null, "Mariana"]) {
      for (const extra of contexts) {
        const message = selectNotification(reminder({ lang, name, ...extra }));
        guiltFree(`reminder ${lang}`, [message.title, message.body]);
      }
    }
  }
});

function reminder(overrides = {}) {
  return {
    lang: "es",
    name: null,
    practicedToday: false,
    unfinishedSpeaking: false,
    dueReviews: 0,
    readyActivity: null,
    ...overrides,
  };
}

console.log(`${ok} ok, ${process.exitCode ? 1 : 0} failed`);
