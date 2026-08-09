import assert from "node:assert/strict";
import test from "node:test";

import { createSentryOptions, scrubSentryEvent } from "./observability.ts";

test("observability stays disabled without a DSN", () => {
  assert.equal(createSentryOptions(undefined), undefined);
  assert.equal(createSentryOptions(""), undefined);
});

test("Sentry options disable default PII and scrub every event channel", () => {
  const previousBuildId = process.env.NEXT_PUBLIC_CLARA_BUILD_ID;
  const previousEnvironment = process.env.VERCEL_ENV;
  process.env.NEXT_PUBLIC_CLARA_BUILD_ID = "build-123";
  process.env.VERCEL_ENV = "preview";

  try {
    const options = createSentryOptions("https://public-key@o123.ingest.us.sentry.io/456");

    assert(options);
    assert.equal(options.sendDefaultPii, false);
    assert.equal(options.includeLocalVariables, false);
    assert.equal(options.release, "build-123");
    assert.equal(options.environment, "preview");
    assert.equal(options.tracesSampleRate, 0);
    assert.equal(options.dsn, "https://public-key@o123.ingest.us.sentry.io/456");
    const integrations = options.integrations([
      { name: "Http" },
      { name: "OpenAI" },
      { name: "VercelAI" },
      { name: "Anthropic_AI" },
      { name: "Google_GenAI" },
      { name: "LangChain" },
      { name: "LangGraph" },
    ]);
    assert.deepEqual(integrations, [{ name: "Http" }]);

    const fixture = {
      event_id: "abc123",
      message: "Request failed for learner@example.com",
      user: { id: "student-1", email: "learner@example.com", ip_address: "127.0.0.1" },
      request: {
        url: "https://clara.test/api/assess?email=learner%40example.com&transcript=hello#result",
        method: "POST",
        headers: {
          Authorization: "Bearer private-access-token",
          Cookie: "session=private-cookie",
          "User-Agent": "test-browser",
        },
        cookies: { session: "private-cookie" },
        data: { transcript: "these are the learner's words", audio: "base64-audio" },
        query_string: "email=learner%40example.com&transcript=hello",
      },
      breadcrumbs: [
        {
          category: "ui.click",
          message: "Opened practice",
          data: {
            route: "/practice",
            email: "learner@example.com",
            arguments: ["I sink this learner phrase is private", "session=private-session"],
          },
        },
        {
          category: "voice",
          message: "transcript: these are the learner's words",
          data: { audio: "base64-audio", duration: 2 },
        },
      ],
      contexts: {
        practice: { lesson: "minimal-pairs", transcript: "private learner speech" },
      },
      extra: {
        safeCounter: 3,
        voiceRecording: "private recording",
        nested: { cookie: "session=private-cookie" },
        arguments: {
          spoken: "I sink this learner phrase is private",
          wrapperValue: "session=private-session",
        },
      },
      exception: {
        values: [
          {
            type: "AssessmentError",
            value: "Assessment failed while processing the learner response",
            stacktrace: { frames: [{ filename: "app/api/assess/route.ts", lineno: 42 }] },
          },
        ],
      },
    };

    const scrubbed = options.beforeSend(structuredClone(fixture), {});
    assert(scrubbed);
    assert.equal(scrubbed.message, "[Filtered]");
    assert.equal(scrubbed.user, undefined);
    assert.equal(scrubbed.request.url, "https://clara.test/api/assess");
    assert.deepEqual(scrubbed.request.headers, { "User-Agent": "test-browser" });
    assert.equal(scrubbed.request.cookies, undefined);
    assert.equal(scrubbed.request.data, undefined);
    assert.equal(scrubbed.request.query_string, undefined);
    assert.equal(scrubbed.breadcrumbs[0].message, "[Filtered]");
    assert.deepEqual(scrubbed.breadcrumbs[0].data, { route: "/practice" });
    assert.equal(scrubbed.breadcrumbs[1].message, "[Filtered]");
    assert.deepEqual(scrubbed.breadcrumbs[1].data, { duration: 2 });
    assert.deepEqual(scrubbed.contexts, { practice: { lesson: "minimal-pairs" } });
    assert.deepEqual(scrubbed.extra, { safeCounter: 3, nested: {} });
    assert.equal(scrubbed.exception.values[0].value, "[Filtered]");
    assert.deepEqual(scrubbed.exception.values[0].stacktrace.frames, [
      { filename: "app/api/assess/route.ts", lineno: 42 },
    ]);

    const serialized = JSON.stringify(scrubbed);
    for (const secret of [
      "learner@example.com",
      "private-access-token",
      "private-cookie",
      "learner's words",
      "base64-audio",
      "private learner speech",
      "private recording",
      "learner response",
      "I sink this learner phrase is private",
      "session=private-session",
    ]) {
      assert(!serialized.includes(secret), `scrubbed event leaked: ${secret}`);
    }

    assert.deepEqual(options.beforeSendTransaction(structuredClone(fixture), {}), scrubbed);
  } finally {
    if (previousBuildId === undefined) delete process.env.NEXT_PUBLIC_CLARA_BUILD_ID;
    else process.env.NEXT_PUBLIC_CLARA_BUILD_ID = previousBuildId;
    if (previousEnvironment === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousEnvironment;
  }
});

test("Vercel environment takes precedence over Node production sampling", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.NODE_ENV = "production";

  try {
    process.env.VERCEL_ENV = "preview";
    assert.equal(createSentryOptions("https://public-key@o123.ingest.sentry.io/456").tracesSampleRate, 0);

    process.env.VERCEL_ENV = "development";
    assert.equal(createSentryOptions("https://public-key@o123.ingest.sentry.io/456").tracesSampleRate, 0);

    process.env.VERCEL_ENV = "production";
    assert.equal(createSentryOptions("https://public-key@o123.ingest.sentry.io/456").tracesSampleRate, 0.1);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test("Node production sampling is used only when Vercel environment is absent", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousVercelEnv = process.env.VERCEL_ENV;
  process.env.NODE_ENV = "production";
  delete process.env.VERCEL_ENV;

  try {
    assert.equal(createSentryOptions("https://public-key@o123.ingest.sentry.io/456").tracesSampleRate, 0.1);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
  }
});

test("the standalone scrubber removes sensitive breadcrumb and transaction text", () => {
  const scrubbed = scrubSentryEvent({
    transaction: "GET /student/learner@example.com",
    breadcrumbs: [{ message: "Authorization: Bearer secret-token", data: { safe: true } }],
  });

  assert.equal(scrubbed.transaction, "GET /student/[Filtered email]");
  assert.equal(scrubbed.breadcrumbs[0].message, "[Filtered]");
  assert.deepEqual(scrubbed.breadcrumbs[0].data, { safe: true });
});
