// node lib/sync/daily-session-sql-logic.test.mjs
//
// PostgreSQL is not installed in this worktree, so this gate combines an
// independent executable reference of the migration policy with structural
// checks for every corresponding SQL clause. The live migration remains a
// separate deployment gate and is deliberately not applied from this test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advanceDailyPronunciationGame,
  createDailyPronunciationGameState,
  mergeDailyPronunciationGameStates,
  reduceDailyPronunciationEvents,
} from "../speech/daily-pronunciation-game.ts";

const sql = readFileSync("supabase/daily_sessions.sql", "utf8");
const schema = readFileSync("supabase/current-schema.sql", "utf8");
const UUIDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

const canonical = (event) => JSON.stringify([event.id, event.targetIndex, event.outcome, event.score, event.ordinal, event.at]);
const eventOrder = (left, right) => left.targetIndex - right.targetIndex
  || left.ordinal - right.ordinal
  || Number(right.outcome === "mastered") - Number(left.outcome === "mastered")
  || left.at - right.at
  || left.id.localeCompare(right.id);
const selectionOrder = (left, right) => Number(right.outcome === "mastered") - Number(left.outcome === "mastered")
  || left.ordinal - right.ordinal || left.at - right.at || left.id.localeCompare(right.id);

function sqlReferenceReduction(events, inheritedConflictIds = []) {
  const grouped = Map.groupBy(events, (event) => event.id);
  const conflictIds = [...new Set([
    ...inheritedConflictIds,
    ...[...grouped].filter(([, values]) => new Set(values.map(canonical)).size > 1).map(([id]) => id),
  ])].sort();
  const eligible = [...grouped.values()]
    .filter((values) => new Set(values.map(canonical)).size === 1 && !conflictIds.includes(values[0].id))
    .map((values) => values[0])
  const selected = [0, 1, 2].flatMap((targetIndex) => eligible.filter((event) => event.targetIndex === targetIndex)
    .sort(selectionOrder).slice(0, 3)).sort(eventOrder);
  const selectedIds = new Set(selected.map((event) => event.id));
  return { events: selected, overflowEvents: eligible.filter((event) => !selectedIds.has(event.id)).sort(eventOrder), conflictIds };
}

function permutations(values) {
  if (values.length < 2) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, candidate) => candidate !== index)).map((tail) => [value, ...tail]));
}

const events = [
  { id: UUIDS[0], targetIndex: 0, ordinal: 3, outcome: "retry", score: 40, at: 40 },
  { id: UUIDS[1], targetIndex: 0, ordinal: 3, outcome: "mastered", score: 94, at: 50 },
  { id: UUIDS[2], targetIndex: 0, ordinal: 1, outcome: "retry", score: 63, at: 10 },
  { id: UUIDS[3], targetIndex: 0, ordinal: 2, outcome: "retry", score: 70, at: 20 },
];
const golden = [UUIDS[2], UUIDS[3], UUIDS[1]];
for (const permutation of permutations(events)) {
  const reference = sqlReferenceReduction(permutation).events;
  assert.deepEqual(reference.map((event) => event.id), golden, "SQL reference keeps legitimate ordinal-3 mastery at the cap");
  assert.deepEqual(reduceDailyPronunciationEvents(permutation).events, reference, "TypeScript and SQL reference select identical canonical events");
  assert.equal(reference[0].score, 63, "firstValidScore comes from the first selected ordered event, not the minimum score");
}

const conflict = [events[0], { ...events[0], score: 99 }];
assert.deepEqual(sqlReferenceReduction(conflict), { events: [], overflowEvents: [], conflictIds: [events[0].id] }, "same UUID conflict becomes a permanent tombstone");
assert.deepEqual(reduceDailyPronunciationEvents(conflict).events, [], "local reducer has the same corruption rule");

const resolutionRank = { ungraded: 1, technical: 2, "graded-practiced": 3, "graded-mastered": 4 };
function sqlReferenceState(left, right) {
  const reduced = sqlReferenceReduction(
    [...left.attemptEvents, ...(left.overflowEvents ?? []), ...right.attemptEvents, ...(right.overflowEvents ?? [])],
    [...(left.conflictIds ?? []), ...(right.conflictIds ?? [])],
  );
  const attemptEvents = reduced.events;
  const resolutions = [0, 1, 2].map((targetIndex) => {
    const selected = attemptEvents.filter((event) => event.targetIndex === targetIndex);
    const candidates = [left.resolutions[targetIndex], right.resolutions[targetIndex]].filter(Boolean)
      .sort((a, b) => resolutionRank[b] - resolutionRank[a] || a.localeCompare(b));
    if (candidates.length === 0) return null;
    if (selected.some((event) => event.outcome === "mastered")) return "graded-mastered";
    if (selected.length === 3 && selected.every((event) => event.outcome === "retry")) return "graded-practiced";
    if (candidates[0] === "ungraded" && selected.length === 0) return "ungraded";
    if (candidates[0] === "technical" && selected.length < 3) return "technical";
    return null;
  });
  const sessions = resolutions.map((resolution, targetIndex) => {
    const selected = attemptEvents.filter((event) => event.targetIndex === targetIndex);
    if (selected.length === 0) return { validAttempts: 0, status: resolution === "technical" ? "technical-skip" : "active" };
    return {
      validAttempts: selected.length,
      firstValidScore: selected[0].score,
      status: selected.some((event) => event.outcome === "mastered") ? "mastered"
        : selected.length >= 3 ? "practiced-not-mastered"
          : resolution === "technical" ? "technical-skip" : "active",
    };
  });
  const terminal = resolutions.every((resolution) => resolution !== null);
  const targetIndex = terminal ? 2 : resolutions.findIndex((resolution) => resolution === null);
  const base = left.sequence >= right.sequence ? left : right;
  const stageRank = { ready: 0, listened: 1, "choice-made": 2 };
  const interaction = [left, right].filter((candidate) => candidate.targetIndex === targetIndex)
    .sort((first, second) => stageRank[second.stage] - stageRank[first.stage]
      || (first.choiceId ?? "").localeCompare(second.choiceId ?? ""))[0];
  const selectedStage = left.game === "beat-the-twin" && !terminal ? interaction?.stage ?? "ready" : "ready";
  const choiceId = selectedStage === "choice-made" ? interaction?.choiceId : undefined;
  return {
    ...base,
    sequence: Math.max(left.sequence, right.sequence),
    attemptEvents,
    overflowEvents: reduced.overflowEvents,
    conflictIds: reduced.conflictIds,
    resolutions,
    sessions,
    targetIndex,
    stage: selectedStage,
    ...(!choiceId ? { choiceId: undefined } : { choiceId }),
    gradedTargets: resolutions.filter((entry) => entry === "graded-mastered" || entry === "graded-practiced").length,
    masteredTargets: resolutions.filter((entry) => entry === "graded-mastered").length,
    technicalTargets: resolutions.filter((entry) => entry === "technical").length,
    ungradedTargets: resolutions.filter((entry) => entry === "ungraded").length,
    terminal,
  };
}

const targets = ["three", "think", "thanks"].map((text) => ({ id: `th:${text}`, text, kind: "word" }));
let terminalBranch = createDailyPronunciationGameState("sound-sprint", targets);
terminalBranch = advanceDailyPronunciationGame(terminalBranch, { type: "attempt", event: { ...events[1], targetIndex: 0, ordinal: 1 } });
terminalBranch = advanceDailyPronunciationGame(terminalBranch, { type: "resolve", targetIndex: 0, resolution: "graded-mastered" });
terminalBranch = advanceDailyPronunciationGame(terminalBranch, { type: "resolve", targetIndex: 1, resolution: "technical" });
terminalBranch = advanceDailyPronunciationGame(terminalBranch, { type: "resolve", targetIndex: 2, resolution: "ungraded" });
let concurrentBranch = createDailyPronunciationGameState("sound-sprint", targets);
concurrentBranch = advanceDailyPronunciationGame(concurrentBranch, { type: "attempt", event: { ...events[0], targetIndex: 0, ordinal: 1 } });
const localGolden = mergeDailyPronunciationGameStates(terminalBranch, concurrentBranch);
const sqlGolden = sqlReferenceState(terminalBranch, concurrentBranch);
assert.deepEqual(sqlGolden, localGolden, "SQL reference and local reducer derive the same complete terminal state");

const conflictBase = createDailyPronunciationGameState("sound-sprint", targets);
const conflictingId = UUIDS[0];
const conflictBranches = [
  advanceDailyPronunciationGame(conflictBase, { type: "attempt", event: { id: conflictingId, targetIndex: 0, ordinal: 1, outcome: "retry", score: 61, at: 10 } }),
  advanceDailyPronunciationGame(conflictBase, { type: "attempt", event: { id: conflictingId, targetIndex: 0, ordinal: 1, outcome: "mastered", score: 95, at: 10 } }),
  advanceDailyPronunciationGame(conflictBase, { type: "attempt", event: { id: conflictingId, targetIndex: 0, ordinal: 1, outcome: "retry", score: 61, at: 10 } }),
];
for (const [first, second, third] of permutations(conflictBranches)) {
  const leftAssociated = sqlReferenceState(sqlReferenceState(first, second), third);
  const rightAssociated = sqlReferenceState(first, sqlReferenceState(second, third));
  assert.deepEqual(leftAssociated, rightAssociated, "SQL reference tombstones are associative");
  assert.deepEqual(leftAssociated.conflictIds, [conflictingId], "SQL reference conflict never resurrects");
  assert.deepEqual(leftAssociated, mergeDailyPronunciationGameStates(mergeDailyPronunciationGameStates(first, second), third), "SQL and TypeScript keep the same tombstone state");
}

const beatBase = createDailyPronunciationGameState("beat-the-twin", targets);
const beatTargetZeroChoice = advanceDailyPronunciationGame(
  advanceDailyPronunciationGame(beatBase, { type: "listen", targetIndex: 0 }),
  { type: "choose", targetIndex: 0, choiceId: "aaa:target-zero" },
);
const beatTargetOneReady = advanceDailyPronunciationGame(beatTargetZeroChoice, { type: "resolve", targetIndex: 0, resolution: "technical" });
const beatTargetOneChoice = advanceDailyPronunciationGame(
  advanceDailyPronunciationGame(beatTargetOneReady, { type: "listen", targetIndex: 1 }),
  { type: "choose", targetIndex: 1, choiceId: "zzz:target-one" },
);
const sqlAdvancedBeat = sqlReferenceState(beatTargetZeroChoice, beatTargetOneReady);
assert.deepEqual([sqlAdvancedBeat.targetIndex, sqlAdvancedBeat.stage, sqlAdvancedBeat.choiceId], [1, "ready", undefined], "SQL drops a stale choice when the merged target advances");
for (const [first, second, third] of permutations([beatTargetZeroChoice, beatTargetOneReady, beatTargetOneChoice])) {
  const leftAssociated = sqlReferenceState(sqlReferenceState(first, second), third);
  const rightAssociated = sqlReferenceState(first, sqlReferenceState(second, third));
  assert.deepEqual(leftAssociated, rightAssociated, "SQL target-scoped interaction tuples are associative");
  assert.deepEqual([leftAssociated.targetIndex, leftAssociated.stage, leftAssociated.choiceId], [1, "choice-made", "zzz:target-one"], "SQL keeps only the current target's choice tuple");
  assert.deepEqual(leftAssociated, mergeDailyPronunciationGameStates(mergeDailyPronunciationGameStates(first, second), third), "SQL and TypeScript choose the same Beat interaction tuple");
}
assert.deepEqual({
  firstScore: sqlGolden.sessions[0].firstValidScore,
  statuses: sqlGolden.sessions.map((session) => session.status),
  resolutions: sqlGolden.resolutions,
  counters: [sqlGolden.gradedTargets, sqlGolden.masteredTargets, sqlGolden.technicalTargets, sqlGolden.ungradedTargets],
  targetIndex: sqlGolden.targetIndex,
  stage: sqlGolden.stage,
  terminal: sqlGolden.terminal,
  hash: sqlGolden.contentHash,
}, {
  firstScore: 94,
  statuses: ["mastered", "technical-skip", "active"],
  resolutions: ["graded-mastered", "technical", "ungraded"],
  counters: [1, 1, 1, 1],
  targetIndex: 2,
  stage: "ready",
  terminal: true,
  hash: terminalBranch.contentHash,
}, "golden state covers status, first score, valid resolutions, counters, target, stage, terminal, and hash");

function balancedSql(source) {
  assert.equal((source.match(/\$\$/g) ?? []).length % 2, 0, "SQL dollar quotes are balanced");
  assert.doesNotMatch(source, /^\+--/m, "authoritative SQL contains no patch-marker tokens");
  assert.doesNotMatch(source, /\bend;\s*end;\s*\$\$/i, "function bodies contain no duplicate END");
}
balancedSql(sql);
balancedSql(schema);
const helperSource = (source) => source.slice(
  source.indexOf("create or replace function public.merge_daily_pronunciation_state"),
  source.indexOf("revoke all on function public.merge_daily_pronunciation_state"),
);
assert.equal(helperSource(schema), helperSource(sql), "authoritative schema and focused migration contain the exact same reducer");

for (const source of [sql, schema]) {
  assert.match(source, /merge_daily_pronunciation_state\(p_left jsonb, p_right jsonb\)/, "defines the canonical state reducer");
  assert.match(source, /raise exception 'Incompatible pronunciation state'/i, "incompatible hash, game, or target-derived hash fails closed");
  assert.match(source, /jsonb_array_length\(p_left -> 'attemptEvents'\) > 9/i, "bounds event arrays before expansion");
  assert.match(source, /payload_conflicts[\s\S]*?count\(distinct event::text\) > 1/i, "conflicting canonical payloads become tombstones");
  assert.match(source, /inherited_conflicts[\s\S]*?conflictIds/i, "existing tombstones are unioned permanently");
  assert.match(source, /order by case when event ->> 'outcome' = 'mastered' then 0 else 1 end,[\s\S]*?ordinal/i, "mastery is selected before ordinal at the cap");
  assert.match(source, /'overflowEvents'[\s\S]*?'conflictIds'/i, "bounded overflow evidence and conflict tombstones are persisted");
  assert.match(source, /jsonb_array_length\(v_result -> 'overflowEvents'\) > 9[\s\S]*?jsonb_array_length\(v_result -> 'conflictIds'\) > 9/i, "evidence bounds fail the merge closed");
  assert.match(source, /\(array_agg\(\(event ->> 'score'\)::numeric order by[\s\S]*?\)\)\[1\]/i, "first score uses the first selected event");
  assert.match(source, /'ungradedTargets'/, "derives ungraded counters");
  assert.match(source, /'targetIndex'/, "derives the next target index");
  assert.match(source, /'stage'/, "derives the safe interaction stage");
  assert.match(source, /left join lateral[\s\S]*?state ->> 'targetIndex'\)::integer = facts\.target_index/i, "selects the complete Beat interaction tuple only from the merged current target");
  assert.match(source, /'contentHash'/, "retains the compatible content hash");
  assert.match(source, /when older_activity #> '\{pronunciation,state\}' is not null then older_activity -> 'pronunciation'/i, "a newer v1 shape cannot erase the older stateful v2 pronunciation object");
  assert.match(source, /when pronunciation_base is null then '\{\}'::jsonb[\s\S]*?when merged_state is not null then jsonb_build_object\([\s\S]*?else jsonb_build_object\('pronunciation', pronunciation_base\)/i, "an older shipped v1 pronunciation object is reattached when the newer base activity omits pronunciation");
  assert.match(source, /between 0 and 1000000/i, "bounds sequence values");
  assert.match(source, /octet_length\(p_payload::text\) > 65536/i, "bounds RPC payload before activity expansion");
  assert.match(source, /jsonb_array_length\(p_payload -> 'activities'\) > 12/i, "bounds activity arrays before expansion");
  assert.match(source, /security invoker/i, "main merge RPC remains invoker-security");
  assert.match(source, /revoke all on function public\.merge_daily_pronunciation_state\(jsonb, jsonb\) from public;/i, "helper is not executable by PUBLIC");
  assert.match(source, /revoke all on function public\.merge_daily_pronunciation_state\(jsonb, jsonb\) from anon;/i, "helper is not executable by anon");
  assert.match(source, /grant execute on function public\.merge_daily_pronunciation_state\(jsonb, jsonb\) to authenticated;/i, "authenticated RPC callers receive the minimal helper permission");
  assert.match(source, /revoke all on table public\.daily_sessions from anon;/i, "anon has no daily-session table privileges");
  assert.match(source, /grant select, insert, update on table public\.daily_sessions to authenticated;/i, "authenticated users receive only required table operations");
}

console.log("daily-session SQL logic: canonical permutations, corruption, bounds, syntax guards, and privileges ok");
