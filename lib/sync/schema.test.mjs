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
// The schema below is the application contract for the authoritative rebuild
// snapshot. If a migration adds an active table, column, function, policy, grant,
// or index, mirror its final definition into current-schema.sql in the same commit.
import { existsSync, readFileSync } from "node:fs";

let ok = 0, fail = 0;
const check = (cond, m) => { if (cond) ok++; else { fail++; console.log("FAIL", m); } };

const SCHEMA = {
  profiles: ["id", "name", "coach_language", "created_at", "updated_at"],
  attempts: ["id", "profile_id", "client_attempt_id", "item_id", "lesson_id", "category_id", "phoneme", "target", "heard", "score", "passed", "heard_partner", "at", "fluency", "policy_version", "provider_status", "pronunciation_score", "accuracy_score", "completeness_score", "prosody_score", "target_phoneme_score", "weakest_phoneme", "weakest_word", "attempt_ordinal", "pronunciation_outcome"],
  progress: ["profile_id", "item_id", "lesson_id", "category_id", "phoneme", "attempts", "passes", "box", "due_at", "last_result", "last_score", "updated_at"],
  player_stats: ["profile_id", "xp", "current_streak", "longest_streak", "last_active_day", "today_key", "today_xp", "total_attempts", "total_passes", "best_combo", "achievements", "updated_at", "stars", "owned_cosmetics", "equipped_bg", "equipped_accessory", "equipped_effect", "last_chest_day", "streak_freezes", "freeze_used_day", "equipped_pet", "equipped_outfit", "avatar_base", "equipped_avatar_outfit", "equipped_cap"],
  settings: ["profile_id", "daily_goal", "speech_rate", "voice_uri", "recognition_lang", "updated_at", "student_name", "onboarding", "coach_language", "difficulty", "sound_enabled", "instructor_mode", "voice_consent"],
  custom_lessons: ["id", "data", "order", "updated_at"],
  exam_attempts: ["id", "profile_id", "day", "at", "level", "score", "passed", "sections", "weakest", "created_at"],
  call_scores: ["id", "profile_id", "scenario_id", "at", "score", "checks", "created_at"],
  virtual_calls: ["profile_id", "at", "scenario_id", "mode", "level", "started_at", "ended_at",
    "duration_ms", "learner_turns", "clean_turns", "met_criteria", "corrections", "priorities",
    "vocabulary_used", "pronunciation", "retried_count", "retried_accepted_count", "created_at"],
  talk_sessions: ["id", "profile_id", "scenario_id", "at", "duration_ms", "student_turns", "avg_pause_ms", "completed", "created_at"],
  conv_items: ["profile_id", "item_id", "text", "meaning", "source", "scenario_id", "created_at_ms", "created_at"],
  quests: ["profile_id", "day", "state", "updated_at"],
  events: ["id", "profile_id", "type", "at", "day", "props", "created_at"],
  daily_sessions: ["profile_id", "day", "version", "payload", "updated_at"],
};

const src = readFileSync("lib/sync/supabase-sync.ts", "utf8");
const dexieRepository = readFileSync("lib/db/dexie-repository.ts", "utf8");

const currentSchemaSql = readFileSync("supabase/current-schema.sql", "utf8");
const virtualCallsSql = readFileSync("supabase/virtual_calls.sql", "utf8");
const migrationV3Sql = readFileSync("supabase/migration-v3-custom-lessons-admin.sql", "utf8");
const migrationV5Path = "supabase/migration-v5-admin-role.sql";
const migrationV5Sql = existsSync(migrationV5Path) ? readFileSync(migrationV5Path, "utf8") : "";
const migrationV6Path = "supabase/migration-v6-api-quotas.sql";
const migrationV6Sql = existsSync(migrationV6Path) ? readFileSync(migrationV6Path, "utf8") : "";
const migrationV7Path = "supabase/migration-v7-pronunciation-evidence.sql";
const migrationV7Sql = existsSync(migrationV7Path) ? readFileSync(migrationV7Path, "utf8") : "";
const migrationV8Path = "supabase/migration-v8-stage-exam-completion.sql";
const migrationV8Sql = existsSync(migrationV8Path) ? readFileSync(migrationV8Path, "utf8") : "";
const readme = readFileSync("README.md", "utf8");
const adminClaim = "((select auth.jwt()) -> 'app_metadata' ->> 'clara_role') = 'admin'";
const normalized = (sql) => sql.replace(/\s+/g, " ").trim();
const executableCurrentSchemaSql = currentSchemaSql.replace(/--.*$/gm, "");
const normalizedCurrentSchemaSql = normalized(executableCurrentSchemaSql);
const executableMigrationV5Sql = migrationV5Sql.replace(/--.*$/gm, "");
const expectedAdminPolicies = [
  `create policy custom_lessons_insert_admin on public.custom_lessons for insert to authenticated with check (${adminClaim});`,
  `create policy custom_lessons_update_admin on public.custom_lessons for update to authenticated using (${adminClaim}) with check (${adminClaim});`,
  `create policy custom_lessons_delete_admin on public.custom_lessons for delete to authenticated using (${adminClaim});`,
];

check(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(currentSchemaSql), "authoritative schema contains no literal admin email address");
for (const policy of expectedAdminPolicies) {
  check(normalized(currentSchemaSql).includes(policy), `current schema has claim-based ${policy.match(/custom_lessons_(\w+)_admin/)?.[1]} policy`);
}
check(migrationV5Sql.length > 0, "the planned admin-role audit migration exists");
const legacyAdminPolicyNames = [
  "custom_lessons_write_admin",
  "custom_lessons_insert_admin",
  "custom_lessons_update_admin",
  "custom_lessons_delete_admin",
];
for (const policyName of legacyAdminPolicyNames) {
  check(
    normalized(executableMigrationV5Sql).includes(`drop policy if exists ${policyName} on public.custom_lessons;`),
    `admin-role migration drops legacy policy ${policyName}`,
  );
}
check(!/->>\s*'email'/i.test(migrationV5Sql), "admin-role migration contains no email-based JWT predicate");
check(!/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(migrationV5Sql), "admin-role migration contains no literal admin email address");
for (const policy of expectedAdminPolicies) {
  check(normalized(executableMigrationV5Sql).includes(policy), `admin-role migration has claim-based ${policy.match(/custom_lessons_(\w+)_admin/)?.[1]} policy`);
}
const createdPolicies = [...executableMigrationV5Sql.matchAll(/create policy ([a-z0-9_]+)\b/gi)].map((match) => match[1]);
check(
  createdPolicies.length === expectedAdminPolicies.length &&
    ["custom_lessons_insert_admin", "custom_lessons_update_admin", "custom_lessons_delete_admin"]
      .every((policyName) => createdPolicies.includes(policyName)),
  "admin-role migration creates only the three operation-specific admin policies",
);
check(
  executableMigrationV5Sql.split(adminClaim).length - 1 === 4,
  "admin-role migration uses only four required claim predicates",
);
check(migrationV6Sql.length > 0, "the planned durable-quota migration exists");
for (const fragment of [
  "create table if not exists private.api_usage_windows",
  "create or replace function public.consume_paid_api_quota",
  "set search_path = ''",
  "grant execute on function public.consume_paid_api_quota",
]) {
  check(
    normalized(currentSchemaSql).includes(normalized(fragment)) &&
      normalized(migrationV6Sql).includes(normalized(fragment)),
    `authoritative schema mirrors quota contract: ${fragment}`,
  );
}
check(migrationV7Sql.length > 0, "the bounded pronunciation-evidence migration exists");
const executableMigrationV7Sql = migrationV7Sql.replace(/--.*$/gm, "");
const normalizedMigrationV7Sql = normalized(executableMigrationV7Sql);
const earlyAttemptsBody = executableCurrentSchemaSql.match(
  /create table if not exists public\.attempts\s*\(([\s\S]*?)\n\);/i,
)?.[1] ?? "";
for (const score of ["pronunciation_score", "accuracy_score", "completeness_score", "prosody_score", "target_phoneme_score"]) {
  check(
    normalizedMigrationV7Sql.includes(`${score} between 0 and 100`) &&
      normalizedCurrentSchemaSql.includes(`${score} between 0 and 100`),
    `${score} is bounded to 0-100 in migration and authoritative schema`,
  );
}
for (const score of ["score", "fluency", "pronunciation_score", "accuracy_score", "completeness_score", "prosody_score", "target_phoneme_score"]) {
  check(
    new RegExp(`\\b${score}\\s+double precision\\b`, "i").test(earlyAttemptsBody) &&
      normalizedMigrationV7Sql.includes(`${score} type double precision`),
    `${score} preserves fractional threshold evidence in rebuild and migration`,
  );
}
for (const legacyScore of ["score", "fluency"]) {
  check(
    normalizedMigrationV7Sql.includes(`alter column ${legacyScore} type double precision using ${legacyScore}::double precision`),
    `migration safely converts legacy ${legacyScore} integers`,
  );
}
for (const forbidden of ["transcript", "email", "audio", "audio_url", "blob", "provider_json", "provider_payload"]) {
  check(
    !new RegExp(`(?:add column|^\\s*)${forbidden}\\b`, "im").test(executableMigrationV7Sql),
    `pronunciation migration adds no ${forbidden} column`,
  );
}
for (const sql of [normalizedMigrationV7Sql, normalizedCurrentSchemaSql]) {
  check(sql.includes("alter table public.attempts enable row level security;"), "attempt RLS is explicitly enabled");
  check(sql.includes("to authenticated using ((select auth.uid())::text = profile_id)"), "attempt SELECT is owner-only");
  check(sql.includes("to authenticated with check ((select auth.uid())::text = profile_id)"), "attempt INSERT prevents cross-owner assignment");
  check(!sql.includes("auth.role()"), "attempt policy does not use deprecated auth.role()");
  check(!sql.includes("user_metadata"), "attempt policy never trusts user metadata");
  check(
    sql.includes("score is null and fluency is null and pronunciation_score is null"),
    "technical skips cannot retain legacy fluency or structured weakness scores",
  );
  check(sql.includes("passed is not true"), "technical/unavailable rows cannot claim a pass");
  check(sql.includes("pronunciation_outcome is distinct from 'mastered'"), "technical/unavailable rows cannot claim mastery");
}
for (const index of ["attempts_profile_client_id_uniq", "attempts_profile_weak_sound_idx", "progress_profile_due_at_idx"]) {
  const prefix = index === "attempts_profile_client_id_uniq" ? "create unique index if not exists" : "create index if not exists";
  check(
    normalizedMigrationV7Sql.includes(`${prefix} ${index}`) &&
      normalizedCurrentSchemaSql.includes(`${prefix} ${index}`),
    `${index} exists in migration and authoritative schema`,
  );
}
check(normalizedMigrationV7Sql.includes("revoke all on table public.attempts from anon;"), "anonymous Data API access is revoked");
check(normalizedMigrationV7Sql.includes("grant select, insert on table public.attempts to authenticated;"), "existing altered table has explicit Data API grants");
check(normalizedMigrationV7Sql.includes("grant usage on sequence public.attempts_id_seq to authenticated;"), "identity inserts receive only required sequence usage");
check(!normalizedMigrationV7Sql.includes("grant usage, select on sequence public.attempts_id_seq"), "sequence SELECT is not granted without proof it is required");
check(!/service[_ ]role/i.test(executableMigrationV7Sql), "migration does not expose or mention a service-role credential");
check(migrationV8Sql.length > 0, "the atomic stage-exam completion migration exists");
for (const sql of [normalized(migrationV8Sql.replace(/--.*$/gm, "")), normalizedCurrentSchemaSql]) {
  check(sql.includes("create or replace function public.complete_stage_exam"), "stage completion RPC exists");
  check(sql.includes("security invoker"), "stage completion runs with invoker privileges");
  check(sql.includes("v_profile_id text := (select auth.uid())::text"), "stage completion derives its owner from auth.uid()");
  check(sql.includes("p_score not between 70 and 100") && sql.includes("octet_length(p_sections::text) > 512"), "stage completion rejects scores below the canonical pass threshold and bounds section input");
  check(sql.includes("for update") && sql.toLowerCase().includes("conflicting stage exam replay"), "stage completion rejects mutated replays under a row lock");
  check(sql.includes("revoke all on function public.complete_stage_exam") && sql.includes("to authenticated"), "stage completion RPC has explicit grants and revokes");
  check(sql.includes("p_target_level is distinct from v_expected_target") && sql.includes("jsonb_set(onboarding, '{level}'"), "stage completion accepts only the canonical next level and preserves onboarding fields");
  check(sql.includes("if v_existing_found then") && sql.includes("return;") && sql.includes("v_current_level is distinct from p_level"), "exact replay returns idempotently while a fresh sitting requires the locked source level");
  check(!sql.includes("p_onboarding jsonb"), "stage completion never accepts an arbitrary onboarding object");
  check(sql.includes("revoke all on table public.exam_attempts from public, anon, authenticated") && sql.includes("grant select, insert on table public.exam_attempts to authenticated"), "exam attempts have explicit least-privilege grants");
  check(sql.includes("revoke all on table public.settings from public, anon, authenticated") && sql.includes("grant select, insert, update on table public.settings to authenticated"), "settings promotion and first-row provisioning have explicit least-privilege grants");
  check(sql.includes("grant select, insert, update on table public.settings to authenticated") && !sql.includes("grant select, insert, update, delete on table public.settings"), "settings upsert supports first-row provisioning without delete");
  check(sql.includes("create policy settings_select_own") && sql.includes("create policy settings_insert_own") && sql.includes("create policy settings_update_own"), "settings has explicit owner SELECT, INSERT, and UPDATE policies");
  check(sql.includes("settings_insert_own on public.settings for insert to authenticated with check (profile_id = (select auth.uid())::text)")
    && sql.includes("settings_update_own on public.settings for update to authenticated using (profile_id = (select auth.uid())::text) with check (profile_id = (select auth.uid())::text)"), "settings creation and update enforce authenticated owner identity");
  check(sql.includes("settings_select_own on public.settings for select to authenticated using (profile_id = (select auth.uid())::text)")
    && !/grant [^;]*delete[^;]* on table public\.settings/.test(sql), "settings reads are owner-only and authenticated receives no DELETE capability");
  check(sql.includes("current_setting('clara.stage_exam_completion', true)") && sql.includes("perform set_config('clara.stage_exam_completion', 'canonical', true)"), "plain inserts cannot persist passed exams outside canonical completion RPC");
  check(sql.indexOf("select onboarding ->> 'level'") < sql.indexOf("insert into public.exam_attempts")
    && sql.indexOf("if v_existing_found then") < sql.indexOf("if v_current_level is distinct from p_level"), "settings is locked before mutation, exact replay is separated, and new completion requires exact source state");
  check(sql.includes("grant usage, select on sequence public.exam_attempts_id_seq to authenticated"), "exam identity sequence grants only required capabilities");
}
check(/\.from\("settings"\)\.upsert\(/.test(src), "the normal settings writer provisions an absent first row through owner-bound upsert");
check(/transaction\("rw", \[concrete\.settings, concrete\.examAttempts, concrete\.examCheckpoints, concrete\.outbox\][\s\S]{0,1400}settings\.onboarding\.level !== attempt\.level/.test(dexieRepository)
  && [normalized(migrationV8Sql), normalizedCurrentSchemaSql].every((sql) => sql.includes("v_current_level is distinct from p_level")), "local and SQL promotion both compare transaction-fresh stored source level before mutation");
check((src.match(/\.rpc\("complete_stage_exam"/g) ?? []).length === 1, "combined exam outbox replays through the atomic RPC");
check(!/pushExamAttempt\([\s\S]{0,300}pushSettings/.test(src), "exam completion has no split cloud mirror path");
check(
  !/keep (?:the|them|this).*in sync/i.test(migrationV3Sql),
  "historical v3 migration contains no current email-list maintenance instruction",
);
const rebuildSection = readme.match(/## Database & migrations \(Supabase\)[\s\S]*?(?=\n---)/)?.[0] ?? "";
const rebuildSqlPaths = [...rebuildSection.matchAll(/`(supabase\/[^`]+\.sql)`/g)].map((match) => match[1]);
check(
  rebuildSqlPaths.length === 1 && rebuildSqlPaths[0] === "supabase/current-schema.sql",
  "README rebuild instructions name only supabase/current-schema.sql",
);

// Find every `sb.from("table")` and the object literal that follows it, then pull
// the top-level keys out of that literal by brace matching.
const calls = [...src.matchAll(/\.from\("(\w+)"\)\s*\.\s*(upsert|insert|update)\s*\(\s*\{/g)];

// Durable pushes build their payloads in named row-builder functions (shared
// between the live push and the outbox replay), so those literals no longer
// sit next to the .from() call. Map each builder back to its table and check
// its keys the same way.
const BUILDER_TABLES = { attemptRow: "attempts", progressRow: "progress", questRow: "quests", examRow: "exam_attempts", callRow: "call_scores", talkRow: "talk_sessions", virtualCallRow: "virtual_calls", settingsRow: "settings" };
for (const m of src.matchAll(/function (attemptRow|progressRow|questRow|examRow|callRow|talkRow|virtualCallRow|settingsRow)\([^)]*\) \{\s*return \{/g)) {
  calls.push(Object.assign([m[0], BUILDER_TABLES[m[1]]], { index: m.index }));
}

// Recovery-critical objects must exist in the authoritative snapshot itself.
// Historical/additive SQL files are deliberately not read here: a new project
// executes current-schema.sql alone.
const tableBody = (table) =>
  executableCurrentSchemaSql.match(
    new RegExp(`create table if not exists public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"),
  )?.[1] ?? "";
const hasColumn = (body, column) => new RegExp(`^\\s*"?${column}"?\\s+`, "mi").test(body);

const attemptsBody = tableBody("attempts");
for (const column of SCHEMA.attempts) {
  check(hasColumn(attemptsBody, column), `authoritative attempts defines ${column}`);
}

const dailySessionsBody = tableBody("daily_sessions");
check(dailySessionsBody.length > 0, "authoritative schema creates daily_sessions");
check((executableCurrentSchemaSql.match(/create table if not exists public\.daily_sessions\b/gi) ?? []).length === 1, "authoritative schema creates daily_sessions exactly once");
for (const column of SCHEMA.daily_sessions) {
  check(hasColumn(dailySessionsBody, column), `authoritative daily_sessions defines ${column}`);
}
check(dailySessionsBody.includes("profile_id uuid not null references auth.users(id) on delete cascade"), "daily sessions belong to authenticated users");
check(dailySessionsBody.includes("primary key (profile_id, day)"), "daily sessions have one row per account and day");
check(normalizedCurrentSchemaSql.includes("alter table public.daily_sessions enable row level security;"), "authoritative daily session RLS is enabled");
check(
  normalizedCurrentSchemaSql.includes(
    "create policy daily_sessions_own_rows on public.daily_sessions for all to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));",
  ),
  "authoritative daily session policy scopes reads and writes to auth.uid()",
);
const mergeDailySessionSql =
  executableCurrentSchemaSql.match(
    /create or replace function public\.merge_daily_session\s*\([\s\S]*?\n\$\$;/i,
  )?.[0] ?? "";
check((executableCurrentSchemaSql.match(/create or replace function public\.merge_daily_session\s*\(/gi) ?? []).length === 1, "authoritative schema defines merge_daily_session exactly once");
check(mergeDailySessionSql.includes("security invoker"), "merge function runs with invoker security");
check(mergeDailySessionSql.includes("v_profile_id uuid := auth.uid()"), "merge function derives ownership from the authenticated user");
check(mergeDailySessionSql.includes("for update"), "merge function locks the profile/day row before reconciliation");
check(mergeDailySessionSql.includes("full join older_activities"), "merge function preserves disjoint activity evidence");
check(mergeDailySessionSql.includes("when 'completed' then 3 when 'technical-skip' then 2"), "merge function applies terminal status precedence");
check(mergeDailySessionSql.includes("or coalesce((p_payload ->> 'rewardClaimed')::boolean, false)"), "merge function preserves claimed rewards");
for (const permission of [
  "revoke all on table public.daily_sessions from public;",
  "revoke all on table public.daily_sessions from anon;",
  "grant select, insert, update on table public.daily_sessions to authenticated;",
  "revoke all on function public.merge_daily_pronunciation_state(jsonb, jsonb) from public;",
  "revoke all on function public.merge_daily_pronunciation_state(jsonb, jsonb) from anon;",
  "grant execute on function public.merge_daily_pronunciation_state(jsonb, jsonb) to authenticated;",
  "revoke all on function public.merge_daily_session(text, integer, jsonb, bigint) from public;",
  "revoke all on function public.merge_daily_session(text, integer, jsonb, bigint) from anon;",
  "grant execute on function public.merge_daily_session(text, integer, jsonb, bigint) to authenticated;",
]) {
  check(normalizedCurrentSchemaSql.includes(permission), `authoritative merge RPC permission: ${permission}`);
}

const virtualCallsBody = tableBody("virtual_calls");
check(virtualCallsBody.length > 0, "authoritative schema creates virtual_calls");
check((executableCurrentSchemaSql.match(/create table if not exists public\.virtual_calls\b/gi) ?? []).length === 1, "authoritative schema creates virtual_calls exactly once");
for (const column of SCHEMA.virtual_calls) {
  check(hasColumn(virtualCallsBody, column), `authoritative virtual_calls defines ${column}`);
}
check(virtualCallsBody.includes("primary key (profile_id, at)"), "virtual calls use the active conflict key");
check(
  (executableCurrentSchemaSql.match(/create index if not exists virtual_calls_profile_at_idx\b/gi) ?? []).length === 1 &&
    normalizedCurrentSchemaSql.includes("create index if not exists virtual_calls_profile_at_idx on public.virtual_calls(profile_id, at desc);"),
  "authoritative schema creates the virtual-call pull index exactly once",
);
check(normalizedCurrentSchemaSql.includes("alter table public.virtual_calls enable row level security;"), "authoritative virtual-call RLS is enabled");
const virtualCallSchemaSources = [executableCurrentSchemaSql, virtualCallsSql.replace(/--.*$/gm, "")];
const compatibilityBlock = (sql) => normalized(sql.match(
  /create or replace function public\.normalize_virtual_call_pronunciation_insert\(\)[\s\S]*?create trigger virtual_calls_normalize_pronunciation_before_insert[\s\S]*?;/i,
)?.[0] ?? "");
const pronunciationConstraintRefreshBlock = (sql) => normalized(sql.match(
  /alter table public\.virtual_calls\s+drop constraint if exists virtual_calls_pronunciation_shape;[\s\S]*?\)\s*not valid;/i,
)?.[0] ?? "");
const simulateUpgradedPronunciationConstraint = (sql) => {
  const refresh = pronunciationConstraintRefreshBlock(sql);
  let installed = "round1";
  for (const operation of refresh.matchAll(/drop constraint if exists virtual_calls_pronunciation_shape|add constraint virtual_calls_pronunciation_shape[\s\S]*?not valid/gi)) {
    installed = operation[0].toLowerCase().startsWith("drop") ? "absent" : "latest-not-valid";
  }
  return installed;
};
for (const sourceSql of virtualCallSchemaSources) {
  const sql = normalized(sourceSql);
  const triggerSql = compatibilityBlock(sourceSql);
  check(sql.includes("revoke all on table public.virtual_calls from public;"), "virtual calls revoke PUBLIC table privileges");
  check(sql.includes("revoke all on table public.virtual_calls from anon;"), "virtual calls revoke anon table privileges");
  check(sql.includes("grant select, insert on table public.virtual_calls to authenticated;"), "virtual calls grant authenticated only required SELECT and INSERT");
  check(!/grant\s+[^;]*(?:update|delete)[^;]*on table public\.virtual_calls/i.test(sql), "virtual calls grant no unproven UPDATE or DELETE");
  check(sql.includes("create policy virtual_calls_select_own on public.virtual_calls for select to authenticated using (profile_id = (select auth.uid())::text);"),
    "virtual-call SELECT policy is exact and owner-only");
  check(sql.includes("create policy virtual_calls_insert_own on public.virtual_calls for insert to authenticated with check (profile_id = (select auth.uid())::text);"),
    "virtual-call INSERT policy is exact and owner-only");
  check(!sql.includes("create policy own_rows on public.virtual_calls for all"), "virtual calls have no FOR ALL policy");
  check(sql.includes("virtual_calls_pronunciation_shape"), "virtual calls install the named pronunciation-shape constraint idempotently");
  check(sql.includes("octet_length(pronunciation::text) <= 2048"), "virtual-call pronunciation JSON has a hard byte bound");
  check(sql.includes("pronunciation - array['version', 'diagnosticCueKeys', 'scripted']::text[] = '{}'::jsonb"),
    "virtual-call pronunciation JSON rejects arbitrary top-level keys");
  check(sql.includes("pronunciation ?& array['version', 'diagnosticCueKeys', 'scripted']"),
    "virtual-call pronunciation JSON requires every top-level key instead of allowing CHECK nulls");
  check(sql.includes("pronunciation ->> 'version' = '2'"), "virtual-call pronunciation JSON requires the safe version-2 shape");
  check(sql.includes("jsonb_typeof(pronunciation -> 'version') = 'number'"),
    "virtual-call pronunciation version requires a JSON number rather than a numeric string");
  check(sql.includes("jsonb_typeof(pronunciation #> '{scripted,graded}') = 'number'"),
    "virtual-call pronunciation counts require JSON numbers rather than numeric strings");
  check(sql.includes("jsonb_typeof(pronunciation #> '{scripted,averageScore}') = 'number'"),
    "virtual-call pronunciation average requires a JSON number when present");
  check(triggerSql.includes("jsonb_typeof(new.pronunciation -> 'version') = 'number'") &&
    triggerSql.includes("new.pronunciation -> 'version' = '2'::jsonb"),
  "trigger early-return accepts only numeric version 2");
  check(!triggerSql.includes("new.pronunciation ->> 'version' = '2' then"),
    "JSON string version 2 cannot bypass legacy validation and the final constraint");
  const refresh = pronunciationConstraintRefreshBlock(sourceSql);
  check(refresh.length > 0 &&
    (sourceSql.match(/drop constraint if exists virtual_calls_pronunciation_shape/gi) ?? []).length === 1 &&
    (sourceSql.match(/add constraint virtual_calls_pronunciation_shape/gi) ?? []).length === 1,
  "rerun explicitly replaces the prior named pronunciation constraint exactly once");
  check(simulateUpgradedPronunciationConstraint(sourceSql) === "latest-not-valid",
    "an upgraded schema with the round-1 named constraint finishes on the latest NOT VALID constraint");
  check(refresh.includes("jsonb_typeof(pronunciation -> 'version') = 'number'") &&
    refresh.includes("pronunciation ->> 'version' = '2'") && refresh.endsWith("not valid;"),
  "replacement constraint accepts numeric v2, rejects string v2, and preserves existing rows");
  check(!/if\s+not\s+exists\s*\([\s\S]*?pg_constraint[\s\S]*?virtual_calls_pronunciation_shape/i.test(refresh),
    "constraint refresh never trusts the obsolete constraint name as proof of its definition");
  check((sourceSql.match(/create or replace function public\.normalize_virtual_call_pronunciation_insert\(\)/gi) ?? []).length === 1,
    "virtual-call legacy pronunciation normalization function is idempotently defined once");
  check((sourceSql.match(/drop trigger if exists virtual_calls_normalize_pronunciation_before_insert on public\.virtual_calls/gi) ?? []).length === 1 &&
    (sourceSql.match(/create trigger virtual_calls_normalize_pronunciation_before_insert/gi) ?? []).length === 1,
  "virtual-call legacy pronunciation trigger is idempotently replaced once");
  check(sql.includes("security invoker set search_path = pg_catalog, public"),
    "virtual-call normalization function has fixed search_path and invoker security");
  check(sql.includes("pg_column_size(new.pronunciation) > 2048"),
    "legacy virtual-call pronunciation is bounded before transformation");
  check(sql.includes("new.pronunciation - array['scored', 'averageScore', 'worstWords']::text[] <> '{}'::jsonb") &&
    sql.includes("not (new.pronunciation ?& array['scored', 'averageScore', 'worstWords'])"),
  "legacy pronunciation accepts only its exact required top-level shape");
  check(sql.includes("jsonb_typeof(new.pronunciation -> 'worstWords') is distinct from 'array'") &&
    sql.includes("jsonb_array_length(new.pronunciation -> 'worstWords') > 3") &&
    sql.includes("jsonb_array_elements(new.pronunciation -> 'worstWords')") &&
    sql.includes("octet_length(word) > 80"),
  "legacy free-text words are strictly typed and bounded before being dropped");
  check(sql.includes("raise exception 'Invalid or unbounded legacy virtual-call pronunciation' using errcode = '22023'"),
    "malformed or oversized legacy pronunciation is rejected explicitly");
  const transformed = normalized(sourceSql.match(/new\.pronunciation\s*:=([\s\S]*?);\s*return new;/i)?.[1] ?? "");
  check(transformed.includes("jsonb_build_object( 'version', 2, 'diagnosticCueKeys', '[]'::jsonb, 'scripted', jsonb_build_object(") &&
    transformed.includes("'graded', (new.pronunciation ->> 'scored')::integer") &&
    transformed.includes("'mastered', 0") && transformed.includes("'practiced', (new.pronunciation ->> 'scored')::integer") &&
    transformed.includes("'unavailable', 0") && transformed.includes("'averageScore', (new.pronunciation ->> 'averageScore')::integer"),
  "exact stale-client summary is conservatively transformed into current no-text evidence");
  check(!transformed.includes("worstWords"), "legacy worstWords free text never enters the transformed row");
  for (const role of ["public", "anon", "authenticated"]) {
    check(sql.includes(`revoke all on function public.normalize_virtual_call_pronunciation_insert() from ${role};`),
      `trigger-only pronunciation function denies direct ${role} execution`);
  }
}
check(compatibilityBlock(virtualCallSchemaSources[0]).length > 0 &&
  compatibilityBlock(virtualCallSchemaSources[0]) === compatibilityBlock(virtualCallSchemaSources[1]),
"authoritative and additive virtual-call schemas carry the exact same compatibility transform");
check(pronunciationConstraintRefreshBlock(virtualCallSchemaSources[0]).length > 0 &&
  pronunciationConstraintRefreshBlock(virtualCallSchemaSources[0]) === pronunciationConstraintRefreshBlock(virtualCallSchemaSources[1]),
"authoritative and additive virtual-call schemas carry the exact same upgraded constraint replacement");

const playerStatsBody = tableBody("player_stats");
for (const column of ["avatar_base", "equipped_avatar_outfit", "equipped_cap"]) {
  check(
    hasColumn(playerStatsBody, column) &&
      (executableCurrentSchemaSql.match(new RegExp(`^\\s*${column}\\s+`, "gmi")) ?? []).length === 1,
    `authoritative player_stats defines ${column} exactly once`,
  );
}
for (const index of [
  "events_profile_at_idx on public.events(profile_id, at desc)",
  "events_profile_day_idx on public.events(profile_id, day)",
  "events_profile_type_day_idx on public.events(profile_id, type, day)",
  "events_type_at_idx on public.events(type, at desc)",
]) {
  const indexName = index.split(" ")[0];
  check(
    normalizedCurrentSchemaSql.includes(`create index if not exists ${index};`) &&
      (executableCurrentSchemaSql.match(new RegExp(`create index if not exists ${indexName}\\b`, "gi")) ?? []).length === 1,
    `authoritative schema creates ${indexName} exactly once`,
  );
}

check((src.match(/\.rpc\("merge_daily_session"/g) ?? []).length === 2, "live push and outbox replay both use the merge RPC");
check(!src.includes('.from("daily_sessions").upsert'), "client has no last-writer-wins daily-session upsert");
check((src.match(/\.from\("virtual_calls"\)/g) ?? []).length >= 2, "live push and outbox replay both use virtual_calls");
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
