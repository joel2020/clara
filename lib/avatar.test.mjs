// node lib/avatar.test.mjs
//
// Adult learner-avatar model gate. Covers: both bases share one unrestricted
// catalog, layer composition is deterministic and z-ordered, and the loadout
// stays purely cosmetic — no field of it can reach assessment, difficulty, or
// access. The persistence side (equippedCap etc. on PlayerStats) is covered by
// lib/store.test.mjs; this file is only the pure model.
import { deepStrictEqual } from "node:assert";

let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

const { AVATAR_BASES, composeAvatarLayers, defaultLoadout } = await import("./avatar.ts");

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

console.log(`avatar: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
