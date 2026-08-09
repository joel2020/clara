import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const savedEnv = {
  adminEmails: process.env.ADMIN_EMAILS,
  allowedEmails: process.env.ALLOWED_EMAILS,
  nodeEnv: process.env.NODE_ENV,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
};
const originalFetch = globalThis.fetch;

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "content-type": "application/json" } });
const requestWithToken = (path, token) =>
  new Request(`https://clara.test${path}`, token ? { headers: { authorization: `Bearer ${token}` } } : undefined);
const student = {
  id: "student-id",
  email: "student@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-08-08T00:00:00.000Z",
};
const stranger = { ...student, id: "stranger-id", email: "stranger@example.com" };
const admin = {
  ...student,
  id: "admin-id",
  email: "teacher@example.com",
  app_metadata: { clara_role: "admin" },
};
const legacyEmailAdmin = {
  ...student,
  id: "legacy-email-admin-id",
  email: "teacher@example.com",
  app_metadata: {},
};
const userMetadataAdmin = {
  ...student,
  id: "user-metadata-admin-id",
  email: "metadata-admin@example.com",
  app_metadata: {},
  user_metadata: { clara_role: "admin" },
};

try {
  process.env.NODE_ENV = "production";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missingAuth = await import(`./auth-server.ts?missing-auth=${Date.now()}`);
  let response = await missingAuth.requireAllowedUser(requestWithToken("/api/chat", "unused-token"));
  equal(response?.status, 503, "production without Supabase auth fails closed");
  deepEqual(await response?.json(), { error: "auth_not_configured" }, "missing production auth has a stable error");

  process.env.ALLOWED_EMAILS = "student@example.com";
  process.env.ADMIN_EMAILS = "teacher@example.com";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://access-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-vapid-public-key";
  process.env.VAPID_PRIVATE_KEY = "test-vapid-private-key";

  const authResponses = [];
  const restRequests = [];
  globalThis.fetch = async (input, init) => {
    const target = typeof input === "string" ? input : input.url;
    if (target.includes("/auth/v1/user")) {
      const user = authResponses.shift();
      return user ? json(user) : json({ message: "invalid token" }, 401);
    }
    if (target.includes("/rest/v1/")) {
      restRequests.push({ target, init });
      return json([]);
    }
    throw new Error(`Unexpected fetch in auth access test: ${target}`);
  };
  const authenticateAs = (...users) => authResponses.push(...users);

  const { accessFlags, isAllowed } = await import("./allowlist.ts");
  const configuredAuth = await import(`./auth-server.ts?configured-auth=${Date.now()}`);

  equal(isAllowed("student@example.com"), true, "an invited learner is allowed");
  equal(isAllowed("stranger@example.com"), false, "an uninvited learner is denied");
  equal(accessFlags(stranger).allowed, false, "identity flags deny an uninvited learner");
  equal(accessFlags(admin).admin, true, "identity flags recognize the Supabase admin claim");

  delete process.env.ALLOWED_EMAILS;
  equal(
    accessFlags(student).allowed,
    false,
    "production without ALLOWED_EMAILS denies every non-admin identity",
  );
  process.env.ALLOWED_EMAILS = "student@example.com";

  response = await configuredAuth.requireAllowedUser(requestWithToken("/api/chat"));
  equal(response?.status, 401, "a missing token is unauthorized");

  response = await configuredAuth.requireAllowedUser(requestWithToken("/api/chat", "invalid-token"));
  equal(response?.status, 401, "an invalid token is unauthorized");

  authenticateAs(stranger);
  response = await configuredAuth.requireAllowedUser(requestWithToken("/api/chat", "stranger-token"));
  equal(response?.status, 403, "a valid uninvited session is forbidden");
  deepEqual(await response?.json(), { error: "not_allowed" }, "an uninvited session gets the stable denial");

  authenticateAs(student);
  response = await configuredAuth.requireAllowedUser(requestWithToken("/api/chat", "student-token"));
  equal(response, null, "an invited learner may proceed");

  authenticateAs(student);
  const allowedIdentity = await configuredAuth.requireAllowedUserIdentity(
    requestWithToken("/api/chat", "student-token"),
  );
  equal("user" in allowedIdentity ? allowedIdentity.user.id : null, student.id, "the paid guard returns the verified UUID");

  authenticateAs(admin);
  response = await configuredAuth.requireAllowedUser(requestWithToken("/api/chat", "admin-token"));
  equal(response, null, "an admin claim may proceed without an allowlist entry");

  const me = await import("../app/api/me/route.ts");
  authenticateAs(student);
  response = await me.GET(requestWithToken("/api/me", "student-token"));
  deepEqual(
    await response.json(),
    { authed: true, allowed: true, admin: false },
    "/api/me admits the same invited learner as the paid-route guard",
  );
  authenticateAs(stranger);
  response = await me.GET(requestWithToken("/api/me", "stranger-token"));
  deepEqual(
    await response.json(),
    { authed: true, allowed: false, admin: false },
    "/api/me denies the same stranger as the paid-route guard",
  );
  authenticateAs(admin);
  response = await me.GET(requestWithToken("/api/me", "admin-token"));
  deepEqual(
    await response.json(),
    { authed: true, allowed: true, admin: true },
    "/api/me reports the same admin override as the paid-route guard",
  );

  const health = await import("../app/api/health/route.ts");
  authenticateAs(legacyEmailAdmin);
  response = await health.GET(requestWithToken("/api/health", "legacy-admin-token"));
  equal(response.status, 403, "/api/health denies the retired admin email without app_metadata");
  authenticateAs(userMetadataAdmin);
  response = await health.GET(requestWithToken("/api/health", "user-metadata-admin-token"));
  equal(response.status, 403, "/api/health never trusts user_metadata for administrator access");
  authenticateAs(admin);
  response = await health.GET(requestWithToken("/api/health", "admin-token"));
  equal(response.status, 200, "/api/health authorizes the server-validated app_metadata admin claim");

  const coach = await import("../app/api/coach/route.ts");
  authenticateAs(legacyEmailAdmin);
  response = await coach.GET(requestWithToken("/api/coach", "legacy-admin-token"));
  equal(response.status, 403, "/api/coach denies the retired admin email without app_metadata");
  authenticateAs(userMetadataAdmin);
  response = await coach.GET(requestWithToken("/api/coach", "user-metadata-admin-token"));
  equal(response.status, 403, "/api/coach never trusts user_metadata for administrator access");
  authenticateAs(admin);
  response = await coach.GET(requestWithToken("/api/coach", "admin-token"));
  equal(response.status, 200, "/api/coach authorizes the server-validated app_metadata admin claim");

  const paidRoutes = [
    ["app/api/assess/route.ts", "const key = process.env.AZURE_SPEECH_KEY"],
    ["app/api/call-score/route.ts", "const brain = getChatModel()"],
    ["app/api/chat/route.ts", "const brain = getChatModel()"],
    ["app/api/grade/route.ts", "const brain = getChatModel()"],
    ["app/api/news/route.ts", "const apiKey = process.env.OPENAI_API_KEY"],
    ["app/api/transcribe/route.ts", "const apiKey = process.env.ELEVENLABS_API_KEY"],
    ["app/api/tts/route.ts", "const apiKey = process.env.ELEVENLABS_API_KEY"],
    ["app/api/virtual-call/report/route.ts", "const raw = await request.text()"],
    ["app/api/virtual-call/turn/route.ts", "const raw = await request.text()"],
  ];
  for (const [path, paidBoundary] of paidRoutes) {
    const source = readFileSync(join(ROOT, path), "utf8");
    const accessAt = source.indexOf("await requireAllowedUserIdentity(request)");
    const paidWorkAt = source.indexOf(paidBoundary);
    ok(accessAt >= 0, `${path} uses the shared invited-user identity guard`);
    ok(paidWorkAt >= 0 && accessAt < paidWorkAt, `${path} authorizes before provider or request work`);
    const originGuardAt = source.indexOf("guardApi(request)");
    ok(originGuardAt >= 0 && originGuardAt < accessAt, `${path} runs the cheap origin guard before auth`);
  }

  const push = await import("../app/api/push/route.ts");
  const pushRequest = (method, body, token = "student-token") =>
    new Request("https://clara.test/api/push", {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        host: "clara.test",
        origin: "https://clara.test",
      },
      body: JSON.stringify(body),
    });

  restRequests.length = 0;
  authenticateAs(student, null);
  response = await push.POST(
    pushRequest("POST", { subscription: { endpoint: "https://push.test/student" }, lang: "en" }),
  );
  equal(response.status, 401, "push POST fails closed when its ownership identity lookup fails");
  equal(restRequests.length, 0, "failed POST ownership lookup performs no database write");

  restRequests.length = 0;
  authenticateAs(student, null);
  response = await push.DELETE(pushRequest("DELETE", { endpoint: "https://push.test/student" }));
  equal(response.status, 401, "push DELETE fails closed when its ownership identity lookup fails");
  equal(restRequests.length, 0, "failed DELETE ownership lookup performs no database delete");

  restRequests.length = 0;
  authenticateAs(student, student);
  response = await push.POST(
    pushRequest("POST", { subscription: { endpoint: "https://push.test/student" }, lang: "en" }),
  );
  equal(response.status, 200, "an invited learner can store a push subscription");
  equal(restRequests.length, 1, "successful push POST performs one database write");
  const posted = JSON.parse(restRequests[0].init.body);
  equal(posted.profile_id, student.id, "push POST always binds the row to the authenticated owner");

  restRequests.length = 0;
  authenticateAs(student, student);
  response = await push.DELETE(pushRequest("DELETE", { endpoint: "https://push.test/student" }));
  equal(response.status, 200, "an invited learner can delete their push subscription");
  equal(restRequests.length, 1, "successful push DELETE performs one database delete");
  const deleteQuery = decodeURIComponent(restRequests[0].target);
  ok(deleteQuery.includes(`profile_id=eq.${student.id}`), "push DELETE always filters by authenticated owner");
  ok(!deleteQuery.includes("profile_id.is.null"), "push DELETE never broadens ownership to unclaimed rows");

  console.log(`auth-access: ${checks} ok, 0 failed`);
} finally {
  const restore = (name, value) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("ALLOWED_EMAILS", savedEnv.allowedEmails);
  restore("ADMIN_EMAILS", savedEnv.adminEmails);
  restore("NODE_ENV", savedEnv.nodeEnv);
  restore("NEXT_PUBLIC_SUPABASE_URL", savedEnv.supabaseUrl);
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY", savedEnv.supabaseAnonKey);
  restore("SUPABASE_SERVICE_ROLE_KEY", savedEnv.serviceRoleKey);
  restore("NEXT_PUBLIC_VAPID_PUBLIC_KEY", savedEnv.vapidPublicKey);
  restore("VAPID_PRIVATE_KEY", savedEnv.vapidPrivateKey);
  globalThis.fetch = originalFetch;
}
