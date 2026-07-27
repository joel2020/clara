// node lib/paths.test.mjs
// Dependency-free on purpose, so this runs without tsx.
//
// The default is the whole point: Mariana and Valentina have stored profiles from
// before paths existed, and they must land on the general track rather than being
// silently placed on a call-centre curriculum they never asked for.
import { pathOf } from "./paths.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", a, "want", b); } };

eq(pathOf(undefined), "general", "no profile defaults to general");
eq(pathOf(null), "general", "null profile defaults to general");
eq(pathOf({}), "general", "profile without a path defaults to general");
eq(pathOf({ path: undefined }), "general", "explicit undefined defaults to general");
eq(pathOf({ path: "job" }), "job", "an explicit job path is respected");
eq(pathOf({ path: "general" }), "general", "an explicit general path is respected");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
