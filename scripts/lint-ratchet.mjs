// Lint ratchet.
//
// The repo carries a known set of React-Compiler-era advisories
// (react-hooks/set-state-in-effect, purity, immutability) in files where fixing them
// means restructuring working, hard-to-test UI — the WebGL character, the practice
// panel, the onboarding flow. They have been reviewed and are not live defects.
//
// Two bad options were rejected: failing CI on them (so CI is permanently red and
// everyone learns to ignore it), and not running lint in CI at all (so the count
// quietly grows forever). This ratchet does the useful thing instead: new errors fail
// the build, existing ones do not.
//
// When you fix some, LOWER the baseline in the same commit. It should only ever go
// down.
import { execFileSync } from "node:child_process";

const BASELINE = 11;

let out = "";
try {
  out = execFileSync("npx", ["eslint", "-f", "json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
} catch (e) {
  // eslint exits non-zero when there are errors; the JSON is still on stdout.
  out = e.stdout ?? "";
}
if (!out.trim()) {
  console.error("lint-ratchet: eslint produced no output");
  process.exit(1);
}

const results = JSON.parse(out);
const errors = [];
for (const file of results) {
  for (const m of file.messages) {
    if (m.severity === 2) {
      errors.push(`${file.filePath.replace(process.cwd() + "/", "")}:${m.line}:${m.column}  ${m.ruleId}`);
    }
  }
}

const count = errors.length;
console.log(`lint-ratchet: ${count} error(s), baseline ${BASELINE}`);

if (count > BASELINE) {
  console.error(`\nNEW LINT ERRORS (${count} > ${BASELINE}). Fix these, or justify and raise the baseline:\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

if (count < BASELINE) {
  console.log(`\nNice — ${BASELINE - count} fewer than the baseline.`);
  console.log(`Lower BASELINE in scripts/lint-ratchet.mjs to ${count} to lock the improvement in.`);
  // Not a failure: an improvement should never block a push.
}

process.exit(0);
