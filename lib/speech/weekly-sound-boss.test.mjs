import test from "node:test";
import assert from "node:assert/strict";
import { selectWeeklySoundBoss } from "./weekly-sound-boss.ts";

const row = (feature, score, at, overrides = {}) => ({
  itemId: `${feature}:${at}`,
  providerStatus: "valid",
  policyVersion: "latam-v1",
  targetPhonemeScore: score,
  weakestPhoneme: feature,
  at,
  ...overrides,
});

test("selects three weakest high-impact current sounds with stable ties", () => {
  const attempts = [
    row("th", 50, 9), row("th", 60, 8),
    row("b-v", 50, 7), row("b-v", 60, 6),
    row("final-endings", 20, 5), row("final-endings", 30, 4),
    row("sentence-rhythm", 5, 3), row("sentence-rhythm", 10, 2),
  ];
  const result = selectWeeklySoundBoss({ attempts, curriculumFeatures: ["sentence-rhythm", "th", "final-endings", "b-v"] });
  assert.deepEqual(result.map(({ feature }) => feature), ["b-v", "th", "final-endings"]);
});

test("requires two valid policy/provider measurements and rejects unsafe rows", () => {
  const attempts = [
    row("th", 20, 10),
    row("b-v", 20, 9), row("b-v", 30, 8, { providerStatus: "technical-skip" }),
    row("final-endings", 20, 7), row("final-endings", 30, 6, { policyVersion: undefined }),
    row("h", 35, 5), row("h", 45, 4),
    row("short-i-long-ee", 40, 3), row("short-i-long-ee", 50, 2),
  ];
  const result = selectWeeklySoundBoss({ attempts, curriculumFeatures: ["th", "b-v", "final-endings", "h", "short-i-long-ee"] });
  assert.deepEqual(result.map(({ feature }) => feature), ["short-i-long-ee", "h"]);
  assert.ok(result.every(({ evidenceStatus, validAttempts }) => evidenceStatus === "valid" && validAttempts >= 2));
});

test("returns fewer than three or empty without padding or stereotypes", () => {
  const one = selectWeeklySoundBoss({ attempts: [row("flap", 40, 2), row("flap", 60, 1)], curriculumFeatures: ["flap"] });
  const none = selectWeeklySoundBoss({ attempts: [row("th", 30, 1)], curriculumFeatures: ["th"] });
  assert.deepEqual(one.map(({ feature }) => feature), ["flap"]);
  assert.deepEqual(none, []);
});

test("bounds history before aggregation and ignores sounds outside current curriculum", () => {
  const recent = Array.from({ length: 80 }, (_, index) => row("th", 70, 200 - index));
  const old = [row("b-v", 1, 2), row("b-v", 1, 1)];
  const result = selectWeeklySoundBoss({ attempts: [...recent, ...old], curriculumFeatures: ["th"] });
  assert.deepEqual(result.map(({ feature, score, validAttempts }) => ({ feature, score, validAttempts })), [
    { feature: "th", score: 70, validAttempts: 80 },
  ]);
});
