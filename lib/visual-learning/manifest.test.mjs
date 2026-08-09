import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONVERSATION_LESSONS } from "../content/conversation.ts";
import { VISUAL_TOPIC_PACKS } from "./manifest.ts";
import { resolveTopicPack, resolveVisualObject } from "./resolve.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXPECTED_OBJECT_IDS = [
  "table",
  "menu",
  "coffee",
  "chicken",
  "onion",
  "meal",
  "check",
  "card",
  "takeaway-bag",
  "change",
];
const EXPECTED_RUNTIME_PATHS = new Set([
  "/visual-learning/cafe-restaurant/environment-desktop.webp",
  "/visual-learning/cafe-restaurant/environment-mobile.webp",
  ...EXPECTED_OBJECT_IDS.map((id) => `/visual-learning/cafe-restaurant/objects/${id}.webp`),
]);
const ALLOWED_LUMI_POSES = new Set([
  "idle",
  "cheer",
  "think",
  "encourage",
  "clap",
  "point",
  "love",
]);

let ok = 0;
let fail = 0;

const check = (condition, message) => {
  if (condition) ok++;
  else {
    fail++;
    console.log("FAIL", message);
  }
};

const packIds = Object.keys(VISUAL_TOPIC_PACKS.packs);
check(packIds.length === 1 && packIds[0] === "cafe-restaurant", "the café pack is the only registered pack");

const pack = resolveTopicPack(VISUAL_TOPIC_PACKS, "cafe-restaurant");
assert.ok(pack, "the registered café pack must resolve");

const objectIds = pack.objects.map((object) => object.id);
check(objectIds.length === 10, "the café pack has ten objects");
check(new Set(objectIds).size === 10, "the café pack object IDs are unique");
check(JSON.stringify(objectIds) === JSON.stringify(EXPECTED_OBJECT_IDS), "the café pack uses the accepted object IDs in lesson order");
check(new Set(pack.discoveryObjectIds).size === 4, "discovery objects are unique");
check(JSON.stringify(pack.discoveryObjectIds) === JSON.stringify(["coffee", "menu", "table", "card"]), "discovery objects use the approved café sequence");
check(pack.entryObjectId === "coffee", "coffee is the entry object");
check(pack.entryPhraseItemId === "conv-cafe:3", "the coffee phrase is the entry phrase");
check(resolveVisualObject(pack, pack.entryObjectId)?.audioItemId === pack.entryPhraseItemId, "the entry IDs resolve to the coffee object and phrase");

for (const [index, object] of pack.objects.entries()) {
  check(Boolean(object.label.en && object.label.es), `${object.id} has bilingual labels`);
  check(Boolean(object.alt.en && object.alt.es), `${object.id} has bilingual alt text`);
  check(Boolean(object.pronunciation), `${object.id} has a pronunciation`);
  check(object.audioItemId === `conv-cafe:${index + 1}`, `${object.id} uses its existing phrase as audio`);
  check(EXPECTED_RUNTIME_PATHS.has(object.image), `${object.id} uses an accepted runtime path`);
}
check(EXPECTED_RUNTIME_PATHS.has(pack.environment.desktop), "desktop environment uses an accepted runtime path");
check(EXPECTED_RUNTIME_PATHS.has(pack.environment.mobile), "mobile environment uses an accepted runtime path");
check(
  new Set([pack.environment.desktop, pack.environment.mobile, ...pack.objects.map((object) => object.image)]).size === EXPECTED_RUNTIME_PATHS.size,
  "the pack uses only the accepted runtime paths",
);

for (const [momentId, moment] of Object.entries(pack.moments)) {
  check(ALLOWED_LUMI_POSES.has(moment.pose), `${momentId} uses an allowed Lumi pose`);
  for (const objectId of moment.focusObjectIds) {
    check(resolveVisualObject(pack, objectId) !== null, `${momentId} focus ${objectId} resolves`);
  }
}

const cafeLesson = CONVERSATION_LESSONS.find((lesson) => lesson.id === "conv-cafe");
assert.ok(cafeLesson, "the café lesson must exist");
check(cafeLesson.visualTopicId === "cafe-restaurant", "the café lesson points to its visual topic");
check(cafeLesson.items.length === EXPECTED_OBJECT_IDS.length, "the café lesson still has ten mapped phrases");
check(
  JSON.stringify(cafeLesson.items.map((item) => item.visualObjectId)) === JSON.stringify(EXPECTED_OBJECT_IDS),
  "café phrases map to accepted objects in order",
);
for (const item of cafeLesson.items) {
  check(resolveVisualObject(pack, item.visualObjectId) !== null, `${item.id} focus resolves`);
}

for (const filename of readdirSync(join(ROOT, "lib", "visual-learning"))) {
  if (!filename.endsWith(".ts")) continue;
  const source = readFileSync(join(ROOT, "lib", "visual-learning", filename), "utf8");
  check(!/higgsfield|https?:\/\/|api[_-]?key|secret|token|generate(?:Image|\()|generation\s*\(/i.test(source), `${filename} has no runtime generation or credential code`);
}

console.log(`manifest: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
