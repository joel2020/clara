// Runs the whole unit suite and reports a total.
//
// Two runners are needed and it is not arbitrary: files importing through the "@/"
// alias need tsx to resolve it, while the alias-free ones run under bare node — and
// keeping those runnable under plain node is deliberate, because lib/onboarding.ts
// and lib/paths.ts must not acquire alias-dependent imports.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function findTests(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findTests(p));
    else if (entry.name.endsWith(".test.mjs")) out.push(p);
  }
  return out;
}

const tests = findTests("lib").sort();
if (tests.length === 0) {
  console.error("no test files found");
  process.exit(1);
}

let total = 0;
let failedFiles = 0;

for (const file of tests) {
  // Pick the runner from the file's own imports rather than a hardcoded list.
  const src = readFileSync(file, "utf8");
  const needsAlias = /from\s+["']@\//.test(src) || /["']\.\.?\/[^"']*\.ts["']/.test(src);
  const runner = needsAlias ? ["npx", ["tsx", file]] : ["node", [file]];

  let out = "";
  let ok = true;
  try {
    out = execFileSync(runner[0], runner[1], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    ok = false;
    out = (e.stdout ?? "") + (e.stderr ?? "");
  }

  const m = out.match(/(\d+) ok/);
  const n = m ? Number(m[1]) : 0;
  total += n;
  if (!ok) failedFiles += 1;

  const label = file.padEnd(34);
  if (ok) {
    console.log(`  PASS  ${label} ${n} checks`);
  } else {
    console.log(`  FAIL  ${label}`);
    console.log(
      out
        .split("\n")
        .filter((l) => l.startsWith("FAIL") || /failed/.test(l))
        .map((l) => `          ${l}`)
        .join("\n"),
    );
  }
}

console.log(`\n${tests.length} files, ${total} checks, ${failedFiles} file(s) failing`);
process.exit(failedFiles ? 1 : 0);
