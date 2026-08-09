// node --experimental-strip-types lib/speech/pronunciation-session.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { PASS_XP, roundRewardXp } from "../gamification.ts";
import {
  INITIAL_PRONUNCIATION_SESSION_STATE,
  transitionPronunciationSession,
} from "./pronunciation-session.ts";

const verdict = (outcome) => ({
  policyVersion: "latam-v1",
  outcome,
  reasons: [],
});

const valid = (outcome, score) => ({
  type: "valid-verdict",
  verdict: verdict(outcome),
  score,
});

const retryStates = [
  {
    from: INITIAL_PRONUNCIATION_SESSION_STATE,
    want: { validAttempts: 1, firstValidScore: 74, status: "active" },
    stage: 2,
    multiplier: 0,
  },
  {
    from: { validAttempts: 1, firstValidScore: 61, status: "active" },
    want: { validAttempts: 2, firstValidScore: 61, status: "active" },
    stage: 3,
    multiplier: 0,
  },
  {
    from: { validAttempts: 2, firstValidScore: 61, status: "active" },
    want: {
      validAttempts: 3,
      firstValidScore: 61,
      status: "practiced-not-mastered",
    },
    stage: 3,
    multiplier: 0.25,
  },
];

test("retry transition table ends with practiced-not-mastered, never an exhaustion pass", () => {
  for (const row of retryStates) {
    const result = transitionPronunciationSession(row.from, valid("retry", 74));
    assert.deepEqual(result.state, row.want);
    assert.equal(result.coachingStage, row.stage);
    assert.equal(result.rewardMultiplier, row.multiplier);
    assert.equal(result.srsPass, false);
    assert.equal(result.masteryStars, 0);
    assert.equal(result.combo, 0);
  }
});

test("the third valid miss awards exactly one rounded quarter of base practice XP", () => {
  const result = transitionPronunciationSession(
    { validAttempts: 2, firstValidScore: 70, status: "active" },
    valid("retry", 79),
  );

  assert.equal(PASS_XP, 10);
  assert.equal(roundRewardXp(PASS_XP, 0.25), 3);
  assert.equal(result.xpAward, 3);
  assert.equal(result.rewardMultiplier, 0.25);
  assert.equal(result.masteryStars, 0);
  assert.equal(result.combo, 0);
  assert.equal(result.srsPass, false);
  assert.equal(result.dueDayOffset, 1);
  assert.equal(result.canContinue, true);
});

test("only an explicit mastered verdict can produce mastery evidence", () => {
  for (const [score, stars] of [[0, 1], [79, 1], [80, 2], [91, 2], [92, 3], [100, 3]]) {
    const result = transitionPronunciationSession(
      INITIAL_PRONUNCIATION_SESSION_STATE,
      valid("mastered", score),
    );
    assert.equal(result.state.status, "mastered");
    assert.equal(result.state.validAttempts, 1);
    assert.equal(result.state.firstValidScore, score);
    assert.equal(result.rewardMultiplier, 1);
    assert.equal(result.xpAward, PASS_XP);
    assert.equal(result.masteryStars, stars);
    assert.equal(result.combo, 1);
    assert.equal(result.srsPass, true);
    assert.equal(result.canContinue, true);
  }
});

test("a mastered transition preserves the caller's consecutive clear combo", () => {
  const result = transitionPronunciationSession(
    { validAttempts: 0, status: "active" },
    {
      type: "valid-verdict",
      verdict: { policyVersion: "latam-v1", outcome: "mastered", reasons: [] },
      score: 94,
      combo: 4,
    },
  );
  assert.equal(result.combo, 4);
});

test("diagnostic and technical verdicts never consume a valid attempt", () => {
  const activeStates = [
    INITIAL_PRONUNCIATION_SESSION_STATE,
    { validAttempts: 1, firstValidScore: 68, status: "active" },
    { validAttempts: 2, firstValidScore: 68, status: "active" },
  ];
  for (const before of activeStates) {
    for (const outcome of ["diagnostic", "technical-skip"]) {
      const result = transitionPronunciationSession(before, valid(outcome, undefined));
      assert.deepEqual(result.state, before);
      assert.notEqual(result.state, before);
      assert.equal(result.coachingStage, Math.min(before.validAttempts + 1, 3));
      assert.equal(result.xpAward, 0);
      assert.equal(result.masteryStars, 0);
      assert.equal(result.combo, 0);
      assert.equal(result.srsPass, false);
    }
  }
});

test("mastery and explicit outage-skip transitions work from every active stage", () => {
  const activeStates = [
    INITIAL_PRONUNCIATION_SESSION_STATE,
    { validAttempts: 1, firstValidScore: 68, status: "active" },
    { validAttempts: 2, firstValidScore: 68, status: "active" },
  ];
  for (const before of activeStates) {
    const mastered = transitionPronunciationSession(before, valid("mastered", 95));
    assert.equal(mastered.state.status, "mastered");
    assert.equal(mastered.state.validAttempts, before.validAttempts + 1);
    assert.equal(mastered.state.firstValidScore, before.firstValidScore ?? 95);
    assert.equal(mastered.srsPass, true);

    const skipped = transitionPronunciationSession(before, { type: "skip-after-outage" });
    assert.equal(skipped.state.status, "technical-skip");
    assert.equal(skipped.state.validAttempts, before.validAttempts);
    assert.equal(skipped.state.firstValidScore, before.firstValidScore);
    assert.equal(skipped.canContinue, true);
    assert.equal(skipped.xpAward, 0);
    assert.equal(skipped.srsPass, false);
  }
});

test("technical failures are neutral and an explicit outage skip lets navigation continue", () => {
  const before = { validAttempts: 1, firstValidScore: 68, status: "active" };
  const failure = transitionPronunciationSession(before, {
    type: "technical-failure",
    reason: "provider-timeout",
  });
  assert.deepEqual(failure.state, before);
  assert.equal(failure.canContinue, false);
  assert.equal(failure.xpAward, 0);

  const skipped = transitionPronunciationSession(failure.state, {
    type: "skip-after-outage",
  });
  assert.deepEqual(skipped.state, {
    validAttempts: 1,
    firstValidScore: 68,
    status: "technical-skip",
  });
  assert.equal(skipped.canContinue, true);
  assert.equal(skipped.xpAward, 0);
  assert.equal(skipped.masteryStars, 0);
  assert.equal(skipped.combo, 0);
  assert.equal(skipped.srsPass, false);
});

test("neutral event permutations cannot manufacture attempts or rewards", () => {
  const retry = valid("retry", 63);
  const neutralEvents = [
    { type: "technical-failure", reason: "microphone-denied" },
    valid("diagnostic", undefined),
    valid("technical-skip", undefined),
  ];
  const permutations = [
    [retry, ...neutralEvents],
    [neutralEvents[0], retry, neutralEvents[1], neutralEvents[2]],
    [neutralEvents[0], neutralEvents[1], retry, neutralEvents[2]],
    [...neutralEvents, retry],
    [neutralEvents[2], retry, neutralEvents[0], neutralEvents[1]],
    [neutralEvents[1], neutralEvents[2], retry, neutralEvents[0]],
  ];

  for (const events of permutations) {
    const result = events.reduce(
      (state, event) => transitionPronunciationSession(state, event).state,
      INITIAL_PRONUNCIATION_SESSION_STATE,
    );
    assert.equal(result.validAttempts, 1);
    assert.equal(result.firstValidScore, 63);
    assert.equal(result.status, "active");
  }
});

test("transitions do not mutate their state or event inputs", () => {
  const state = Object.freeze({ validAttempts: 2, firstValidScore: 71, status: "active" });
  const event = Object.freeze(valid("retry", 72));
  const beforeState = structuredClone(state);
  const beforeEvent = structuredClone(event);

  transitionPronunciationSession(state, event);

  assert.deepEqual(state, beforeState);
  assert.deepEqual(event, beforeEvent);
});

test("terminal states make replayed events idempotent and never duplicate awards", () => {
  const practiced = transitionPronunciationSession(
    { validAttempts: 2, firstValidScore: 70, status: "active" },
    valid("retry", 70),
  );
  const replayedPractice = transitionPronunciationSession(
    practiced.state,
    valid("retry", 70),
  );
  assert.deepEqual(replayedPractice.state, practiced.state);
  assert.equal(replayedPractice.xpAward, 0);
  assert.equal(replayedPractice.rewardMultiplier, 0);

  const mastered = transitionPronunciationSession(
    INITIAL_PRONUNCIATION_SESSION_STATE,
    valid("mastered", 95),
  );
  const replayedMastery = transitionPronunciationSession(
    mastered.state,
    valid("mastered", 95),
  );
  assert.deepEqual(replayedMastery.state, mastered.state);
  assert.equal(replayedMastery.xpAward, 0);
  assert.equal(replayedMastery.masteryStars, 0);
  assert.equal(replayedMastery.combo, 0);
  assert.equal(replayedMastery.srsPass, false);

  const technical = transitionPronunciationSession(
    INITIAL_PRONUNCIATION_SESSION_STATE,
    { type: "skip-after-outage" },
  );
  const replayedTechnical = transitionPronunciationSession(
    technical.state,
    { type: "skip-after-outage" },
  );
  assert.deepEqual(replayedTechnical.state, technical.state);
  assert.equal(replayedTechnical.xpAward, 0);
});

test("invalid or corrupt states and graded events fail closed", () => {
  const corruptStates = [
    { validAttempts: -1, status: "active" },
    { validAttempts: 1.5, firstValidScore: 70, status: "active" },
    { validAttempts: 4, firstValidScore: 70, status: "active" },
    { validAttempts: 1, status: "active" },
    { validAttempts: 0, firstValidScore: 70, status: "active" },
    { validAttempts: 3, firstValidScore: 70, status: "active" },
    { validAttempts: 2, firstValidScore: 70, status: "practiced-not-mastered" },
    { validAttempts: 3, firstValidScore: 70, status: "technical-skip" },
  ];
  for (const state of corruptStates) {
    assert.throws(() => transitionPronunciationSession(state, valid("retry", 70)));
  }

  for (const score of [undefined, -1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() =>
      transitionPronunciationSession(
        INITIAL_PRONUNCIATION_SESSION_STATE,
        valid("retry", score),
      ),
    );
  }
  assert.throws(() =>
    transitionPronunciationSession(INITIAL_PRONUNCIATION_SESSION_STATE, {
      type: "technical-failure",
      reason: "   ",
    }),
  );
});

test("the full status and attempt reachability table fails closed on impossible states", () => {
  const reachable = [
    { validAttempts: 0, status: "active" },
    { validAttempts: 1, firstValidScore: 70, status: "active" },
    { validAttempts: 2, firstValidScore: 70, status: "active" },
    { validAttempts: 1, firstValidScore: 70, status: "mastered" },
    { validAttempts: 2, firstValidScore: 70, status: "mastered" },
    { validAttempts: 3, firstValidScore: 70, status: "mastered" },
    { validAttempts: 3, firstValidScore: 70, status: "practiced-not-mastered" },
    { validAttempts: 0, status: "technical-skip" },
    { validAttempts: 1, firstValidScore: 70, status: "technical-skip" },
    { validAttempts: 2, firstValidScore: 70, status: "technical-skip" },
  ];
  for (const state of reachable) {
    assert.doesNotThrow(() =>
      transitionPronunciationSession(state, {
        type: "technical-failure",
        reason: "provider-timeout",
      }),
    );
  }

  const impossible = [
    { validAttempts: 3, firstValidScore: 70, status: "active" },
    { validAttempts: 0, status: "mastered" },
    { validAttempts: 0, status: "practiced-not-mastered" },
    { validAttempts: 1, firstValidScore: 70, status: "practiced-not-mastered" },
    { validAttempts: 2, firstValidScore: 70, status: "practiced-not-mastered" },
    { validAttempts: 3, firstValidScore: 70, status: "technical-skip" },
  ];
  for (const state of impossible) {
    assert.throws(() =>
      transitionPronunciationSession(state, {
        type: "technical-failure",
        reason: "provider-timeout",
      }),
    );
  }
});

test("malformed verdict reason payloads fail closed before any reward is returned", () => {
  const malformedReasons = [
    null,
    {},
    [null],
    [{}],
    [""],
    ["   "],
    ["not a machine reason"],
    ["Bad-Casing"],
    ["x".repeat(97)],
    new Array(1),
    Array.from({ length: 17 }, (_, index) => `reason-${index}`),
  ];
  for (const reasons of malformedReasons) {
    assert.throws(() =>
      transitionPronunciationSession(INITIAL_PRONUNCIATION_SESSION_STATE, {
        type: "valid-verdict",
        verdict: {
          policyVersion: "latam-v1",
          outcome: "mastered",
          reasons,
        },
        score: 95,
      }),
    );
  }
});

test("reward rounding rejects corrupt inputs instead of creating XP", () => {
  for (const baseXp of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => roundRewardXp(baseXp, 0.25));
  }
  for (const multiplier of [-0.1, 1.1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => roundRewardXp(PASS_XP, multiplier));
  }
});
