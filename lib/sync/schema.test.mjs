// npx tsx lib/sync/schema.test.mjs
//
// Every column name written by lib/sync/supabase-sync.ts must exist in the real
// Supabase schema.
//
// This matters more than it looks. `bg()` is fire-and-forget, and supabase-js
// RESOLVES with `{ error }` instead of rejecting — so a wrong column name does not
// throw, does not reject, and does not log. It silently writes nothing, and the
// student's data is gone with no signal anywhere. That is the exact failure this
// file exists to prevent.
//
// The schema below is transcribed from the live database (verified via the Supabase
// MCP against project nwjtvlvzbfrlzgxiqzgd). If a migration adds a column, update
// this list in the same commit.
import { readFileSync } from "node:fs";

let ok = 0, fail = 0;
const check = (cond, m) => { if (cond) ok++; else { fail++; console.log("FAIL", m); } };

const SCHEMA = {
  profiles: ["id", "name", "coach_language", "created_at", "updated_at"],
  attempts: ["id", "profile_id", "item_id", "lesson_id", "category_id", "phoneme", "target", "heard", "score", "passed", "heard_partner", "at", "fluency"],
  progress: ["profile_id", "item_id", "lesson_id", "category_id", "phoneme", "attempts", "passes", "box", "due_at", "last_result", "last_score", "updated_at"],
  player_stats: ["profile_id", "xp", "current_streak", "longest_streak", "last_active_day", "today_key", "today_xp", "total_attempts", "total_passes", "best_combo", "achievements", "updated_at", "stars", "owned_cosmetics", "equipped_bg", "equipped_accessory", "equipped_effect", "last_chest_day", "streak_freezes", "freeze_used_day", "equipped_pet", "equipped_outfit"],
  settings: ["profile_id", "daily_goal", "speech_rate", "voice_uri", "recognition_lang", "updated_at", "student_name", "onboarding", "coach_language", "difficulty", "sound_enabled", "instructor_mode"],
  custom_lessons: ["id", "data", "order", "updated_at"],
  exam_attempts: ["id", "profile_id", "day", "at", "level", "score", "passed", "sections", "weakest", "created_at"],
  call_scores: ["id", "profile_id", "scenario_id", "at", "score", "checks", "created_at"],
  talk_sessions: ["id", "profile_id", "scenario_id", "at", "duration_ms", "student_turns", "avg_pause_ms", "completed", "created_at"],
  conv_items: ["profile_id", "item_id", "text", "meaning", "source", "scenario_id", "created_at_ms", "created_at"],
  quests: ["profile_id", "day", "state", "updated_at"],
  events: ["id", "profile_id", "type", "at", "day", "props", "created_at"],
  daily_sessions: ["profile_id", "day", "version", "payload", "updated_at"],
};

const src = readFileSync("lib/sync/supabase-sync.ts", "utf8");

// Find every `sb.from("table")` and the object literal that follows it, then pull
// the top-level keys out of that literal by brace matching.
const calls = [...src.matchAll(/\.from\("(\w+)"\)\s*\.\s*(upsert|insert|update)\s*\(\s*\{/g)];

// Durable pushes build their payloads in named row-builder functions (shared
// between the live push and the outbox replay), so those literals no longer
// sit next to the .from() call. Map each builder back to its table and check
// its keys the same way.
const BUILDER_TABLES = { attemptRow: "attempts", examRow: "exam_attempts", callRow: "call_scores", talkRow: "talk_sessions" };
for (const m of src.matchAll(/function (attemptRow|examRow|callRow|talkRow)\([^)]*\) \{\s*return \{/g)) {
  calls.push(Object.assign([m[0], BUILDER_TABLES[m[1]]], { index: m.index }));
}

const dailySql = readFileSync("supabase/daily_sessions.sql", "utf8");
check(dailySql.includes("profile_id uuid not null references auth.users(id) on delete cascade"), "daily sessions belong to authenticated users");
check(dailySql.includes("primary key (profile_id, day)"), "daily sessions have one row per account and day");
check(dailySql.includes("alter table public.daily_sessions enable row level security"), "daily session RLS is enabled");
check(dailySql.includes("profile_id = (select auth.uid())"), "daily session policy scopes reads and writes to auth.uid()");
check(dailySql.includes("create or replace function public.merge_daily_session"), "atomic daily-session merge function exists");
check(dailySql.includes("v_profile_id uuid := auth.uid()"), "merge function derives ownership from the authenticated user");
check(dailySql.includes("for update"), "merge function locks the profile/day row before reconciliation");
check(dailySql.includes("full join older_activities"), "merge function preserves disjoint activity evidence");
check(dailySql.includes("when 'completed' then 3 when 'technical-skip' then 2"), "merge function applies terminal status precedence");
check(dailySql.includes("or coalesce((p_payload ->> 'rewardClaimed')::boolean, false)"), "merge function preserves claimed rewards");
check(dailySql.includes("grant execute on function public.merge_daily_session"), "authenticated users can execute the merge RPC");
check((src.match(/\.rpc\("merge_daily_session"/g) ?? []).length === 2, "live push and outbox replay both use the merge RPC");
check(!src.includes('.from("daily_sessions").upsert'), "client has no last-writer-wins daily-session upsert");
check(calls.length >= 9, `found the write calls (${calls.length})`);

for (const m of calls) {
  const table = m[1];
  const known = SCHEMA[table];
  check(Array.isArray(known), `table "${table}" is a known table`);
  if (!known) continue;

  // Walk from the opening brace of the payload to its match.
  let i = m.index + m[0].length - 1;
  let depth = 0;
  const start = i;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  const body = src.slice(start + 1, i);

  // Top-level keys only: skip anything nested inside a deeper brace/bracket.
  let d = 0;
  const keys = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (d === 0) {
      const k = trimmed.match(/^([a-z_][a-z0-9_]*)\s*:/i);
      if (k) keys.push(k[1]);
    }
    d += (line.match(/[{[]/g) || []).length - (line.match(/[}\]]/g) || []).length;
  }

  check(keys.length > 0, `payload for "${table}" has parsed keys`);
  for (const k of keys) {
    check(known.includes(k), `${table}.${k} exists in the live schema (typo = silent data loss)`);
  }
}

// The select() lists in the pull path must also name real columns.
for (const m of src.matchAll(/\.from\("(\w+)"\)\s*\n?\s*\.select\("([^"]+)"\)/g)) {
  const table = m[1];
  const cols = m[2].split(",").map((c) => c.trim()).filter((c) => c && c !== "*");
  for (const c of cols) {
    check(SCHEMA[table]?.includes(c), `select ${table}.${c} exists in the live schema`);
  }
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
