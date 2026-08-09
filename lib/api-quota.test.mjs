import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PAID_API_BUDGETS,
  consumePaidApiQuota,
  enforcePaidApiQuota,
} from "./api-quota.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};
const deepEqual = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message);
  checks += 1;
};
const ok = (value, message) => {
  assert.ok(value, message);
  checks += 1;
};

const ROUTES = [
  "assess",
  "call-score",
  "chat",
  "grade",
  "news",
  "transcribe",
  "tts",
  "virtual-call-report",
  "virtual-call-turn",
];
const ROUTE_FILES = {
  assess: ["app/api/assess/route.ts", "const key = process.env.AZURE_SPEECH_KEY"],
  "call-score": ["app/api/call-score/route.ts", "const brain = getChatModel()"],
  chat: ["app/api/chat/route.ts", "const brain = getChatModel()"],
  grade: ["app/api/grade/route.ts", "const brain = getChatModel()"],
  news: ["app/api/news/route.ts", "const apiKey = process.env.OPENAI_API_KEY"],
  transcribe: ["app/api/transcribe/route.ts", "const apiKey = process.env.ELEVENLABS_API_KEY"],
  tts: ["app/api/tts/route.ts", "const apiKey = process.env.ELEVENLABS_API_KEY"],
  "virtual-call-report": ["app/api/virtual-call/report/route.ts", "const raw = await request.text()"],
  "virtual-call-turn": ["app/api/virtual-call/turn/route.ts", "const raw = await request.text()"],
};

deepEqual(Object.keys(PAID_API_BUDGETS).sort(), [...ROUTES].sort(), "all and only paid routes have budgets");
for (const route of ROUTES) {
  const budget = PAID_API_BUDGETS[route];
  ok(Number.isInteger(budget.userPerDay) && budget.userPerDay > 0, `${route} has a positive user/day budget`);
  ok(
    Number.isInteger(budget.globalPerMinute) && budget.globalPerMinute > 0,
    `${route} has a positive global/minute budget`,
  );

  const [path, providerBoundary] = ROUTE_FILES[route];
  const source = readFileSync(join(ROOT, path), "utf8");
  const originAt = source.indexOf("guardApi(request)");
  const authAt = source.indexOf("await requireAllowedUserIdentity(request)");
  const quotaAt = source.indexOf(`await enforcePaidApiQuota({ userId: identity.user.id, route: "${route}" })`);
  const providerAt = source.indexOf(providerBoundary);
  ok(originAt >= 0, `${route} has the exact-origin guard`);
  ok(authAt > originAt, `${route} authenticates after the origin guard`);
  ok(quotaAt > authAt, `${route} consumes durable quota after identity`);
  ok(providerAt > quotaAt, `${route} reaches provider/request work only after quota`);
  equal(source.match(/requireAllowedUserIdentity\(request\)/g)?.length, 1, `${route} authenticates exactly once`);
}

const newsRoute = readFileSync(join(ROOT, "app/api/news/route.ts"), "utf8");
const mediaPage = readFileSync(join(ROOT, "app/media/page.tsx"), "utf8");
ok(newsRoute.includes("export async function POST"), "news uses POST so the browser supplies Origin");
ok(!newsRoute.includes("export async function GET"), "news has no origin-less paid GET path");
ok(mediaPage.includes('fetch("/api/news", { method: "POST", headers })'), "the media client uses the guarded news POST");
ok(
  newsRoute.indexOf("if (cache &&") < newsRoute.indexOf("await fetch(FEED"),
  "a warm news cache still avoids the upstream feed and model path",
);

const saved = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
const originalFetch = globalThis.fetch;
const userId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-08-08T12:34:56.000Z");
const rpcCalls = [];

try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://quota-test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "quota-test-service-role";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "must-never-be-used";

  const queued = [];
  globalThis.fetch = async (input, init) => {
    rpcCalls.push({ url: typeof input === "string" ? input : input.url, init });
    const next = queued.shift();
    if (!next) throw new Error("unexpected quota RPC");
    return Response.json(next.body, { status: next.status ?? 200 });
  };

  queued.push({ body: [{ allowed: true, scope: null, retry_after_seconds: null }] });
  let decision = await consumePaidApiQuota({ userId, route: "assess", now });
  deepEqual(decision, { allowed: true }, "the boundary decision succeeds");
  equal(rpcCalls.length, 1, "one decision makes one atomic RPC");
  ok(rpcCalls[0].url.endsWith("/rest/v1/rpc/consume_paid_api_quota"), "quota uses the bounded RPC");
  equal(
    new Headers(rpcCalls[0].init.headers).get("authorization"),
    "Bearer quota-test-service-role",
    "quota RPC uses only service role",
  );
  ok(!JSON.stringify(rpcCalls[0]).includes("must-never-be-used"), "quota never falls back to the anon key");
  deepEqual(
    JSON.parse(rpcCalls[0].init.body),
    {
      p_user_id: userId,
      p_route: "assess",
      p_user_day_limit: PAID_API_BUDGETS.assess.userPerDay,
      p_global_minute_limit: PAID_API_BUDGETS.assess.globalPerMinute,
      p_now: now.toISOString(),
    },
    "quota RPC receives only bounded identity, route, limits, and time",
  );

  queued.push({ body: [{ allowed: false, scope: "user-day", retry_after_seconds: 41_704 }] });
  decision = await consumePaidApiQuota({ userId, route: "assess", now });
  deepEqual(
    decision,
    { allowed: false, scope: "user-day", retryAfterSeconds: 41_704 },
    "the request after the daily boundary is denied with reset time",
  );
  queued.push({ body: [{ allowed: false, scope: "global-minute", retry_after_seconds: 4 }] });
  let response = await enforcePaidApiQuota({ userId, route: "assess", now });
  equal(response?.status, 429, "an exhausted global window returns 429");
  equal(response?.headers.get("retry-after"), "4", "quota denial includes integer Retry-After");
  deepEqual(await response?.json(), { error: "rate_limited" }, "quota denial has the stable body");

  queued.push({ body: [{ allowed: true, scope: null, retry_after_seconds: null }] });
  response = await enforcePaidApiQuota({ userId, route: "assess", now: new Date("2026-08-09T00:00:00Z") });
  equal(response, null, "a new daily window can proceed");
  queued.push({ body: [{ allowed: true, scope: null, retry_after_seconds: null }] });
  response = await enforcePaidApiQuota({ userId, route: "assess", now: new Date("2026-08-08T12:35:00Z") });
  equal(response, null, "a new minute window can proceed");

  queued.push({ body: { message: "database detail must not leak" }, status: 500 });
  response = await enforcePaidApiQuota({ userId, route: "assess", now });
  equal(response?.status, 503, "an RPC failure fails closed");
  deepEqual(await response?.json(), { error: "quota_unavailable" }, "RPC detail is not leaked");

  queued.push({ body: [{ allowed: "yes", scope: "user-day", retry_after_seconds: -1 }] });
  response = await enforcePaidApiQuota({ userId, route: "assess", now });
  equal(response?.status, 503, "a malformed RPC decision fails closed");

  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  response = await enforcePaidApiQuota({ userId, route: "assess", now });
  equal(response?.status, 503, "a missing service key fails closed without anon fallback");
  process.env.SUPABASE_SERVICE_ROLE_KEY = "quota-test-service-role";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  response = await enforcePaidApiQuota({ userId, route: "assess", now });
  equal(response?.status, 503, "a missing Supabase URL fails closed");
} finally {
  globalThis.fetch = originalFetch;
  for (const [name, value] of [
    ["NEXT_PUBLIC_SUPABASE_URL", saved.url],
    ["SUPABASE_SERVICE_ROLE_KEY", saved.serviceKey],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", saved.anonKey],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

const migration = readFileSync(join(ROOT, "supabase/migration-v6-api-quotas.sql"), "utf8").toLowerCase();
const normalizedSql = migration.replace(/\s+/g, " ");
ok(migration.includes("private.api_usage_windows"), "quota rows live in the private schema");
ok(migration.includes("security definer") && migration.includes("set search_path = ''"), "definer RPC pins an empty search path");
for (const role of ["public", "anon", "authenticated"]) {
  ok(
    new RegExp(`revoke execute on function public\\.consume_paid_api_quota\\([^;]+ from ${role}`).test(normalizedSql),
    `${role} cannot execute the quota RPC`,
  );
}
ok(
  /grant execute on function public\.consume_paid_api_quota\([^;]+ to service_role/.test(normalizedSql),
  "only service_role is granted quota execution",
);
ok(migration.includes("pg_advisory_xact_lock"), "quota consumption serializes concurrent contenders");
ok(
  migration.match(/extract\(epoch from v_(?:global|user)_start\)/g)?.length === 2,
  "lock identities are timezone-independent window instants",
);
const firstLock = migration.indexOf("pg_advisory_xact_lock");
const firstRead = migration.indexOf("select request_count");
const exhaustedCheck = migration.indexOf("if v_user_count >=");
const firstInsert = migration.indexOf("insert into private.api_usage_windows");
ok(firstLock >= 0 && firstLock < firstRead, "locks are acquired before counters are read");
ok(firstRead >= 0 && firstRead < exhaustedCheck, "both counters are read before exhaustion is decided");
ok(exhaustedCheck >= 0 && exhaustedCheck < firstInsert, "neither counter increments before both scopes pass");
ok(
  migration.match(/pg_advisory_xact_lock/g)?.length === 2,
  "global then user locks cover both windows in one transaction",
);
for (const forbidden of ["email", "transcript", "audio", "prompt", "cookie", "authorization", "token", "ip_address"]) {
  ok(!migration.includes(forbidden), `quota storage never names sensitive ${forbidden} data`);
}
ok(migration.includes("expires_at") && migration.includes("api_usage_windows_expiry_idx"), "expired rows have a maintenance index");

console.log(`api-quota: ${checks} ok, 0 failed`);
