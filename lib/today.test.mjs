// npx tsx lib/today.test.mjs
//
// The job path must actually lead somewhere different. If pickNextLesson ignores
// the path, choosing "para trabajar" is cosmetic — the student would be handed the
// same general conversation ladder and never reach the support units.
import { pickNextLesson } from "./today.ts";
import { SUPPORT_UNIT_IDS } from "./content/conversation-support.ts";
import { LESSONS } from "./content/lessons.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (a === b) ok++; else { fail++; console.log("FAIL", m, "got", a, "want", b); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };

const MASTERED_BOX = 5;
const mastered = (itemId) => [itemId, { itemId, lessonId: "l", categoryId: "c", phoneme: "p", attempts: 5, passes: 5, box: MASTERED_BOX, dueAt: 0, lastResult: "pass", lastScore: 95, updatedAt: 1 }];

// Nothing practised: the job path opens on its first support unit, the general
// path does not.
const empty = new Map();
eq(pickNextLesson(empty, "A2", "job").id, SUPPORT_UNIT_IDS[0], "job path starts at the first support unit");
truthy(!SUPPORT_UNIT_IDS.includes(pickNextLesson(empty, "A2", "general").id), "general path does not start on support");
truthy(!SUPPORT_UNIT_IDS.includes(pickNextLesson(empty, "A2").id), "default path is general");

// Mastering the first support unit advances the job path to the second.
const byId = new Map(LESSONS.map((l) => [l.id, l]));
const first = byId.get(SUPPORT_UNIT_IDS[0]);
const doneFirst = new Map(first.items.map((i) => mastered(i.id)));
eq(pickNextLesson(doneFirst, "A2", "job").id, SUPPORT_UNIT_IDS[1], "job path advances to the next support unit");

// With every support unit mastered, the job path falls through to her level pool
// rather than dead-ending.
const allSupport = new Map(
  SUPPORT_UNIT_IDS.flatMap((id) => (byId.get(id)?.items ?? []).map((i) => mastered(i.id))),
);
const after = pickNextLesson(allSupport, "A2", "job");
truthy(!SUPPORT_UNIT_IDS.includes(after.id), "job path falls through once support is mastered");
truthy(after.id.length > 0, "fall-through still returns a real lesson");

// A lesson is always returned, whatever the input.
truthy(pickNextLesson(undefined, undefined, "job").id, "undefined progress still yields a lesson");
truthy(pickNextLesson(undefined, undefined, "general").id, "general with no level still yields a lesson");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
