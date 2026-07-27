// npx tsx lib/weak-items.test.mjs
// (tsx, not plain node: this pulls the real curriculum in through the "@/" alias.)
//
// The bug this guards: isolated pronunciation drill words from the SOUNDS track
// ("vase", "base", "boat") were being handed to the AI conversation partner as
// focus items, so Joel bent the scene to fit them and asked a student whether
// she had "a vase for her books". Sound drills are mouth-shape targets, not
// conversational vocabulary — the conversation partner must only ever get
// real-life phrases from the conversation track.
import { weakestItems } from "./weak-items.ts";
import { ITEM_BY_ID, LESSON_BY_ITEM_ID } from "./content/lessons.ts";

let ok = 0, fail = 0;
const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) ok++; else { fail++; console.log("FAIL", m, "got", JSON.stringify(a), "want", JSON.stringify(b)); } };
const truthy = (a, m) => { if (a) ok++; else { fail++; console.log("FAIL", m); } };
const falsy = (a, m) => { if (!a) ok++; else { fail++; console.log("FAIL", m); } };

// A struggling row: practiced, failing, box 0 => maximally weak.
// NOTE lastResult is "pass" | "fail" | null — never a boolean.
const weak = (itemId) => ({ itemId, box: 0, attempts: 4, passes: 1, lastResult: "fail", dueAt: 0, updatedAt: 1 });

// Sanity: the offending item really is in the curriculum, on the sounds track.
truthy(ITEM_BY_ID.has("b-vs-v:vase"), "b-vs-v:vase exists in curriculum");
eq(LESSON_BY_ITEM_ID.get("b-vs-v:vase")?.track ?? "sounds", "sounds", "vase is a sounds-track item");
eq(LESSON_BY_ITEM_ID.get("conv-cafe:1")?.track, "conversation", "conv-cafe:1 is a conversation item");

// --- The regression -------------------------------------------------------
// Sounds-track drill words must NEVER reach the conversation partner.
const soundsOnly = [weak("b-vs-v:vase"), weak("b-vs-v:base"), weak("b-vs-v:boat")];
const forChat = weakestItems(soundsOnly, 5, { track: "conversation" });
eq(forChat, [], "sounds-only progress yields NO conversation focus items");

// Mixed progress: only the conversation phrases come through.
const mixed = [weak("b-vs-v:vase"), weak("conv-cafe:1"), weak("b-vs-v:boat"), weak("conv-greetings:2")];
const mixedChat = weakestItems(mixed, 5, { track: "conversation" });
eq(mixedChat.length, 2, "mixed progress yields only the 2 conversation items");
falsy(mixedChat.some((w) => /^b-vs-v:/.test(w.itemId)), "no sounds items leak into chat focus");
truthy(mixedChat.every((w) => w.text && w.text.trim().length > 0), "chat focus items have text");

// Every conversation focus item carries a Spanish gloss — that is what makes it
// a real phrase rather than a bare mouth-shape target.
truthy(mixedChat.every((w) => typeof w.meaning === "string" && w.meaning.length > 0), "chat focus items have a meaning gloss");

// --- Unfiltered behaviour is unchanged (other callers, e.g. drill weighting) --
const unfiltered = weakestItems(mixed, 5);
eq(unfiltered.length, 4, "unfiltered still returns every weak item");
truthy(unfiltered.some((w) => w.itemId === "b-vs-v:vase"), "unfiltered still includes sounds items");

// --- Ranking still works --------------------------------------------------
const ranked = weakestItems(
  [
    { itemId: "conv-cafe:1", box: 3, attempts: 4, passes: 4, lastResult: "pass", dueAt: 0, updatedAt: 1 }, // strongest
    weak("conv-cafe:2"), // weakest
    { itemId: "conv-cafe:3", box: 1, attempts: 4, passes: 2, lastResult: "fail", dueAt: 0, updatedAt: 1 },
  ],
  3,
  { track: "conversation" },
);
eq(ranked.map((r) => r.itemId), ["conv-cafe:2", "conv-cafe:3", "conv-cafe:1"], "weakest first ordering preserved");

// --- Regression: a recent MISS must outrank a recent PASS ------------------
// `lastResult` is a string union, so the old `p.lastResult ? 3 : 0` check scored
// "pass" and "fail" identically and ranked a never-resolved item as weaker than
// one she just got wrong — defeating the entire point of "her weakest items".
const same = (itemId, lastResult) => ({ itemId, box: 2, attempts: 4, passes: 2, lastResult, dueAt: 0, updatedAt: 1 });
const byRecency = weakestItems(
  [same("conv-cafe:1", "pass"), same("conv-cafe:2", null), same("conv-cafe:3", "fail")],
  3,
  { track: "conversation" },
);
eq(byRecency[0].itemId, "conv-cafe:3", "a recently failed item ranks first");
eq(byRecency.map((r) => r.itemId), ["conv-cafe:3", "conv-cafe:1", "conv-cafe:2"], "fail beats pass and untouched");

// All else equal, a miss must rank ahead of a pass even from a higher SRS box.
const boxed = weakestItems(
  [
    { itemId: "conv-cafe:1", box: 0, attempts: 4, passes: 2, lastResult: "pass", dueAt: 0, updatedAt: 1 },
    { itemId: "conv-cafe:2", box: 1, attempts: 4, passes: 2, lastResult: "fail", dueAt: 0, updatedAt: 1 },
  ],
  2,
  { track: "conversation" },
);
eq(boxed[0].itemId, "conv-cafe:2", "a miss outweighs one SRS box of progress");

// Limit respected.
eq(weakestItems(mixed, 1, { track: "conversation" }).length, 1, "limit respected");

// Unknown / stale item ids are ignored rather than crashing.
eq(weakestItems([weak("does-not-exist:9")], 5, { track: "conversation" }), [], "unknown item id ignored");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
