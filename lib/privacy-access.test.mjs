// node lib/privacy-access.test.mjs
// Signed-out learners must be able to read the notice linked from Login.
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
const page = readFileSync(join(ROOT, "app/privacidad/page.tsx"), "utf8");
const notice = readFileSync(join(ROOT, "components/privacy-notice.tsx"), "utf8");

assert(/pathname === "\/privacidad"/.test(gate), "AuthGate explicitly recognizes the public privacy route");
assert(/<PrivacyNotice/.test(gate), "signed-out privacy renders without the authenticated data shell");
assert(/<PrivacyNotice/.test(page), "the public and authenticated routes share one notice");
assert(/When your voice is recorded/.test(notice), "shared notice contains the voice-capture disclosure");

console.log(`privacy-access: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
