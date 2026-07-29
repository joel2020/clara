// node lib/sync/daily-session-sql-logic.test.mjs
//
// Executes the migration's ordered terminal_activity CASE over a full-join
// fixture, then serializes activities and selects currentActivityId exactly as
// the SQL pipeline does. This is intentionally dependency-free: the worktree
// has no PostgreSQL runtime, and a source-substring assertion cannot catch the
// null-side/rank-tie behavior this fixture protects.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/daily_sessions.sql", "utf8");
const evidenceCase = sql.match(
  /evidence as \(\s*select \*,\s*case\s+([\s\S]*?)\s+end as terminal_activity/,
)?.[1];
assert.ok(evidenceCase, "migration terminal_activity CASE can be evaluated");

const branches = [...evidenceCase.matchAll(/when\s+(.+?)\s+then\s+(\w+)/g)]
  .map(([, condition, result]) => ({ condition: condition.trim(), result }));
const fallback = evidenceCase.match(/\belse\s+(\w+)\s*$/)?.[1];
assert.ok(fallback, "migration terminal_activity CASE has an ELSE branch");

function statusRank(activity) {
  return activity?.status === "completed" ? 3
    : activity?.status === "technical-skip" ? 2
      : activity?.status === "active" ? 1 : 0;
}

function conditionMatches(condition, row) {
  if (condition === "newer_activity is null") return row.newer_activity === null;
  if (condition === "older_activity is null") return row.older_activity === null;
  if (condition === "newer_rank >= older_rank") return row.newer_rank >= row.older_rank;
  throw new Error(`Unsupported terminal_activity condition: ${condition}`);
}

function selectTerminalActivity(row) {
  const selected = branches.find((branch) => conditionMatches(branch.condition, row))?.result ?? fallback;
  return row[selected];
}

const newerActivities = [
  { id: "speak", status: "completed", completedAt: 20 },
];
const olderActivities = [
  { id: "speak", status: "completed", completedAt: 20 },
  { id: "reflect", status: "pending" },
];
const newerById = new Map(newerActivities.map((activity) => [activity.id, activity]));
const olderById = new Map(olderActivities.map((activity) => [activity.id, activity]));
const ids = [...new Set([...newerById.keys(), ...olderById.keys()])];

const serialized = ids.map((id) => {
  const newer = newerById.get(id) ?? null;
  const older = olderById.get(id) ?? null;
  const row = {
    newer_activity: newer,
    older_activity: older,
    newer_rank: statusRank(newer),
    older_rank: statusRank(older),
  };
  const base = newer ?? older;
  const terminal = selectTerminalActivity(row);
  const { status: _status, completedAt: _completedAt, ...content } = base;
  return {
    ...content,
    status: terminal?.status ?? null,
    ...(terminal?.completedAt === undefined ? {} : { completedAt: terminal.completedAt }),
  };
});
const currentActivityId = serialized
  .find((activity) => activity.status === "pending" || activity.status === "active")
  ?.id ?? null;

assert.equal(
  serialized.find((activity) => activity.id === "reflect")?.status,
  "pending",
  "older-only pending activity serializes with status pending",
);
assert.equal(
  currentActivityId,
  "reflect",
  "older-only pending activity remains selectable as current",
);

console.log("daily-session SQL logic: 2 ok, 0 failed");
