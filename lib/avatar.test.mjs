// node lib/avatar.test.mjs
//
// Adult learner-avatar model gate. Covers: both bases share one unrestricted
// catalog, layer composition is deterministic and z-ordered, and the loadout
// stays purely cosmetic — no field of it can reach assessment, difficulty, or
// access. The persistence side (equippedCap etc. on PlayerStats) is covered by
// lib/store.test.mjs; this file is only the pure model.
import { deepStrictEqual } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

const {
  AVATAR_ANCHORS,
  AVATAR_BASES,
  AVATAR_CANVAS,
  CAP_ANCHORS,
  avatarCapSrc,
  avatarFigureSrc,
  avatarRenderLayers,
  capLayout,
  composeAvatarLayers,
  defaultLoadout,
  loadoutFor,
} = await import("./avatar.ts");

// --- A. Both adult bases equip the same catalog ----------------------------
// The plan's canonical check: a baseball cap and a dog work on either base.
for (const base of ["adult-woman-01", "adult-man-01"]) {
  const layers = composeAvatarLayers({ base, outfit: "street-default", cap: "cap-ink", pet: "pet-golden" });
  assert(
    JSON.stringify(layers.map((x) => x.slot)) === JSON.stringify(["base", "outfit", "cap", "pet"]),
    `${base} equips a baseball cap and dog as [base, outfit, cap, pet]`,
  );
  assert(layers[0].slot === "base" && layers[0].id === base, `${base} is always the first layer`);
}
assert(AVATAR_BASES.length === 2, "exactly two adult bases exist");

// The same items produce identical non-base layers on either base — there is
// no per-base restriction anywhere in the model.
{
  const wear = { outfit: "street-noche", cap: "cap-medellin-verde", pet: "pet-tabby" };
  const [, ...woman] = composeAvatarLayers({ base: "adult-woman-01", ...wear });
  const [, ...man] = composeAvatarLayers({ base: "adult-man-01", ...wear });
  deepStrictEqual(woman, man);
  assert(true, "non-base layers are identical across bases (no gender-restricted items)");
}

// --- B. Store changes never affect assessment ------------------------------
assert(
  Object.keys(defaultLoadout()).some((k) => ["level", "difficulty", "score", "hints"].includes(k)) === false,
  "the loadout carries no assessment-adjacent fields",
);

// --- C. Determinism and z-order --------------------------------------------
{
  const loadout = { base: "adult-man-01", outfit: "street-futbol", cap: "cap-dos-tonos", pet: "pet-macaw" };
  const a = composeAvatarLayers(loadout);
  const b = composeAvatarLayers(loadout);
  deepStrictEqual(a, b);
  assert(true, "the same loadout always composes the same layers");
  assert(a.every((l, i) => i === 0 || l.z > a[i - 1].z), "layers are strictly z-ordered");
}

// --- D. Empty slots after the base are omitted -----------------------------
{
  const bare = composeAvatarLayers(defaultLoadout());
  assert(
    JSON.stringify(bare.map((x) => x.slot)) === JSON.stringify(["base", "outfit"]),
    "the default loadout renders base and outfit only (no cap, no pet)",
  );
  const noCap = composeAvatarLayers({ base: "adult-woman-01", outfit: "street-default", pet: "pet-golden" });
  assert(
    JSON.stringify(noCap.map((x) => x.slot)) === JSON.stringify(["base", "outfit", "pet"]),
    "an absent cap is omitted while later slots keep their order",
  );
}

// --- E. Every catalog item resolves to artwork that is really there ---------
// The compositor and the art pipeline share a path scheme, and a slot that
// resolves to a missing file is an empty slot on a learner's avatar. So this
// checks the file, not the string.
const cosmeticsSrc = readFileSync(join(ROOT, "lib/cosmetics.ts"), "utf8");
const idsOfType = (type) =>
  [...cosmeticsSrc.matchAll(new RegExp(`id: "([^"]+)", type: "${type}"`, "g"))].map((m) => m[1]);
const onDisk = (src) => existsSync(join(ROOT, "public", src));

const outfitIds = idsOfType("avatar-outfit");
const capIds = idsOfType("cap").filter((id) => id !== "cap-none"); // the empty slot needs no art
assert(outfitIds.length >= 4, `the catalog has avatar outfits (${outfitIds.length})`);
assert(capIds.length >= 6, `the catalog has caps (${capIds.length})`);

for (const base of AVATAR_BASES) {
  for (const outfit of outfitIds) {
    const src = avatarFigureSrc(base, outfit);
    assert(src === `/avatars/${base}/${outfit}.png`, `${base}/${outfit} follows /avatars/<base>/<outfit>.png`);
    assert(onDisk(src), `${src} exists`);
  }
}
for (const cap of capIds) {
  const src = avatarCapSrc(cap);
  assert(src === `/avatars/caps/${cap}.png`, `${cap} follows /avatars/caps/<cap>.png`);
  assert(onDisk(src), `${src} exists`);
}

// --- F. Both bases expose anchors on one shared canvas ----------------------
// The numbers themselves are measured from the artwork; what is guarded here
// is that both bases declare a complete, sane set. A base missing an anchor
// would silently drop its cap in a corner.
assert(AVATAR_CANVAS.width === 864 && AVATAR_CANVAS.height === 1184, "one shared 864x1184 canvas");
const ANCHOR_KEYS = [
  "capWidth",
  "capCenterX",
  "capBrowY",
  "petWidth",
  "petCenterX",
  "petBaselineY",
  "figureTopY",
  "feetY",
];
for (const base of AVATAR_BASES) {
  const a = AVATAR_ANCHORS[base];
  assert(!!a, `${base} exposes anchors`);
  for (const key of ANCHOR_KEYS) {
    assert(typeof a[key] === "number" && a[key] > 0 && a[key] < 1, `${base}.${key} is normalized 0..1`);
  }
  assert(a.figureTopY < a.capBrowY, `${base} wears its cap below the top of the canvas, on the head`);
  assert(a.capBrowY < a.feetY, `${base} wears its cap above its feet`);
  assert(a.petBaselineY <= a.feetY + 0.01, `${base} stands its companion on the same ground line`);
  assert(a.capCenterX - a.capWidth / 2 > 0 && a.capCenterX + a.capWidth / 2 < 1, `${base} cap stays inside the canvas`);
  assert(a.petCenterX + a.petWidth / 2 <= 1, `${base} companion stays inside the canvas`);
}
// The two bases are different people, framed differently: a cap placed with a
// shared number would sit over the eyes on one of them.
assert(
  AVATAR_ANCHORS["adult-woman-01"].capBrowY !== AVATAR_ANCHORS["adult-man-01"].capBrowY &&
    AVATAR_ANCHORS["adult-woman-01"].capWidth !== AVATAR_ANCHORS["adult-man-01"].capWidth,
  "the two bases have different head positions and head widths",
);

// --- F2. No cap clips, on any base -----------------------------------------
// The catalog mixes view angles, so sizing every sprite by width alone once
// pushed three crowns off the top of the woman's canvas and dropped brims over
// the man's eyes. Each cap now carries its own head-opening line, and this is
// the guard: every base x cap pair must land fully on the canvas with its
// opening on the brow. Also checks the metadata against the real PNG headers,
// so a re-exported sprite with a new aspect ratio cannot drift silently.
const pngSize = (file) => {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
for (const cap of capIds) {
  const art = CAP_ANCHORS[cap];
  assert(!!art, `${cap} has art metadata (aspect + head opening)`);
  if (!art) continue;
  assert(
    art.headOpeningY > 0.5 && art.headOpeningY <= 1,
    `${cap} head opening sits in the lower half of its sprite`,
  );
  const { w, h } = pngSize(join(ROOT, "public", avatarCapSrc(cap)));
  assert(Math.abs(w / h - art.aspect) < 0.01, `${cap} aspect ${art.aspect} matches the shipped sprite (${w}x${h})`);

  for (const base of AVATAR_BASES) {
    const { top, height, left, width } = capLayout(base, cap);
    const brow = AVATAR_ANCHORS[base].capBrowY;
    assert(top >= 0, `${base} + ${cap}: crown stays on the canvas (top ${top.toFixed(4)})`);
    assert(
      top + height <= brow + 0.02,
      `${base} + ${cap}: brim stays off the eyes (bottom ${(top + height).toFixed(4)} vs brow ${brow})`,
    );
    assert(left >= 0 && left + width <= 1, `${base} + ${cap}: stays within the canvas horizontally`);
  }
}
assert(capLayout("adult-woman-01", "cap-none") === null, "an unmeasured cap draws nothing rather than a misplaced one");

// --- G. Render layers keep the z-order and carry their artwork --------------
{
  const layers = avatarRenderLayers({
    base: "adult-man-01",
    outfit: "street-noche",
    cap: "cap-ink",
    pet: "pet-golden",
  });
  deepStrictEqual(layers.map((l) => l.slot), ["base", "outfit", "cap", "pet"]);
  assert(true, "render layers keep base < outfit < cap < pet");
  assert(layers.every((l, i) => i === 0 || l.z > layers[i - 1].z), "render layers are strictly z-ordered");
  const bySlot = Object.fromEntries(layers.map((l) => [l.slot, l]));
  assert(bySlot.outfit.src === "/avatars/adult-man-01/street-noche.png", "the outfit layer carries the figure sheet");
  assert(bySlot.cap.src === "/avatars/caps/cap-ink.png", "the cap layer carries the cap art");
  assert(bySlot.cap.place === "head" && bySlot.pet.place === "feet", "cap lands on the head, pet at the feet");
  assert(bySlot.pet.src === null, "pet artwork comes from the cosmetics catalog, not this module");
}

// --- H. A pre-avatar player still resolves to a full loadout ---------------
deepStrictEqual(loadoutFor(undefined), defaultLoadout());
deepStrictEqual(loadoutFor({}), defaultLoadout());
assert(true, "players who predate the avatar fields fall back to the default loadout");
deepStrictEqual(loadoutFor({ avatarBase: "adult-man-01", equippedCap: "cap-curva", equippedPet: "pet-tabby" }), {
  base: "adult-man-01",
  outfit: "street-default",
  cap: "cap-curva",
  pet: "pet-tabby",
});
assert(true, "saved fields win, missing ones fall back");

// --- I. The store states the no-real-money promise --------------------------
const i18nSrc = readFileSync(join(ROOT, "lib/i18n.ts"), "utf8");
const shopSrc = readFileSync(join(ROOT, "app/shop/page.tsx"), "utf8");
assert(
  i18nSrc.includes("No real money · Earned through learning."),
  'i18n carries the exact string "No real money · Earned through learning."',
);
assert(
  /shopNoRealMoney:\s*\{[^}]*es:\s*"[^"]*dinero real[^"]*"/i.test(i18nSrc) &&
    /shopNoRealMoney:\s*\{[^}]*aprend/i.test(i18nSrc),
  "the Spanish rendering says no real money, earned by learning",
);
assert(shopSrc.includes('t("shopNoRealMoney"'), "the shop page renders the promise through t()");
assert(shopSrc.includes("AvatarPreview"), "the shop page mounts the learner's avatar preview");

console.log(`avatar: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
