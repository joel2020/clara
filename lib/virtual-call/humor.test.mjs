// Call humor rules: success only, honors the learner's setting, capped per call,
// and never puts an unapproved line in Joel's mouth.

import { MAX_REACTIONS_PER_CALL, selectCallHumor } from "./humor.ts";
import { HUMOR_BANK } from "../content/humor.ts";

let ok = 0, fail = 0;
const check = (c, m) => { if (c) ok++; else { fail++; console.log("FAIL", m); } };

const input = (over = {}) => ({
  event: "call-complete",
  level: "full",
  day: "2026-07-30",
  sessionId: "call-1",
  lastStrongReactionAt: null,
  shownThisCall: 0,
  succeeded: true,
  ...over,
});

check(selectCallHumor(input({ level: "off" })) === null, "humor off selects nothing at all");
check(selectCallHumor(input({ succeeded: false })) === null,
  "no reaction after a call that did not go well — a celebration there reads as not listening");
check(selectCallHumor(input({ succeeded: false, event: "retry-accepted" })) === null,
  "and none after a failed moment mid-call either");
check(selectCallHumor(input({ shownThisCall: MAX_REACTIONS_PER_CALL })) === null, "the per-call cap is enforced");
check(selectCallHumor(input({ level: "light", event: "retry-accepted" })) === null,
  "light humor does not react mid-call");
check(selectCallHumor(input({ level: "light", shownThisCall: 1 })) === null,
  "light humor allows at most one reaction per call");

// Determinism: same call, same moment, same answer.
const a = selectCallHumor(input());
const b = selectCallHumor(input());
check(JSON.stringify(a) === JSON.stringify(b), "selection is deterministic for the same call and moment");

// Whatever comes back must be releasable and must never target the learner.
for (const level of ["light", "full"]) {
  for (const event of ["retry-accepted", "call-complete"]) {
    for (let i = 0; i < 40; i++) {
      const r = selectCallHumor(input({ level, event, sessionId: `call-${i}`, day: "2026-07-3" + (i % 10) }));
      if (!r) continue;
      check(r.approval === "reviewed" || r.approval === "joel-approved",
        "only releasable copy is ever returned");
      check(r.approval !== "draft", "a draft line is never returned");
      check(["situation", "self", "culture"].includes(r.target),
        "a reaction never targets the learner");
      if (r.slang) check(Boolean(r.slang.meaning && r.slang.register),
        "slang carries a plain-Spanish meaning and a register note");
    }
  }
}

// Joel approved his lines, so his voice may now be chosen on a call. What must
// still hold is that an unapproved line can never be: the per-line gate is what
// makes it safe to draft a new one straight into this file.
const joelLines = HUMOR_BANK.filter((r) => r.speaker === "joel");
check(joelLines.length > 0, "Joel has lines in the bank");
const draftIds = new Set(joelLines.filter((r) => r.approval === "draft").map((r) => r.id));
for (let i = 0; i < 40; i++) {
  const r = selectCallHumor(input({ preferJoel: true, sessionId: `j-${i}`, day: "2026-07-3" + (i % 10) }));
  check(!r || !draftIds.has(r.id), "a draft Joel line is never returned to a learner");
  check(!r || r.speaker !== "joel" || r.approval === "joel-approved",
    "any Joel line that renders is one he approved");
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
