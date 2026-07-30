// npx tsx lib/privacy-access.test.mjs
//
// Two things are proved here. First: signed-out learners must be able to read
// the notice linked from Login. Second: the instructor cockpit is admin-only and
// says nothing about a learner beyond bounded counts — no transcript, no voice
// content, no email, no raw event properties, not for anyone.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0;
let fail = 0;
const assert = (condition, message) => {
  if (condition) ok++;
  else {
    fail++;
    console.log("FAIL", message);
  }
};

const gate = readFileSync(join(ROOT, "components/auth-gate.tsx"), "utf8");
const login = readFileSync(join(ROOT, "components/login-screen.tsx"), "utf8");
const serverAuth = readFileSync(join(ROOT, "lib/auth-server.ts"), "utf8");
const meRoute = readFileSync(join(ROOT, "app/api/me/route.ts"), "utf8");
const page = readFileSync(join(ROOT, "app/privacidad/page.tsx"), "utf8");
const notice = readFileSync(join(ROOT, "components/privacy-notice.tsx"), "utf8");

assert(/pathname === "\/privacidad"/.test(gate), "AuthGate explicitly recognizes the public privacy route");
assert(/<PrivacyNotice/.test(gate), "signed-out privacy renders without the authenticated data shell");
assert(/<PrivacyNotice/.test(page), "the public and authenticated routes share one notice");
assert(/When your voice is recorded/.test(notice), "shared notice contains the voice-capture disclosure");
assert(/signInWithGoogle/.test(login), "login offers Google authentication");
assert(!/type="email"/.test(login), "login does not expose email/password registration");
assert(!/\bsignUp\b/.test(login), "login cannot create password accounts");
assert(!/isAllowed/.test(serverAuth), "paid routes accept every authenticated learner");
assert(/allowed:\s*true/.test(meRoute), "/api/me admits every authenticated learner");

// ── The instructor cockpit ──────────────────────────────────────────────────
// The route runs for real against a stubbed Supabase, so these are the actual
// authorization branch and the actual response body, not a description of them.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://coach-test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.ADMIN_EMAILS = "profe@clara.test";
process.env.ALLOWED_EMAILS = "profe@clara.test,estudiante@clara.test";

const MARI = "11111111-1111-4111-8111-111111111111";
const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

// Every fixture carries a marker string that must never reach the response:
// old rows, rogue columns, and props a future writer might add.
const tables = {
  profiles: [{ id: MARI, name: "Mariana", email: "SECRET-EMAIL@example.com" }],
  player_stats: [{ profile_id: MARI, xp: 10, stars: 1, current_streak: 1, longest_streak: 2, total_attempts: 4, total_passes: 3, last_active_day: day(0) }],
  settings: [{ profile_id: MARI, onboarding: { level: "B1", path: "job", notes: "SECRET-ONBOARDING" } }],
  progress: [{ profile_id: MARI, category_id: "c1", phoneme: "th", attempts: 3, box: 1, due_at: 1, target: "SECRET-TARGET" }],
  attempts: [{ profile_id: MARI, category_id: "c1", phoneme: "th", passed: false, at: Date.now(), target: "SECRET-TARGET", heard: "SECRET-HEARD" }],
  events: [
    { profile_id: MARI, type: "speaking_attempted", at: Date.now(), day: day(0), props: { passed: false, score: 40, transcript: "SECRET-TRANSCRIPT" } },
    { profile_id: MARI, type: "session_start", at: Date.now(), day: day(0), props: { completedActivities: 0, totalActivities: 6 } },
  ],
  client_errors: [{ at: Date.now(), props: { source: "window", message: "boom", path: "/hoy", frame: "app.js:1", sneaky: "SECRET-DIAGNOSTIC" } }],
};

let authUser = null;
const calls = [];
const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = async (input) => {
  const target = typeof input === "string" ? input : input.url;
  calls.push(target);
  if (target.includes("/auth/v1/user")) {
    return authUser ? jsonResponse(authUser) : jsonResponse({ message: "invalid token" }, 401);
  }
  const table = /\/rest\/v1\/([a-z_]+)/.exec(target)?.[1] ?? "";
  if (table === "events") return jsonResponse(target.includes("client_error") ? tables.client_errors : tables.events);
  return jsonResponse(tables[table] ?? []);
};

const { GET } = await import("../app/api/coach/route.ts");
const coachRequest = (token) =>
  new Request("https://clara.test/api/coach", token ? { headers: { authorization: `Bearer ${token}` } } : undefined);

// 1. No session at all.
calls.length = 0;
authUser = null;
let res = await GET(coachRequest());
assert(res.status === 403, "coach API rejects an unauthenticated request with 403");
assert(calls.every((c) => !c.includes("/rest/v1/")), "an unauthenticated request reads no learner data at all");

// 2. A signed-in learner who is not the teacher.
calls.length = 0;
authUser = { id: MARI, email: "estudiante@clara.test" };
res = await GET(coachRequest("student-token"));
assert(res.status === 403, "coach API rejects a non-admin learner with 403");
assert((await res.json()).error === "forbidden", "the denial says forbidden and nothing else");
assert(calls.every((c) => !c.includes("/rest/v1/")), "a non-admin request never reaches another learner's rows");

// 3. An expired or forged token.
calls.length = 0;
authUser = null;
res = await GET(coachRequest("garbage-token"));
assert(res.status === 403, "coach API rejects an unverifiable token with 403");

// 4. The teacher — the response itself must be bounded.
calls.length = 0;
authUser = { id: "admin-uuid", email: "Profe@Clara.test" }; // case-insensitive allowlist
res = await GET(coachRequest("admin-token"));
assert(res.status === 200, "the admin allowlist still admits the teacher");
const body = await res.json();
const serialized = JSON.stringify(body);

for (const secret of ["SECRET-EMAIL", "SECRET-TRANSCRIPT", "SECRET-HEARD", "SECRET-TARGET", "SECRET-ONBOARDING", "SECRET-DIAGNOSTIC"]) {
  assert(!serialized.includes(secret), `the coach response drops ${secret}`);
}
assert(body.students[0].name === "Mariana", "the roster still names the learner it is about");

const DENIED = ["transcript", "heard", "spoken", "utterance", "voice", "audio", "email", "phrase", "sentence", "said", "recording", "raw", "props", "target"];
const keysOf = (value) =>
  Array.isArray(value)
    ? value.flatMap(keysOf)
    : value && typeof value === "object"
      ? Object.keys(value).concat(Object.values(value).flatMap(keysOf))
      : [];
const offending = keysOf(body).filter((key) => DENIED.some((denied) => key.toLowerCase().includes(denied)));
assert(offending.length === 0, `no response field may carry learner content (found: ${offending.join(", ")})`);

// The privacy guarantee is in the SELECT, not only in the mapping: the columns
// holding what she said are never loaded in the first place.
const attemptQuery = calls.find((c) => c.includes("/rest/v1/attempts")) ?? "";
assert(attemptQuery !== "", "the aggregation reads attempt history");
assert(!/heard|target/.test(decodeURIComponent(attemptQuery)), "the attempts query never selects target or heard");
const profileQuery = calls.find((c) => c.includes("/rest/v1/profiles")) ?? "";
assert(!/email/.test(decodeURIComponent(profileQuery)), "the profiles query never selects an email column");

console.log(`privacy-access: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
