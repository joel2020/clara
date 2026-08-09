// npx tsx lib/exam-compose.test.mjs
//
// A sitting must be reproducible (so a disputed result can be re-examined), must
// not reuse the same phrase in two sections (so one good answer cannot be
// recycled), and must degrade gracefully when a band has thin content.
import { composeExam, seededOrder, scoreRetell, retellKeywords, requiredStageFeatures } from "./exam-compose.ts";
import { SECTIONS } from "./exams.ts";
import { ALL_ITEMS } from "./content/lessons.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };

const item = (id, text, categoryId = "conversation") => ({ id, text, ipa: "/x/", mouthHint: "Use a clear mouth shape.", kind: "phrase", categoryId, phoneme: "x", meaning: "x" });
const general = Array.from({ length: 30 }, (_, i) => item(`it${i}`, `phrase ${i}`));
const features = ["i-vs-ii", "b-vs-v", "th", "s-clusters", "ed-endings", "final-clusters", "american-r", "schwa"];
const targets = features.flatMap((feature) => Array.from({ length: 3 }, (_, i) => item(`${feature}:${i}`, `${feature} ${i}`, feature)));
const pool = [...general, ...targets];
const CATEGORY_BY_FEATURE = {
  "short-i-long-ee": "i-vs-ii", "b-v": "b-vs-v", th: "th", "initial-s-cluster": "s-clusters",
  "final-endings": "ed-endings", "final-clusters": "final-clusters", "rhotic-r": "american-r", schwa: "schwa",
};

// --- Determinism ------------------------------------------------------------
const a = composeExam("B1", pool, "seed-1");
const b = composeExam("B1", pool, "seed-1");
eq(a, b, "the same seed reproduces the same sitting exactly");

const c = composeExam("B1", pool, "seed-2");
eq(JSON.stringify(a) !== JSON.stringify(c), true, "a different seed gives a different sitting");

// --- Shape ------------------------------------------------------------------
eq(a.sections.map((s) => s.key), SECTIONS.map((s) => s.key), "all six sections, in order");
eq(a.level, "B1", "level is carried");
eq(a.status, "ready", "a covered authored pool is ready");
eq(a.contentVersion, "stage-content-v1", "the authored coverage contract is explicitly versioned");
eq(typeof a.contentHash === "string" && a.contentHash.length === 16, true, "a ready sitting carries a bounded content hash");

const sourceById = new Map(pool.map((entry) => [entry.id, entry]));
eq(a.sections.flatMap((s) => s.items).every((entry) => entry.kind === sourceById.get(entry.itemId)?.kind), true, "exam preserves authored assessment kinds");

const itemSections = a.sections.filter((s) => s.items.length);
for (const s of itemSections) {
  const want = SECTIONS.find((x) => x.key === s.key).items;
  eq(s.items.length, want, `${s.key} has its ${want} items`);
}
eq(a.sections.find((s) => s.key === "retell").prompt.length > 40, true, "retell carries a passage");
eq(a.sections.find((s) => s.key === "openResponse").prompt.length > 10, true, "open response carries prompts");

// --- No reuse across sections ----------------------------------------------
const ids = itemSections.flatMap((s) => s.items.map((i) => i.itemId));
eq(ids.length, new Set(ids).size, "no phrase appears in two sections");
const scriptedSpeaking = a.sections.filter((s) => s.key === "readAloud" || s.key === "repeat").flatMap((s) => s.items);
eq(scriptedSpeaking.every((i) => i.assessmentRole === "stage-acoustic" && i.targetFeature), true, "every scripted speaking target carries explicit gradeable metadata");
eq(scriptedSpeaking.some((i) => i.targetFeature === "final-endings"), true, "every sitting covers final endings");

// --- Thin content must not crash or invent items ---------------------------
eq(composeExam("A1", [item("only", "hello")], "seed-1").status, "unavailable", "a one-item pool fails closed");
eq(composeExam("A1", [], "seed-1").status, "unavailable", "an empty pool fails closed");

// Items with blank text are filtered out rather than shown as empty prompts.
eq(composeExam("A1", [...pool, item("blank", "   ")], "s").sections.flatMap((s) => s.items.map((i) => i.itemId)).includes("blank"), false, "blank items are dropped");

const diagnosticOnly = [...general, ...Array.from({ length: 20 }, (_, i) => item(`stress:${i}`, `stress ${i}`, "word-stress"))];
eq(composeExam("B1", diagnosticOnly, "s").status, "unavailable", "word-stress diagnostics cannot substitute for gradeable targets");
const duplicateIds = [...pool, { ...pool[0], text: "conflict" }];
eq(composeExam("B1", duplicateIds, "s").status, "unavailable", "duplicate authored item ids fail closed");

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

for (const level of ["A0", "A1", "A2", "B1", "B2", "C1", "C2"]) {
  const shipped = composeExam(level, ALL_ITEMS, `shipped:${level}`);
  eq(shipped.status, "ready", `${level} has enough shipped authored coverage`);
  const targets = shipped.sections.filter((s) => s.key === "readAloud" || s.key === "repeat").flatMap((s) => s.items);
  eq(targets.length, 8, `${level} gets all eight scripted acoustic targets`);
  eq(new Set(targets.map((target) => target.itemId)).size, 8, `${level} scripted target ids are unique`);
  const required = requiredStageFeatures(level);
  eq(required.every((feature) => targets.some((target) => target.targetFeature === feature)), true, `${level} covers every declared required feature`);
  for (const feature of required) {
    const missing = composeExam(level, ALL_ITEMS.filter((candidate) => candidate.categoryId !== CATEGORY_BY_FEATURE[feature]), `missing:${level}:${feature}`);
    eq(missing.status, "unavailable", `${level} fails closed when ${feature} is absent`);
  }
  const reversed = composeExam(level, [...ALL_ITEMS].reverse(), `shipped:${level}`);
  eq(reversed, shipped, `${level} composition is independent of input permutation`);
}

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
