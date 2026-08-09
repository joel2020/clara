import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceDailyPronunciationGame,
  createDailyPronunciationGameState,
  dailyPronunciationContentHash,
  dailyPronunciationLegacyContentHash,
  isDailyPronunciationGameState,
  mergeDailyPronunciationGameStates,
} from "./daily-pronunciation-game.ts";

const targets = [
  { id: "th:three", text: "three", kind: "word" },
  { id: "th:think", text: "think", kind: "word" },
  { id: "th:thanks", text: "thanks", kind: "word" },
];
const event = (id, targetIndex, outcome, score, ordinal, at = ordinal) => ({ id, targetIndex, outcome, score, ordinal, at });
const ids = [
  "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444",
];
const uuid = (index) => `${index.toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`;
const permutations = (values) => values.length < 2 ? [values] : values.flatMap((value, index) => permutations(values.filter((_, candidate) => candidate !== index)).map((tail) => [value, ...tail]));

test("content identity includes target text and format", () => {
  const first = dailyPronunciationContentHash("sound-sprint", targets);
  assert.notEqual(first, dailyPronunciationContentHash("echo-chain", targets));
  assert.notEqual(first, dailyPronunciationContentHash("sound-sprint", [{ ...targets[0], text: "THREE" }, ...targets.slice(1)]));
});

test("v3 content identity binds grading metadata and Beat contrast partners", () => {
  const complete = targets.map((target, index) => ({
    ...target, ipa: `/ipa-${index}/`, mouthHint: `mouth-${index}`, categoryId: "th", phoneme: "θ",
    pairId: `pair-${index}`, lessonId: "th", note: `note-${index}`, meaning: `meaning-${index}`,
    stressMarkedText: `STRESS-${index}`, targetWord: `word-${index}`,
  }));
  const partner = { ...complete[0], id: "th:tree", text: "tree", ipa: "/triː/", phoneme: "t" };
  const first = dailyPronunciationContentHash("beat-the-twin", complete, [...complete, partner]);
  assert.match(first, /^daily-pronunciation-v3:/);
  for (const [field, value] of [
    ["ipa", "/forged/"], ["mouthHint", "forged"], ["categoryId", "forged"], ["phoneme", "f"],
    ["pairId", "forged"], ["lessonId", "forged"], ["note", "forged"], ["meaning", "forged"],
    ["stressMarkedText", "forged"], ["targetWord", "forged"],
  ]) {
    assert.notEqual(first, dailyPronunciationContentHash("beat-the-twin", [{ ...complete[0], [field]: value }, ...complete.slice(1)], [...complete, partner]), field);
  }
  assert.notEqual(first, dailyPronunciationContentHash("beat-the-twin", complete, [...complete, { ...partner, mouthHint: "forged partner" }]));
  assert.match(dailyPronunciationLegacyContentHash("sound-sprint", targets), /^daily-pronunciation-v2:/);
});

test("three target sessions resume exact attempt counts and become terminal once", () => {
  let state = createDailyPronunciationGameState("sound-sprint", targets);
  state = advanceDailyPronunciationGame(state, { type: "attempt", event: event(ids[0], 0, "retry", 70, 1) });
  assert.equal(state.sessions[0].validAttempts, 1);
  state = advanceDailyPronunciationGame(state, { type: "attempt", event: event(ids[1], 0, "retry", 72, 2) });
  state = advanceDailyPronunciationGame(state, { type: "attempt", event: event(ids[2], 0, "retry", 73, 3) });
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 0, resolution: "graded-practiced" });
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 1, resolution: "technical" });
  state = advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 2, resolution: "ungraded" });
  assert.deepEqual({ terminal: state.terminal, graded: state.gradedTargets, technical: state.technicalTargets, ungraded: state.ungradedTargets }, { terminal: true, graded: 1, technical: 1, ungraded: 1 });
  assert.equal(advanceDailyPronunciationGame(state, { type: "resolve", targetIndex: 2, resolution: "graded-mastered" }), state);
  assert.equal(isDailyPronunciationGameState(state, state.contentHash), true);
});

test("same UUID is idempotent while equal-sequence branches union distinct attempts", () => {
  const base = createDailyPronunciationGameState("sound-sprint", targets);
  const left = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[0], 0, "retry", 60, 1, 10) });
  const replay = advanceDailyPronunciationGame(left, { type: "attempt", event: event(ids[0], 0, "retry", 60, 1, 10) });
  assert.deepEqual(replay, left);
  const right = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[1], 0, "mastered", 90, 1, 11) });
  const merged = mergeDailyPronunciationGameStates(left, right);
  assert.equal(merged.attemptEvents.length, 2);
  assert.deepEqual(merged.sessions[0], { validAttempts: 2, firstValidScore: 90, status: "mastered" });
});

test("lower-sequence later branches cannot erase evidence or terminal mastery", () => {
  let mastered = createDailyPronunciationGameState("sound-sprint", targets);
  mastered = advanceDailyPronunciationGame(mastered, { type: "attempt", event: event(ids[0], 0, "mastered", 94, 1) });
  mastered = advanceDailyPronunciationGame(mastered, { type: "resolve", targetIndex: 0, resolution: "graded-mastered" });
  const stale = createDailyPronunciationGameState("sound-sprint", targets);
  const merged = mergeDailyPronunciationGameStates(mastered, stale);
  assert.equal(merged.attemptEvents.length, 1);
  assert.equal(merged.resolutions[0], "graded-mastered");
  assert.equal(merged.sessions[0].status, "mastered");
});

test("concurrent attempt-two branches cap safely at three without inventing mastery", () => {
  let base = createDailyPronunciationGameState("sound-sprint", targets);
  base = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[0], 0, "retry", 60, 1) });
  base = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[1], 0, "retry", 62, 2) });
  const left = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[2], 0, "retry", 64, 3, 3) });
  const right = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[3], 0, "retry", 66, 3, 4) });
  const merged = mergeDailyPronunciationGameStates(left, right);
  assert.equal(merged.attemptEvents.length, 3);
  assert.deepEqual(merged.sessions[0], { validAttempts: 3, firstValidScore: 60, status: "practiced-not-mastered" });
});

test("conflicting payloads for one UUID are dropped independent of merge order", () => {
  const base = createDailyPronunciationGameState("sound-sprint", targets);
  const retry = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[0], 0, "retry", 61, 1, 10) });
  const forgedMastery = advanceDailyPronunciationGame(base, { type: "attempt", event: event(ids[0], 0, "mastered", 95, 1, 10) });
  const leftRight = mergeDailyPronunciationGameStates(retry, forgedMastery);
  const rightLeft = mergeDailyPronunciationGameStates(forgedMastery, retry);
  assert.deepEqual(leftRight.attemptEvents, []);
  assert.deepEqual(rightLeft, leftRight);
});

test("same-ordinal mastered evidence outranks retry before the three-event cap", () => {
  const base = createDailyPronunciationGameState("sound-sprint", targets);
  const concurrent = [
    event(ids[0], 0, "retry", 61, 1, 10),
    event(ids[1], 0, "retry", 63, 2, 20),
    event(ids[2], 0, "retry", 64, 3, 21),
    event(ids[3], 0, "mastered", 92, 3, 22),
  ];
  const golden = [ids[0], ids[1], ids[3]];
  for (const ordering of permutations(concurrent)) {
    const branches = ordering.map((attempt) => advanceDailyPronunciationGame(base, { type: "attempt", event: attempt }));
    const merged = branches.reduce(mergeDailyPronunciationGameStates);
    assert.deepEqual(merged.attemptEvents.map((attempt) => attempt.id), golden);
    assert.deepEqual(merged.sessions[0], { validAttempts: 3, firstValidScore: 61, status: "mastered" });
  }
});

test("ordinal-three mastery survives concurrent ordinal-two retries in every branch order", () => {
  const base = createDailyPronunciationGameState("sound-sprint", targets);
  const r1 = event(uuid(10), 0, "retry", 55, 1, 10);
  const leftEvents = [r1, event(uuid(11), 0, "retry", 60, 2, 20), event(uuid(12), 0, "retry", 65, 3, 30)];
  const rightEvents = [r1, event(uuid(13), 0, "retry", 62, 2, 21), event(uuid(14), 0, "mastered", 93, 3, 31)];
  const makeBranch = (values) => values.reduce((state, attempt) => advanceDailyPronunciationGame(state, { type: "attempt", event: attempt }), base);
  const branches = [makeBranch(leftEvents), makeBranch(rightEvents)];
  for (const ordering of permutations(branches)) {
    const merged = ordering.reduce(mergeDailyPronunciationGameStates);
    assert.deepEqual(merged.attemptEvents.map((attempt) => attempt.id), [uuid(10), uuid(11), uuid(14)]);
    assert.equal(merged.sessions[0].status, "mastered");
  }
});

test("bounded overflow keeps three-way merges associative, commutative, and idempotent", () => {
  const base = createDailyPronunciationGameState("sound-sprint", targets);
  const makeBranch = (values) => values.reduce((state, attempt) => advanceDailyPronunciationGame(state, { type: "attempt", event: attempt }), base);
  const branches = [
    makeBranch([event(uuid(30), 0, "retry", 55, 1, 10), event(uuid(31), 0, "retry", 60, 2, 20)]),
    makeBranch([event(uuid(32), 0, "retry", 61, 2, 21), event(uuid(33), 0, "retry", 65, 3, 30)]),
    makeBranch([event(uuid(34), 0, "mastered", 94, 3, 31)]),
  ];
  for (const [first, second, third] of permutations(branches)) {
    const left = mergeDailyPronunciationGameStates(mergeDailyPronunciationGameStates(first, second), third);
    const right = mergeDailyPronunciationGameStates(first, mergeDailyPronunciationGameStates(second, third));
    assert.deepEqual(left, right);
    assert.deepEqual(mergeDailyPronunciationGameStates(left, left), left);
    assert.deepEqual(left.attemptEvents.map((attempt) => attempt.id), [uuid(30), uuid(31), uuid(34)]);
    assert.deepEqual(left.overflowEvents.map((attempt) => attempt.id), [uuid(32), uuid(33)]);
  }
});

test("UUID conflicts persist as tombstones and never resurrect across three-way merge permutations", () => {
  const base = createDailyPronunciationGameState("sound-sprint", targets);
  const conflictingId = uuid(20);
  const branch = (outcome, score) => advanceDailyPronunciationGame(base, {
    type: "attempt", event: event(conflictingId, 0, outcome, score, 1, 10),
  });
  const retryA = branch("retry", 61), mastery = branch("mastered", 95), retryC = branch("retry", 61);
  for (const [first, second, third] of permutations([retryA, mastery, retryC])) {
    const leftAssociated = mergeDailyPronunciationGameStates(mergeDailyPronunciationGameStates(first, second), third);
    const rightAssociated = mergeDailyPronunciationGameStates(first, mergeDailyPronunciationGameStates(second, third));
    for (const merged of [leftAssociated, rightAssociated]) {
      assert.deepEqual(merged.attemptEvents, []);
      assert.deepEqual(merged.conflictIds, [conflictingId]);
      assert.deepEqual(mergeDailyPronunciationGameStates(merged, merged), merged);
    }
    assert.deepEqual(leftAssociated, rightAssociated);
  }
});

test("legacy v2 states without conflict tombstones remain valid", () => {
  const state = createDailyPronunciationGameState("sound-sprint", targets);
  const { conflictIds: _legacyMissing, ...legacy } = state;
  assert.equal(isDailyPronunciationGameState(legacy, state.contentHash), true);
});

test("tombstone overflow fails closed instead of dropping corruption evidence", () => {
  const base = createDailyPronunciationGameState("sound-sprint", targets);
  const full = { ...base, conflictIds: Array.from({ length: 9 }, (_, index) => uuid(100 + index)) };
  const conflictingId = uuid(200);
  const retry = advanceDailyPronunciationGame(base, { type: "attempt", event: event(conflictingId, 0, "retry", 60, 1, 1) });
  const mastery = advanceDailyPronunciationGame(base, { type: "attempt", event: event(conflictingId, 0, "mastered", 95, 1, 1) });
  const newConflict = mergeDailyPronunciationGameStates(retry, mastery);
  assert.throws(() => mergeDailyPronunciationGameStates(full, newConflict), /corruption evidence bound/i);
});

test("state sequence is bounded to the shared Postgres-safe range", () => {
  const state = createDailyPronunciationGameState("sound-sprint", targets);
  assert.equal(isDailyPronunciationGameState({ ...state, sequence: 1_000_001 }, state.contentHash), false);
  assert.throws(
    () => advanceDailyPronunciationGame(state, { type: "attempt", event: event(ids[0], 0, "retry", 60, 1, 9_000_000_000_000_001) }),
    /invalid pronunciation attempt/i,
  );
});

test("Beat the Twin requires successful listening before a choice", () => {
  let state = createDailyPronunciationGameState("beat-the-twin", targets);
  assert.throws(() => advanceDailyPronunciationGame(state, { type: "choose", targetIndex: 0, choiceId: "th:three" }), /listen/i);
  state = advanceDailyPronunciationGame(state, { type: "listen", targetIndex: 0 });
  state = advanceDailyPronunciationGame(state, { type: "choose", targetIndex: 0, choiceId: "th:think" });
  assert.equal(state.stage, "choice-made");
  assert.equal(state.choiceId, "th:think");
});

test("core validation rejects incoherent game stages and choices", () => {
  const sprint = createDailyPronunciationGameState("sound-sprint", targets);
  assert.equal(isDailyPronunciationGameState({ ...sprint, stage: "listened" }, sprint.contentHash), false);
  const beat = createDailyPronunciationGameState("beat-the-twin", targets);
  assert.equal(isDailyPronunciationGameState({ ...beat, stage: "listened", choiceId: targets[0].id }, beat.contentHash), false);
  assert.equal(isDailyPronunciationGameState({ ...beat, stage: "choice-made" }, beat.contentHash), false);
  assert.equal(isDailyPronunciationGameState({ ...beat, stage: "choice-made", choiceId: "forged:choice" }, beat.contentHash, [targets[0].id, targets[1].id]), false);
  let terminalBeat = beat;
  for (let targetIndex = 0; targetIndex < 3; targetIndex += 1) {
    terminalBeat = advanceDailyPronunciationGame(terminalBeat, { type: "listen", targetIndex });
    terminalBeat = advanceDailyPronunciationGame(terminalBeat, { type: "choose", targetIndex, choiceId: targets[targetIndex].id });
    terminalBeat = advanceDailyPronunciationGame(terminalBeat, { type: "resolve", targetIndex, resolution: "technical" });
  }
  assert.equal(isDailyPronunciationGameState({ ...terminalBeat, stage: "choice-made", choiceId: targets[2].id }, terminalBeat.contentHash, targets.map((target) => target.id)), false);
});

test("Beat merge drops a target-zero choice after another branch advances to target one", () => {
  const base = createDailyPronunciationGameState("beat-the-twin", targets);
  const paused = advanceDailyPronunciationGame(
    advanceDailyPronunciationGame(base, { type: "listen", targetIndex: 0 }),
    { type: "choose", targetIndex: 0, choiceId: targets[0].id },
  );
  const advanced = advanceDailyPronunciationGame(paused, { type: "resolve", targetIndex: 0, resolution: "technical" });
  for (const [left, right] of [[paused, advanced], [advanced, paused]]) {
    const merged = mergeDailyPronunciationGameStates(left, right);
    assert.equal(merged.targetIndex, 1);
    assert.equal(merged.stage, "ready");
    assert.equal(merged.choiceId, undefined);
    assert.equal(isDailyPronunciationGameState(merged, merged.contentHash, [targets[1].id]), true);
  }
});

test("Beat merge selects the current target's complete stage-choice tuple in every association", () => {
  const base = createDailyPronunciationGameState("beat-the-twin", targets);
  const targetZeroChoice = advanceDailyPronunciationGame(
    advanceDailyPronunciationGame(base, { type: "listen", targetIndex: 0 }),
    { type: "choose", targetIndex: 0, choiceId: "aaa:target-zero" },
  );
  const targetOneReady = advanceDailyPronunciationGame(targetZeroChoice, { type: "resolve", targetIndex: 0, resolution: "technical" });
  const targetOneChoice = advanceDailyPronunciationGame(
    advanceDailyPronunciationGame(targetOneReady, { type: "listen", targetIndex: 1 }),
    { type: "choose", targetIndex: 1, choiceId: "zzz:target-one" },
  );
  for (const [first, second, third] of permutations([targetZeroChoice, targetOneReady, targetOneChoice])) {
    const leftAssociated = mergeDailyPronunciationGameStates(mergeDailyPronunciationGameStates(first, second), third);
    const rightAssociated = mergeDailyPronunciationGameStates(first, mergeDailyPronunciationGameStates(second, third));
    for (const merged of [leftAssociated, rightAssociated]) {
      assert.equal(merged.targetIndex, 1);
      assert.equal(merged.stage, "choice-made");
      assert.equal(merged.choiceId, "zzz:target-one");
      assert.deepEqual(mergeDailyPronunciationGameStates(merged, merged), merged);
    }
    assert.deepEqual(leftAssociated, rightAssociated);
  }
});

test("corrupt and mismatched persisted state fails closed", () => {
  const state = createDailyPronunciationGameState("sound-sprint", targets);
  assert.equal(isDailyPronunciationGameState({ ...state, targetIndex: 99 }, state.contentHash), false);
  assert.equal(isDailyPronunciationGameState(state, "changed-content"), false);
});
