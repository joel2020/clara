// npx tsx lib/humor.test.mjs
//
// The safety rules matter more than the jokes: humor must never appear in
// restricted moments, Joel's voice must never speak an unapproved line, the
// bank must never target the learner's English, and selection must be
// deterministic with at most one strong reaction per session.
import { selectHumorReaction, isRestrictedContext, RESTRICTED_CONTEXTS, STRONG_COOLDOWN_DAYS } from "./humor.ts";
import { HUMOR_BANK } from "./content/humor.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };

const input = (over = {}) => ({
  speaker: "guide",
  context: "session-complete",
  day: "2026-07-30",
  sessionId: "s-1",
  lastStrongReactionAt: null,
  ...over,
});

const POSITIVE_CONTEXTS = ["session-complete", "mastery", "comeback", "streak", "speed-round", "recovery", "perfect"];

// ── restricted contexts: no humor, ever ─────────────────────────────────────
for (const context of ["consent", "microphone-error", "sync-error", "correction", "account-error"]) {
  eq(selectHumorReaction(input({ context })), null, `no humor during ${context}`);
  eq(selectHumorReaction(input({ context, speaker: "joel" })), null, `no joel humor during ${context}`);
}
// Any technical-failure context is restricted too, not just the listed five.
eq(selectHumorReaction(input({ context: "recording-failure" })), null, "unlisted failure context is restricted");
eq(selectHumorReaction(input({ context: "payment-error" })), null, "unlisted error context is restricted");
truthy(isRestrictedContext("consent"), "isRestrictedContext covers the explicit list");
eq(RESTRICTED_CONTEXTS.size, 5, "the explicit restricted list has the five spec contexts");

// ── unapproved Joel copy is never returned ──────────────────────────────────
for (const context of POSITIVE_CONTEXTS) {
  for (let s = 0; s < 25; s++) {
    const reaction = selectHumorReaction(input({ speaker: "joel", context, sessionId: `s-${s}` }));
    truthy(reaction === null || reaction.approval === "joel-approved", `joel ${context}/s-${s} is null or joel-approved`);
  }
}
// Joel approved his six lines on 2026-07-30, so his voice can now render. The
// invariant is NOT "everything is approved" — it is that nothing UNAPPROVED can
// ever reach a learner, which is what protects the next line someone drafts.
const joelLines = HUMOR_BANK.filter((r) => r.speaker === "joel");
truthy(joelLines.length > 0, "Joel has lines in the bank");
// The gate: a draft is never selectable, whatever else is in the bank.
const draftIds = new Set(joelLines.filter((r) => r.approval === "draft").map((r) => r.id));
for (const context of POSITIVE_CONTEXTS) {
  for (let s = 0; s < 25; s++) {
    const r = selectHumorReaction(input({ speaker: "joel", context, sessionId: `gate-${s}` }));
    truthy(!r || !draftIds.has(r.id), `a draft Joel line is never selected (${context})`);
    truthy(!r || r.approval === "joel-approved", `a selected Joel line is approved (${context})`);
  }
}

// ── determinism: same input, same output, no Math.random ────────────────────
for (const context of POSITIVE_CONTEXTS) {
  const a = selectHumorReaction(input({ context, sessionId: "det" }));
  const b = selectHumorReaction(input({ context, sessionId: "det" }));
  eq(a, b, `selection for ${context} is deterministic (same object both times)`);
}

// ── frequency cap: at most one strong reaction per session ──────────────────
// Simulate a busy session: many moments, caller persists lastStrongReactionAt
// whenever a strong reaction is shown (the documented contract).
for (let s = 0; s < 40; s++) {
  let last = null;
  let strongCount = 0;
  for (let round = 0; round < 3; round++) {
    for (const context of POSITIVE_CONTEXTS) {
      const r = selectHumorReaction(input({ context, sessionId: `cap-${s}`, lastStrongReactionAt: last }));
      if (r && r.strength === "strong") { strongCount++; last = "2026-07-30"; }
    }
  }
  truthy(strongCount <= 1, `session cap-${s} shows at most one strong reaction (got ${strongCount})`);
}

// ── cooldown: a recent strong blocks strong; a stale one does not ───────────
// Find a moment that deterministically yields a strong reaction.
let strongInput = null;
outer: for (const context of POSITIVE_CONTEXTS) {
  for (let s = 0; s < 200; s++) {
    const cand = input({ context, sessionId: `cool-${s}` });
    const r = selectHumorReaction(cand);
    if (r && r.strength === "strong") { strongInput = cand; break outer; }
  }
}
truthy(strongInput, "the bank and odds can produce a strong reaction at all");
if (strongInput) {
  const fresh = selectHumorReaction(strongInput);
  eq(fresh.strength, "strong", "with no prior strong, the strong reaction fires");
  const sameDay = selectHumorReaction({ ...strongInput, lastStrongReactionAt: "2026-07-30" });
  truthy(sameDay === null || sameDay.strength === "light", "a same-day prior strong downgrades to light or nothing");
  const yesterday = selectHumorReaction({ ...strongInput, lastStrongReactionAt: "2026-07-29" });
  truthy(yesterday === null || yesterday.strength === "light", "inside the cooldown window, no strong");
  const stale = selectHumorReaction({ ...strongInput, lastStrongReactionAt: "2026-07-01" });
  eq(stale.strength, "strong", "a long-elapsed cooldown allows strong again");
  truthy(STRONG_COOLDOWN_DAYS >= 1, "cooldown spans at least a day, so one per session holds");
}

// ── bank metadata: slang notes, targets, approvals, bilingual text ──────────
for (const r of HUMOR_BANK) {
  truthy(["situation", "self", "culture"].includes(r.target),
    `${r.id} targets situation/self/culture, never the learner`);
  truthy(["light", "strong"].includes(r.strength), `${r.id} has strength metadata`);
  truthy(r.text.es.length > 0 && r.text.en.length > 0, `${r.id} has both es and en text`);
  if (r.slang) {
    truthy(r.slang.term.length > 0, `${r.id} slang names its term`);
    truthy(r.slang.meaning.length > 0, `${r.id} slang carries a plain-Spanish meaning`);
    truthy(r.slang.register.length > 0, `${r.id} slang carries a register note`);
  }
  if (r.speaker === "guide") {
    truthy(r.approval === "reviewed" || r.approval === "draft", `${r.id}: clara lines are reviewed or draft, never joel-approved`);
  } else {
    truthy(r.approval === "draft" || r.approval === "joel-approved", `${r.id}: joel lines are draft until approved, never merely reviewed`);
  }
}
truthy(HUMOR_BANK.some((r) => r.speaker === "guide" && r.approval === "reviewed"),
  "clara has releasable reviewed lines");
truthy(new Set(HUMOR_BANK.map((r) => r.id)).size === HUMOR_BANK.length, "reaction ids are unique");

// Integration contract: the completion surface may show Clara's reviewed copy,
// but never alongside a technical failure, and never in Joel's voice.
{
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../components/daily-session/session-complete.tsx", import.meta.url), "utf8");
  truthy(src.includes("selectHumorReaction"), "completion surface consults the humor selector");
  truthy(/speaker:\s*"guide"/.test(src), "completion humor is Clara's voice, never an unapproved Joel quote");
  truthy(/skipped\s*\?\s*null/.test(src), "no humor when a step ended in technical trouble");
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
