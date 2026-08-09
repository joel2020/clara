import {
  orderEntryPhraseFirst,
  resolveTopicPack,
  resolveVisualObject,
} from "./resolve.ts";

let ok = 0;
let fail = 0;

const assert = (condition, message) => {
  if (condition) ok++;
  else {
    fail++;
    console.log("FAIL", message);
  }
};

const coffeePack = {
  id: "cafe-restaurant",
  environment: { desktop: "coffee-desktop", mobile: "coffee-mobile" },
  story: {
    eyebrow: { en: "Coffee", es: "Café" },
    title: { en: "Order", es: "Pide" },
    body: { en: "Practice", es: "Practica" },
    cta: { en: "Start", es: "Empezar" },
  },
  discoveryObjectIds: ["menu", "cup"],
  entryObjectId: "cup",
  entryPhraseItemId: "phrase:coffee",
  objects: [
    { id: "menu", label: { en: "Menu", es: "Menú" }, pronunciation: "/ˈmenjuː/", image: "menu", alt: { en: "Menu", es: "Menú" } },
    { id: "cup", label: { en: "Cup", es: "Taza" }, pronunciation: "/kʌp/", image: "cup", alt: { en: "Cup", es: "Taza" } },
  ],
  moments: {
    story: { pose: "idle", focusObjectIds: [] },
    discover: { pose: "point", focusObjectIds: ["menu"] },
    speak: { pose: "think", focusObjectIds: ["cup"] },
    success: { pose: "cheer", focusObjectIds: ["cup"] },
    retry: { pose: "encourage", focusObjectIds: [] },
  },
};

const registry = { packs: { "cafe-restaurant": coffeePack } };

assert(resolveTopicPack(registry) === null, "absent topic resolves to null");
assert(resolveTopicPack(registry, "airport-travel") === null, "missing topic pack resolves to null");
assert(resolveTopicPack(registry, "cafe-restaurant") === coffeePack, "exact topic ID resolves its pack");
assert(resolveVisualObject(coffeePack) === null, "absent object resolves to null");
assert(resolveVisualObject(coffeePack, "missing") === null, "missing object resolves to null");
assert(resolveVisualObject(coffeePack, "cup") === coffeePack.objects[1], "exact object ID resolves its object");

const phrases = [
  { id: "phrase:hello", text: "Hello" },
  { id: "phrase:coffee", text: "A coffee, please" },
  { id: "phrase:thanks", text: "Thank you" },
];
const promoted = orderEntryPhraseFirst(phrases, "phrase:coffee");
assert(promoted.map((item) => item.id).join(",") === "phrase:coffee,phrase:hello,phrase:thanks", "entry phrase is promoted and remaining phrases stay ordered");
assert(phrases.map((item) => item.id).join(",") === "phrase:hello,phrase:coffee,phrase:thanks", "entry phrase promotion does not mutate the source array");

const unchanged = orderEntryPhraseFirst(phrases, "phrase:missing");
assert(unchanged !== phrases && unchanged.map((item) => item.id).join(",") === "phrase:hello,phrase:coffee,phrase:thanks", "unknown entry ID returns an unchanged copy");

const duplicates = [
  { id: "phrase:coffee", text: "First" },
  { id: "phrase:hello", text: "Hello" },
  { id: "phrase:coffee", text: "Second" },
];
assert(orderEntryPhraseFirst(duplicates, "phrase:coffee").map((item) => item.text).join(",") === "First,Hello,Second", "duplicate entry IDs remain deterministic");

console.log(`resolve: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
