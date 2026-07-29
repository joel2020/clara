// node lib/pwa-update.test.mjs
//
// A newly deployed service worker may replace the controller while an older
// Clara tab is still open. Safe hub pages may reload immediately so they stop
// running stale UI, but an active learning flow must never be interrupted.
import { canReloadForAppUpdate, serviceWorkerUrl } from "./pwa-update.ts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let ok = 0;
let fail = 0;
const assert = (condition, message) => {
  if (condition) ok++;
  else {
    fail++;
    console.log("FAIL", message);
  }
};

for (const path of ["/", "/map", "/shop", "/profile", "/settings", "/today"]) {
  assert(canReloadForAppUpdate(path), `${path} may refresh for a new deployment`);
}

for (const path of [
  "/lesson/introductions",
  "/play",
  "/talk",
  "/call",
  "/exam",
  "/listen",
  "/shadow",
  "/duet",
  "/build",
]) {
  assert(!canReloadForAppUpdate(path), `${path} preserves in-progress learner work`);
}

assert(serviceWorkerUrl("abc123") === "/sw.js?v=abc123",
  "the service worker URL changes with the production build");
assert(serviceWorkerUrl(undefined) === "/sw.js?v=local",
  "local builds use a stable service worker URL");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const registerSource = readFileSync(join(ROOT, "components/pwa-register.tsx"), "utf8");
assert(/controllerchange/.test(registerSource),
  "the app reacts when a new service worker takes control");
assert(/update\(\)/.test(registerSource),
  "the app explicitly checks for a fresh deployment");
assert(/canReloadForAppUpdate/.test(registerSource),
  "automatic reloads are limited to safe routes");
assert(/sessionStorage/.test(registerSource),
  "an update deferred during practice remains pending");

console.log(`pwa-update: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
