import assert from "node:assert/strict";

import { guardApi } from "./api-guard.ts";

let checks = 0;
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

function request(url, origin, ip = crypto.randomUUID()) {
  return new Request(url, {
    method: "POST",
    headers: {
      ...(origin ? { origin } : {}),
      "x-forwarded-for": ip,
    },
  });
}

let response = guardApi(request("https://clara.test/api/chat", null));
equal(response?.status, 403, "missing Origin is denied");
equal((await response?.json()).error, "forbidden", "origin denial uses the stable response");

response = guardApi(request("https://clara.test/api/chat", "https://evil.test"));
equal(response?.status, 403, "a foreign origin is denied");

response = guardApi(request("https://clara.test/api/chat", "https://clara.test.evil.test"));
equal(response?.status, 403, "a hostname-prefix attack is denied");

response = guardApi(request("https://clara.test/api/chat", "http://clara.test"));
equal(response?.status, 403, "same host on another scheme is not the same origin");

response = guardApi(request("https://clara.test/api/chat", "https://clara.test"));
equal(response, null, "an exact production origin proceeds");

response = guardApi(request("http://localhost:3000/api/chat", "http://localhost:3000"));
equal(response, null, "an exact localhost development origin proceeds");

response = guardApi(request("https://clara.test/api/chat", "http://localhost:3000"));
equal(response?.status, 403, "localhost never bypasses a production origin");

const classroomIp = "203.0.113.42";
const paidPaths = [
  "/api/assess",
  "/api/chat",
  "/api/transcribe",
  "/api/tts",
  "/api/virtual-call/turn",
];
for (let n = 0; n < 200; n += 1) {
  equal(
    guardApi(
      request(`https://clara.test${paidPaths[n % paidPaths.length]}`, "https://clara.test", classroomIp),
    ),
    null,
    `shared-classroom request ${n + 1} is never denied by a cross-user IP bucket`,
  );
}

console.log(`api-guard: ${checks} ok, 0 failed`);
