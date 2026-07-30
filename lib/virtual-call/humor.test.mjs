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

// Joel's bank is entirely unapproved today, so asking for him must not leak one.
const joelDrafts = HUMOR_BANK.filter((r) => r.speaker === "joel");
check(joelDrafts.length > 0, "there are Joel candidate lines waiting for approval");
check(joelDrafts.every((r) => r.approval === "draft"), "every Joel line is still a draft");
for (let i = 0; i < 40; i++) {
  const r = selectCallHumor(input({ preferJoel: true, sessionId: `j-${i}`, day: "2026-07-3" + (i % 10) }));
  check(!r || r.speaker !== "joel", "preferring Joel never yields an unapproved Joel line");
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
