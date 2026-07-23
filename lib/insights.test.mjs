// node lib/insights.test.mjs
import { computeInsights } from "./insights.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const att = (at, score, passed) => ({ itemId: "x", lessonId: "l", categoryId: "c", phoneme: "p", target: "t", heard: "t", score, passed, at });
const ev = (type, at, props) => ({ type, at, day: new Date(at).toISOString().slice(0, 10), props });

// empty
const e = computeInsights([], [], NOW);
eq(e.activeDays30, 0, "empty active days");
eq(e.passRate, 0, "empty pass rate");
eq(e.scoreTrend, "na", "empty trend na");
eq(e.completionRate, null, "empty completion null");

// active days: attempts on 3 distinct days within 30
const a3 = [att(NOW - 1 * DAY, 90, true), att(NOW - 1 * DAY, 80, true), att(NOW - 2 * DAY, 70, true), att(NOW - 5 * DAY, 60, false)];
const r3 = computeInsights(a3, [], NOW);
eq(r3.activeDays30, 3, "3 distinct active days");
eq(r3.attempts, 4, "attempt count");
eq(r3.passRate, 75, "pass rate 3/4");

// trend up: earlier 20 low, recent 20 high
const up = [];
for (let i = 0; i < 20; i++) up.push(att(NOW - (40 - i) * 1000, 60, true));
for (let i = 0; i < 20; i++) up.push(att(NOW - (20 - i) * 1000, 90, true));
eq(computeInsights(up, [], NOW).scoreTrend, "up", "trend up");
eq(computeInsights(up, [], NOW).recentAvgScore, 90, "recent avg 90");

// trend down
const down = [];
for (let i = 0; i < 20; i++) down.push(att(NOW - (40 - i) * 1000, 90, true));
for (let i = 0; i < 20; i++) down.push(att(NOW - (20 - i) * 1000, 60, true));
eq(computeInsights(down, [], NOW).scoreTrend, "down", "trend down");

// completion rate + active days from events
const events = [
  ev("app_open", NOW - 3 * DAY),
  ev("lesson_start", NOW - 3 * DAY),
  ev("lesson_start", NOW - 2 * DAY),
  ev("lesson_complete", NOW - 3 * DAY),
  ev("mode_open", NOW - 1 * DAY, { mode: "talk" }),
  ev("mode_open", NOW - 1 * DAY, { mode: "talk" }),
  ev("mode_open", NOW - 1 * DAY, { mode: "radio" }),
];
const ri = computeInsights([], events, NOW);
eq(ri.completionRate, 50, "completion 1/2 = 50%");
truthy(ri.activeDays30 >= 1, "app_open contributes active day");
eq(ri.topModes[0], { mode: "talk", count: 2 }, "top mode talk x2");

console.log(`\n${ok} ok, ${fail} fail`);
if (fail) process.exit(1);
