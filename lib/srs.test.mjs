// npx tsx lib/srs.test.mjs
//
// The Leitner box logic decides when a word resurfaces and what counts as
// mastered — the spine of the practice loop, previously untested.
import { applyResult, freshProgress, isMastered, intervalForBox, orderForSession, MASTERED_BOX } from "./srs.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };

const now = 1_000_000;
const seed = { itemId: "w1", lessonId: "l1", categoryId: "c1", phoneme: "p" };

// ── freshProgress ──────────────────────────────────────────────────────────
const fresh = freshProgress(seed, now);
eq(fresh.box, 0, "fresh item starts at box 0");
eq(fresh.attempts, 0, "fresh item has no attempts");
eq(fresh.dueAt, now, "fresh item is due now");
eq(fresh.lastResult, null, "fresh item has no last result");

// ── a pass promotes one box, a fail demotes toward 0 ───────────────────────
const p1 = applyResult(fresh, true, 90, now);
eq(p1.box, 1, "pass promotes to box 1");
eq(p1.passes, 1, "pass increments passes");
eq(p1.attempts, 1, "pass increments attempts");
eq(p1.lastResult, "pass", "pass records lastResult");
eq(p1.dueAt, now + intervalForBox(1), "dueAt uses box-1 interval");

const f1 = applyResult(p1, false, 20, now);
eq(f1.box, 0, "fail knocks box back down");
eq(f1.passes, 1, "fail does not add a pass");
eq(f1.attempts, 2, "fail still counts as an attempt");
eq(f1.lastResult, "fail", "fail records lastResult");

// ── box floors at 0 and caps at MASTERED_BOX+1 ─────────────────────────────
let p = freshProgress(seed, now);
for (let i = 0; i < 10; i++) p = applyResult(p, true, 100, now);
eq(p.box, MASTERED_BOX + 1, "box caps at MASTERED_BOX+1 no matter how many passes");
truthy(isMastered(p), "a long pass streak is mastered");

let q = { ...freshProgress(seed, now), box: 0 };
q = applyResult(q, false, 0, now);
eq(q.box, 0, "box never goes below 0 on a fail");

// ── isMastered boundary ────────────────────────────────────────────────────
eq(isMastered({ box: MASTERED_BOX - 1 }), false, "one below mastered is not mastered");
eq(isMastered({ box: MASTERED_BOX }), true, "exactly MASTERED_BOX is mastered");

// ── orderForSession: overdue-and-low-box first, unseen middle, not-due-mastered
// last. (A mastered item that is itself overdue legitimately resurfaces — the
// "mastered goes last" rule is only about items not yet due.)
const items = [{ id: "unseen" }, { id: "due" }, { id: "mastered" }];
const map = new Map([
  ["due", { itemId: "due", box: 0, dueAt: now - 10_000 }],
  ["mastered", { itemId: "mastered", box: MASTERED_BOX, dueAt: now + 10_000_000 }],
]);
const ordered = orderForSession(items, map, now).map((i) => i.id);
eq(ordered[0], "due", "the overdue low-box item comes first");
eq(ordered[1], "unseen", "an unseen item comes before a not-due mastered one");
eq(ordered[2], "mastered", "a mastered item not yet due comes last");

// and an OVERDUE mastered item does come back (it isn't parked at the end).
const items2 = [{ id: "unseen" }, { id: "overdueMastered" }];
const map2 = new Map([["overdueMastered", { itemId: "overdueMastered", box: MASTERED_BOX, dueAt: now - 10_000 }]]);
const ordered2 = orderForSession(items2, map2, now).map((i) => i.id);
eq(ordered2[0], "overdueMastered", "an overdue mastered item resurfaces ahead of unseen");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
