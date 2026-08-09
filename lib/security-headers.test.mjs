import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../next.config.ts";
import { config as proxyConfig, proxy } from "../proxy.ts";
import { buildContentSecurityPolicy, SECURITY_HEADERS } from "./security-headers.ts";

function parseCsp(value) {
  const entries = value
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(/\s+/));
  const directives = new Map();

  for (const [name, ...sources] of entries) {
    assert(!directives.has(name), `duplicate CSP directive: ${name}`);
    directives.set(name, sources);
  }

  return directives;
}

test("exports the exact static browser security headers", () => {
  const headers = new Map(SECURITY_HEADERS.map(({ key, value }) => [key, value]));

  assert.equal(headers.size, SECURITY_HEADERS.length, "header names must be unique");
  assert.deepEqual([...headers.keys()], [
    "Referrer-Policy",
    "Permissions-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
  ]);
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(headers.get("Permissions-Policy"), "microphone=(self), camera=(), geolocation=()");
  assert.equal(headers.get("Strict-Transport-Security"), "max-age=63072000");
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
});

test("production CSP has unique directives, exact sources, and a request nonce", () => {
  const directives = parseCsp(
    buildContentSecurityPolicy({
      nonce: "request-nonce",
      supabaseUrl: "https://project-ref.supabase.co/",
      isDevelopment: false,
    }),
  );

  assert.deepEqual(Object.fromEntries(directives), {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'nonce-request-nonce'", "'strict-dynamic'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://img.youtube.com"],
    "media-src": ["'self'", "blob:"],
    "font-src": ["'self'", "data:"],
    "worker-src": ["'self'"],
    "connect-src": ["'self'", "https://project-ref.supabase.co", "wss://project-ref.supabase.co"],
    "frame-src": ["https://www.youtube-nocookie.com"],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  });

  const scriptSources = directives.get("script-src");
  for (const forbidden of ["'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'"]) {
    assert(!scriptSources.includes(forbidden), `production script-src contains ${forbidden}`);
  }
  for (const sources of directives.values()) {
    for (const forbidden of ["*", "http:", "https:", "ws:", "wss:"]) {
      assert(!sources.includes(forbidden), `CSP contains broad network source ${forbidden}`);
    }
  }
});

test("Supabase sources are omitted unless the configured URL is a strict HTTPS origin", () => {
  for (const supabaseUrl of [
    undefined,
    "",
    "not a URL",
    "http://project-ref.supabase.co",
    "https://user:secret@project-ref.supabase.co",
    "https://project-ref.supabase.co/rest/v1",
    "https://project-ref.supabase.co/?query=1",
    "https://project-ref.supabase.co/#fragment",
  ]) {
    const directives = parseCsp(
      buildContentSecurityPolicy({ nonce: "request-nonce", supabaseUrl, isDevelopment: false }),
    );
    assert.deepEqual(directives.get("connect-src"), ["'self'"], `accepted invalid URL: ${supabaseUrl}`);
  }
});

test("Sentry ingestion is allowed only for an exact validated HTTPS DSN origin", () => {
  const directives = parseCsp(
    buildContentSecurityPolicy({
      nonce: "request-nonce",
      sentryDsn: "https://public-key@o123.ingest.us.sentry.io/456",
      isDevelopment: false,
    }),
  );
  assert.deepEqual(directives.get("connect-src"), ["'self'", "https://o123.ingest.us.sentry.io"]);

  for (const sentryDsn of [
    undefined,
    "",
    "http://public-key@o123.ingest.sentry.io/456",
    "https://o123.ingest.sentry.io/456",
    "https://public-key:password@o123.ingest.sentry.io/456",
    "https://public-key@evil.example/456",
    "https://public-key@o123.ingest.sentry.io/not-a-project",
    "https://public-key@o123.ingest.sentry.io/456?query=1",
  ]) {
    const invalidDirectives = parseCsp(
      buildContentSecurityPolicy({ nonce: "request-nonce", sentryDsn, isDevelopment: false }),
    );
    assert.deepEqual(
      invalidDirectives.get("connect-src"),
      ["'self'"],
      `accepted invalid Sentry DSN: ${sentryDsn}`,
    );
  }
});

test("development eval compatibility never adds inline or WebAssembly script execution", () => {
  const scriptSources = parseCsp(
    buildContentSecurityPolicy({ nonce: "request-nonce", isDevelopment: true }),
  ).get("script-src");

  assert.deepEqual(scriptSources, ["'self'", "'nonce-request-nonce'", "'strict-dynamic'", "'unsafe-eval'"]);
  assert(!scriptSources.includes("'unsafe-inline'"));
  assert(!scriptSources.includes("'wasm-unsafe-eval'"));
});

test("CSP rejects a nonce that could inject another directive", () => {
  assert.throws(
    () => buildContentSecurityPolicy({ nonce: "valid'; connect-src *", isDevelopment: false }),
    /invalid CSP nonce/i,
  );
});

test("proxy forwards one nonce-bearing CSP to Next rendering and the browser", () => {
  const savedSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://configured-project.supabase.co";

  try {
    const response = proxy(new Request("https://clara.test/talk"));
    const csp = response.headers.get("content-security-policy");
    const scriptSources = parseCsp(csp).get("script-src");
    const nonceSource = scriptSources.find((source) => source.startsWith("'nonce-"));
    const nonce = nonceSource?.slice(7, -1);

    assert.match(nonce ?? "", /^[A-Za-z0-9+/]+={0,2}$/);
    assert.equal(response.headers.get("x-middleware-request-x-nonce"), nonce);
    assert.equal(response.headers.get("x-middleware-request-content-security-policy"), csp);
    assert.match(response.headers.get("x-middleware-override-headers") ?? "", /(^|,)x-nonce(,|$)/);
    assert.match(response.headers.get("x-middleware-override-headers") ?? "", /(^|,)content-security-policy(,|$)/);
  } finally {
    if (savedSupabaseUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = savedSupabaseUrl;
  }
});

test("proxy matcher includes dotted HTML routes and excludes APIs and static files", () => {
  const entry = proxyConfig.matcher[0];
  const matcher = new RegExp(`^${entry.source}$`);

  for (const path of [
    "/",
    "/talk",
    "/lesson/one",
    "/lesson/conv.work",
    "/lesson/foo.js",
    "/lesson/poster.png",
    "/practice/v1.2/review",
    "/styles/app.css",
    "/video/scene.webm",
    "/apiary",
    "/_nextish",
  ]) {
    assert(matcher.test(path), `missed HTML route: ${path}`);
  }
  for (const path of [
    "/api/chat",
    "/_next/static/chunk.js",
    "/_next/image",
    "/sw.js",
    "/manifest.webmanifest",
    "/favicon.ico",
    "/icon-192.png",
    "/audio/example.mp3",
    "/avatars/example.webp",
    "/character/lumi.png",
    "/pets/pandora.png",
    "/scenes/loop-work-9x16.webm",
  ]) {
    assert(!matcher.test(path), `matched non-HTML route: ${path}`);
  }
});

test("Next.js applies the centralized static headers without a fixed CSP", async () => {
  // Node 24 + tsx may preserve an extra default layer for next.config.ts when
  // the importing test is native ESM; bare Node's strip-types loader does not.
  const resolvedConfig = nextConfig.default ?? nextConfig;
  assert.equal(typeof resolvedConfig.headers, "function");
  assert.deepEqual(await resolvedConfig.headers(), [{ source: "/(.*)", headers: SECURITY_HEADERS }]);
  assert(!SECURITY_HEADERS.some(({ key }) => key === "Content-Security-Policy"));
});
