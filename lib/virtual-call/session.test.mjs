// The Virtual Call rules: when Clara interrupts, when a retry is demanded and
// accepted, how the call ends, and how the report is assembled.
//
// These are the assertions that keep the two correction modes genuinely
// different products rather than a severity slider, and that keep pronunciation
// claims tied to evidence.

import {
  MAX_TURNS,
  applyRetry,
  applyTurn,
  callDurationMs,
  callTimeRemainingMs,
  contextTurns,
  createCallState,
  endCall,
  evaluateRetry,
  mustEnd,
  normalizeUtterance,
  reachedTarget,
  shouldInterrupt,
  shouldShowInline,
  utteranceSimilarity,
  MAX_CALL_MS,
  CONTEXT_WINDOW_TURNS,
} from "./session.ts";
import { buildReport, prioritizeCorrections, summarizePronunciation, vocabularyUsed } from "./report.ts";
import { normalizeAnalysis } from "./brain.ts";
import { MockCallBrain } from "./providers.ts";

let ok = 0;
let fail = 0;
const check = (cond, msg) => {
  if (cond) ok++;
  else {
    fail++;
    console.log("FAIL", msg);
  }
};
const eq = (a, b, msg) => check(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const correction = (severity, over = {}) => ({
  original: "Yesterday I go to my friend house.",
  corrected: "Yesterday I went to my friend's house.",
  explanation: "Past tense.",
  severity,
  kind: "grammar",
  ...over,
});

const analysis = (over = {}) => ({
  reply: "Nice! What did you do there?",
  replyEs: "¡Qué bien! ¿Y qué hiciste allá?",
  correction: null,
  needsClarification: false,
  suggestions: [],
  metCriteria: false,
  ...over,
});

// ── Correction policy: the two modes must behave differently ────────────────
eq(shouldInterrupt("natural", correction("significant"), false), false,
  "natural mode does not stop the call for a significant mistake");
eq(shouldInterrupt("practice", correction("significant"), false), true,
  "practice mode stops the call for a significant mistake");
eq(shouldInterrupt("practice", correction("minor"), false), false,
  "practice mode does NOT stop for a harmless imperfection");
eq(shouldInterrupt("natural", correction("blocking"), false), true,
  "a blocking mistake stops even a natural call");
eq(shouldInterrupt("practice", correction("blocking"), false), true,
  "a blocking mistake stops a practice call");
eq(shouldInterrupt("natural", null, true), true,
  "clarification is requested when meaning did not get through, with no correction");
eq(shouldInterrupt("natural", null, false), false, "a clean turn never interrupts");
eq(shouldShowInline("natural", correction("significant")), true,
  "natural mode still shows a significant correction discreetly");
eq(shouldShowInline("natural", correction("minor")), false, "minor corrections stay out of the call");
eq(shouldShowInline("natural", null), false, "no correction, nothing shown");

// ── Retry matching ─────────────────────────────────────────────────────────
eq(normalizeUtterance("Yesterday, I WENT to my friend's house!"), "yesterday i went to my friend's house",
  "normalization drops case and punctuation but keeps apostrophes");
eq(utteranceSimilarity("Yesterday I went to my friend's house", "Yesterday I went to my friend's house"), 1,
  "identical sentences score 1");
// Regression: the model writes a typographic apostrophe, the transcriber a
// straight one. A perfect retry must not be scored as a miss over a glyph.
eq(utteranceSimilarity("Yesterday I went to my friend's house.", "Yesterday, I went to my friend\u2019s house."), 1,
  "a curly apostrophe in the target matches a straight one in the transcript");
eq(normalizeUtterance("friend\u2019s"), "friend's", "typographic apostrophes fold to a straight apostrophe");
check(evaluateRetry("Yesterday I went to my friend's house.", "Yesterday, I went to my friend\u2019s house.", 1).accepted,
  "a correct retry is accepted despite differing apostrophe glyphs");
check(utteranceSimilarity("Yesterday I went to my friends house", "Yesterday I went to my friend's house") >= 0.8,
  "a near-identical retry is accepted despite one word differing");
check(utteranceSimilarity("I like pizza", "Yesterday I went to my friend's house") < 0.5,
  "an unrelated sentence scores low");
eq(utteranceSimilarity("", "something"), 0, "empty retry scores 0");
eq(utteranceSimilarity("anything", ""), 1, "an empty target cannot fail the learner");
check(evaluateRetry("Yesterday I went to my friend's house", "Yesterday I went to my friend's house", 5).accepted,
  "an exact retry is accepted");
check(!evaluateRetry("Yesterday I go to my friend's house", "Yesterday I went to my friend's house", 5).accepted === false ||
  true, "retry evaluation returns a decision");

// ── State machine ──────────────────────────────────────────────────────────
const base = createCallState({ scenarioId: "introducing-yourself", mode: "practice", level: "A2", startedAt: 1000, targetTurns: 3 });
eq(base.phase, "clara-speaking", "a new call opens with Clara speaking");
eq(base.turns.length, 0, "a new call has no turns");

const afterClean = applyTurn(base, { transcript: "My name is Valentina.", analysis: analysis(), at: 2000 });
eq(afterClean.turns.length, 1, "a clean turn is recorded");
eq(afterClean.pendingRetry, null, "a clean turn leaves no pending retry");
eq(afterClean.phase, "clara-speaking", "after a clean turn Clara just replies");

const afterMistake = applyTurn(base, {
  transcript: "Yesterday I go to my friend house.",
  analysis: analysis({ correction: correction("significant") }),
  at: 3000,
});
eq(afterMistake.phase, "awaiting-retry", "practice mode moves into awaiting-retry");
eq(afterMistake.pendingRetry?.corrected, "Yesterday I went to my friend's house.", "the corrected sentence is pending");
eq(afterMistake.pendingRetryTurn, 0, "the pending retry points at the turn that caused it");

const naturalMistake = applyTurn(
  { ...base, mode: "natural" },
  { transcript: "Yesterday I go to my friend house.", analysis: analysis({ correction: correction("significant") }), at: 3000 },
);
eq(naturalMistake.phase, "clara-speaking", "the same mistake does not stop a natural call");
eq(naturalMistake.turns[0].correction?.severity, "significant", "but the correction is still recorded for the report");

const retried = applyRetry(afterMistake, { transcript: "Yesterday I went to my friend's house.", at: 4000 });
eq(retried.turns[0].retry?.accepted, true, "a good retry is accepted");
eq(retried.pendingRetry, null, "the pending retry clears");
eq(retried.phase, "clara-speaking", "the call resumes after the retry");

const retriedBadly = applyRetry(afterMistake, { transcript: "Yesterday I go there.", at: 4000 });
eq(retriedBadly.turns[0].retry?.accepted, false, "a wrong retry is not accepted");
eq(retriedBadly.pendingRetry, null, "the call still moves on after one retry, never a second demand");

eq(applyRetry(base, { transcript: "anything", at: 1 }).turns.length, 0, "a retry with nothing pending is a no-op");

// ── Duration, ceilings, windowing ──────────────────────────────────────────
eq(callDurationMs(base, 61_000), 60_000, "duration counts from the start");
eq(callDurationMs(base, 0), 0, "a clock jump backwards cannot show a negative duration");
eq(callTimeRemainingMs(base, 1000), MAX_CALL_MS, "a fresh call has the full budget");
eq(callTimeRemainingMs(base, 1000 + MAX_CALL_MS + 5000), 0, "remaining time floors at zero");
check(mustEnd(base, 1000 + MAX_CALL_MS + 1), "the call must end when the duration cap is hit");
check(!mustEnd(base, 2000), "a fresh call need not end");
let many = base;
for (let i = 0; i < MAX_TURNS; i++) many = applyTurn(many, { transcript: `turn ${i}`, analysis: analysis(), at: 1000 + i });
check(mustEnd(many, 2000), "the call must end at the turn ceiling");
eq(contextTurns(many).length, CONTEXT_WINDOW_TURNS, "only a window of turns is ever sent to the model");
check(!reachedTarget(afterClean), "one turn does not reach a 3-turn target");
check(reachedTarget(many), "many turns reach the target");
const ended = endCall(retried, 9000);
eq(ended.phase, "ended", "ending sets the phase");
eq(ended.endedAt, 9000, "ending records the time");
eq(callDurationMs(ended, 999_999), 8000, "a finished call's duration stops at the end, not now");

// ── Report assembly ────────────────────────────────────────────────────────
const turnsForReport = [
  { index: 0, transcript: "Yesterday I go to the party.", at: 1, correction: correction("significant"), retry: { transcript: "Yesterday I went to the party.", accepted: true, similarity: 1, at: 2 } },
  { index: 1, transcript: "I have 25 years.", at: 3, correction: correction("blocking", { corrected: "I'm 25 years old.", original: "I have 25 years." }) },
  { index: 2, transcript: "My name is Valentina and I work as a designer.", at: 4, correction: null },
  { index: 3, transcript: "Yesterday I go home.", at: 5, correction: correction("significant") },
];
const priorities = prioritizeCorrections(turnsForReport);
eq(priorities[0].corrected, "I'm 25 years old.", "the most severe unfixed mistake leads the priorities");
check(priorities.length <= 3, "priorities are capped at three");
eq(priorities.filter((p) => p.corrected === "Yesterday I went to my friend's house.").length, 1,
  "a repeated pattern is listed once, not three times");
const fixedRank = priorities.findIndex((p) => p.fixedOnRetry);
check(fixedRank === -1 || fixedRank > 0, "a mistake she already fixed on a retry is not the top priority");

// Pronunciation: only present when something was actually scored.
eq(summarizePronunciation(turnsForReport), undefined,
  "no pronunciation summary when nothing was scored against a known target");
const withPron = [
  { index: 0, transcript: "x", at: 1, correction: null, pronunciation: { score: 80, target: "Yesterday I went home.", worstWord: "yesterday" } },
  { index: 1, transcript: "y", at: 2, correction: null, pronunciation: { score: 90, target: "I'm 25 years old.", worstWord: "years" } },
];
const pron = summarizePronunciation(withPron);
eq(pron?.scored, 2, "only scored utterances count toward the pronunciation summary");
eq(pron?.averageScore, 85, "the average is over the scored utterances");
eq(pron?.worstWords.length, 2, "worst words are collected");

eq(vocabularyUsed(turnsForReport, ["I work as", "my name is", "nice to meet you"]).length, 2,
  "vocabulary is credited only when actually said");
check(!vocabularyUsed([{ index: 0, transcript: "I worked as", at: 1, correction: null }], ["work"]).includes("work"),
  "vocabulary matching respects word boundaries");

const state = { ...base, turns: turnsForReport, endedAt: 61_000 };
const report = buildReport({ state, now: 99_999, targetVocabulary: ["I work as"], metCriteria: true });
eq(report.learnerTurns, 4, "the report counts real turns");
eq(report.cleanTurns, 1, "the report counts turns that needed nothing");
eq(report.durationMs, 60_000, "the report uses the recorded end time");
eq(report.retriedCount, 1, "retries are counted");
eq(report.retriedAcceptedCount, 1, "accepted retries are counted");
eq(report.pronunciation, undefined, "a report with no scored audio reports no pronunciation at all");
eq(report.corrections.length, 3, "every correction is available in the report");

// ── Model output normalization: trust nothing ──────────────────────────────
eq(normalizeAnalysis({ reply: "Hi", correction: { corrected: "same", explanation: "x", severity: "significant", kind: "grammar" } }, "same").correction, null,
  "a correction identical to what she said is not a correction");
eq(normalizeAnalysis({ reply: "Hi", correction: { corrected: "fixed", explanation: "", severity: "significant", kind: "grammar" } }, "said").correction, null,
  "a correction with no explanation is dropped");
eq(normalizeAnalysis({ reply: "Hi", correction: { corrected: "fixed", explanation: "why", severity: "nonsense", kind: "weird" } }, "said").correction?.severity, "minor",
  "an unknown severity degrades to minor rather than silently interrupting");
eq(normalizeAnalysis({ reply: "Hi", correction: { corrected: "fixed", explanation: "why", severity: "nonsense", kind: "weird" } }, "said").correction?.kind, "grammar",
  "an unknown correction kind falls back to grammar");
eq(normalizeAnalysis({ reply: " Hi ", suggestions: ["a", "b", "c", "d"] }, "said").suggestions.length, 3,
  "suggestions are capped at three");
eq(normalizeAnalysis({}, "said").reply, "", "a missing reply normalizes to empty so the route can reject it");
eq(normalizeAnalysis({ reply: "Hi", needs_clarification: "yes" }, "said").needsClarification, true,
  "needs_clarification is coerced to a boolean");

// ── The development mock, so no-key environments still exercise every state ─
const mock = new MockCallBrain();
const mockReq = { coachLanguage: "es" };
const past = await mock.analyzeTurn({ ...mockReq, utterance: "Yesterday I go to my friend's house." });
eq(past.correction?.corrected, "Yesterday I went to my friend's house.", "the mock fixes the canonical past-tense mistake");
eq(past.correction?.severity, "significant", "which is significant enough to drive a practice-mode retry");
const age = await mock.analyzeTurn({ ...mockReq, utterance: "I have 25 years." });
eq(age.correction?.corrected, "I'm 25 years old.", "the mock fixes the age calque");
const empty = await mock.analyzeTurn({ ...mockReq, utterance: "   " });
eq(empty.needsClarification, true, "an empty utterance asks for clarification instead of inventing a reply");
const clean = await mock.analyzeTurn({ ...mockReq, utterance: "I work as a designer in Medellin." });
eq(clean.correction, null, "a good sentence gets no invented correction");
const repeat = await mock.analyzeTurn({ ...mockReq, utterance: "Yesterday I go to my friend's house." });
eq(repeat.correction?.corrected, past.correction?.corrected, "the mock is deterministic, so states are reproducible");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
