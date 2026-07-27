// npx tsx lib/exam-compose.test.mjs
//
// A sitting must be reproducible (so a disputed result can be re-examined), must
// not reuse the same phrase in two sections (so one good answer cannot be
// recycled), and must degrade gracefully when a band has thin content.
import { composeExam, seededOrder, scoreRetell, retellKeywords } from "./exam-compose.ts";
import { SECTIONS } from "./exams.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };

const item = (id, text) => ({ id, text, ipa: "", mouthHint: "", kind: "phrase", categoryId: "conversation", phoneme: "chunk", meaning: "x" });
const pool = Array.from({ length: 40 }, (_, i) => item(`it${i}`, `phrase ${i}`));

// --- Determinism ------------------------------------------------------------
const a = composeExam("B1", pool, "seed-1");
const b = composeExam("B1", pool, "seed-1");
eq(a, b, "the same seed reproduces the same sitting exactly");

const c = composeExam("B1", pool, "seed-2");
eq(JSON.stringify(a) !== JSON.stringify(c), true, "a different seed gives a different sitting");

// --- Shape ------------------------------------------------------------------
eq(a.sections.map((s) => s.key), SECTIONS.map((s) => s.key), "all six sections, in order");
eq(a.level, "B1", "level is carried");

const spoken = a.sections.filter((s) => s.key !== "retell" && s.key !== "openResponse");
for (const s of spoken) {
  const want = SECTIONS.find((x) => x.key === s.key).items;
  eq(s.items.length, want, `${s.key} has its ${want} items`);
}
eq(a.sections.find((s) => s.key === "retell").prompt.length > 40, true, "retell carries a passage");
eq(a.sections.find((s) => s.key === "openResponse").prompt.length > 10, true, "open response carries prompts");

// --- No reuse across sections ----------------------------------------------
const ids = spoken.flatMap((s) => s.items.map((i) => i.itemId));
eq(ids.length, new Set(ids).size, "no phrase appears in two sections");

// --- Thin content must not crash or invent items ---------------------------
const thin = composeExam("A1", [item("only", "hello")], "seed-1");
const thinIds = thin.sections.flatMap((s) => s.items.map((i) => i.itemId));
eq(thinIds, ["only"], "a one-item pool yields exactly that item, once");
eq(composeExam("A1", [], "seed-1").sections.length, SECTIONS.length, "an empty pool still returns six sections");
eq(composeExam("A1", [], "seed-1").sections.every((s) => Array.isArray(s.items)), true, "sections always have an items array");

// Items with blank text are filtered out rather than shown as empty prompts.
eq(composeExam("A1", [item("blank", "   "), item("real", "hi")], "s").sections.flatMap((s) => s.items.map((i) => i.itemId)), ["real"], "blank items are dropped");

// --- Band-appropriate prompts ----------------------------------------------
const low = composeExam("A1", pool, "s").sections.find((s) => s.key === "retell").prompt;
const high = composeExam("C1", pool, "s").sections.find((s) => s.key === "retell").prompt;
eq(low !== high, true, "a beginner and an advanced learner retell different passages");

// --- Retell scoring ---------------------------------------------------------
const kw = retellKeywords("B1");
eq(scoreRetell("", kw), 0, "saying nothing scores zero");
eq(scoreRetell(kw.join(" "), kw), 100, "covering every keyword scores 100");
eq(scoreRetell(kw.slice(0, Math.ceil(kw.length / 2)).join(" "), kw) > 40, true, "half the keywords scores around half");
eq(scoreRetell("LAPTOP was the WRONG model", ["laptop", "wrong"]), 100, "matching is case-insensitive");
eq(scoreRetell("nothing relevant here", ["laptop", "wrong"]), 0, "unrelated speech scores zero");
eq(scoreRetell("anything", []), 0, "no keywords cannot yield credit");

// --- seededOrder is a permutation, not a filter ----------------------------
const ordered = seededOrder(pool, (i) => i.id, "s");
eq(ordered.length, pool.length, "ordering keeps every item");
eq(new Set(ordered.map((i) => i.id)).size, pool.length, "ordering does not duplicate");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
