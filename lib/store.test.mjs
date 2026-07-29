// node lib/store.test.mjs
//
// Store behavior gate, written before the store elevation (red-first).
// Covers: the pure state layer (lib/store.ts), Tienda navigation, and the
// shop page's purchase-safety structure. The authoritative persistence path
// (buyCosmetic/equipCosmetic in lib/cosmetics.ts, mirrored to the cloud by
// repo.savePlayerStats) is deliberately NOT reimplemented — the UI must keep
// calling it, and the client-side state layer must stay pure and mutation-free.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

// --- A. The pure store state module exists ---------------------------------
let store = null;
try {
  store = await import("./store.ts");
} catch {
  /* red until lib/store.ts exists */
}
assert(store, "lib/store.ts exists (pure state layer, no repo import)");

const basePlayer = () => ({
  xp: 0,
  stars: 100,
  ownedCosmetics: [],
  equippedBg: "bg-default",
  equippedAccessory: "acc-none",
  equippedEffect: "fx-none",
  equippedPet: "pet-none",
  equippedOutfit: "outfit-default",
});
const item = (over = {}) => ({
  id: "test-item",
  type: "accessory",
  name: { es: "Prueba", en: "Test" },
  cost: 40,
  ...over,
});

if (store) {
  const { STORE_CATEGORIES, DEFAULT_FOR_SLOT, itemState, quotePurchase, slotFor } = store;

  // Categories cover every cosmetic type, with bilingual labels.
  const types = (STORE_CATEGORIES ?? []).map((c) => c.type);
  for (const t of ["outfit", "pet", "background", "accessory", "effect"]) {
    assert(types.includes(t), `STORE_CATEGORIES includes ${t}`);
  }
  for (const c of STORE_CATEGORIES ?? []) {
    assert(c.label?.es && c.label?.en, `category ${c.type} has bilingual labels`);
  }

  // Every slot has a free default the UI can reset to.
  assert(DEFAULT_FOR_SLOT?.background === "bg-default", "default background is bg-default");
  assert(DEFAULT_FOR_SLOT?.accessory === "acc-none", "default accessory is acc-none");
  assert(DEFAULT_FOR_SLOT?.effect === "fx-none", "default effect is fx-none");
  assert(DEFAULT_FOR_SLOT?.pet === "pet-none", "default pet is pet-none");
  assert(DEFAULT_FOR_SLOT?.outfit === "outfit-default", "default outfit is outfit-default");

  // Slot mapping (single source of truth, re-exported to cosmetics.ts).
  assert(slotFor("background") === "equippedBg", "slotFor background");
  assert(slotFor("outfit") === "equippedOutfit", "slotFor outfit");

  // --- B. itemState derivation ---------------------------------------------
  // Precedence: equipped > owned > locked > available.
  const p = basePlayer();
  assert(itemState(item({ id: "acc-none", cost: 0, free: true }), p).status === "equipped",
    "the equipped free default reads as equipped");
  assert(itemState(item(), { ...p, ownedCosmetics: ["test-item"] }).status === "owned",
    "an owned, unequipped item reads as owned");
  assert(itemState(item({ free: true }), p).status === "owned",
    "free items are always owned");
  assert(itemState(item(), p).status === "available", "a purchasable item reads as available");

  // Level gating: unlockLevel counts against the level derived from xp.
  const gated = item({ unlockLevel: 3 });
  const s1 = itemState(gated, p); // xp 0 => level 1
  assert(s1.status === "locked" && s1.lockedReason?.type === "level" && s1.lockedReason.level === 3,
    "an item above the player's level is locked with a level reason");
  assert(itemState(gated, { ...p, xp: 999 }).status === "available",
    "the same item unlocks once the level is reached");
  assert(itemState(gated, { ...p, ownedCosmetics: ["test-item"] }).status === "owned",
    "an already-owned item never re-locks (existing users keep their inventory)");

  // Availability windows (seasonal), driven by an explicit `now`.
  const seasonal = item({ availableFrom: 100, availableUntil: 200 });
  assert(itemState(seasonal, p, { now: 150 }).status === "available", "inside the window: available");
  assert(itemState(seasonal, p, { now: 50 }).status === "locked", "before the window: locked");
  assert(itemState(seasonal, p, { now: 250 }).status === "locked", "after the window: locked");
  assert(itemState(seasonal, { ...p, ownedCosmetics: ["test-item"] }, { now: 250 }).status === "owned",
    "a seasonal item stays owned after its window closes");

  // Affordability is reported without gating the state.
  assert(itemState(item({ cost: 500 }), p).affordable === false, "unaffordable is reported");
  assert(itemState(item({ cost: 40 }), p).affordable === true, "affordable is reported");

  // --- C. quotePurchase: explicit confirmation math, pure ------------------
  const frozen = Object.freeze({ ...basePlayer(), ownedCosmetics: Object.freeze([]) });
  const q = quotePurchase(item({ cost: 40 }), frozen);
  assert(q.cost === 40 && q.balance === 100 && q.after === 60 && q.sufficient === true,
    "quote reports cost/balance/after for the confirmation dialog");
  const q2 = quotePurchase(item({ cost: 500 }), frozen);
  assert(q2.sufficient === false && q2.shortfall === 400,
    "an insufficient quote reports the shortfall");
  assert(frozen.stars === 100 && frozen.ownedCosmetics.length === 0,
    "quoting never mutates the player (frozen fixture unchanged)");
}

// --- D. Tienda is a first-class destination --------------------------------
const mobileNav = readFileSync(join(ROOT, "components/mobile-nav.tsx"), "utf8");
assert(/href:\s*"\/shop"/.test(mobileNav), "mobile tab bar has a /shop destination");
assert(/navTienda/.test(mobileNav), "mobile tab bar labels the store with navTienda");
const header = readFileSync(join(ROOT, "components/site-header.tsx"), "utf8");
assert(/"\/shop"/.test(header), "desktop header links /shop");
const i18n = readFileSync(join(ROOT, "lib/i18n.ts"), "utf8");
assert(/navTienda/.test(i18n), "i18n defines navTienda");

// --- E. Purchase safety in the shop UI -------------------------------------
const shop = readFileSync(join(ROOT, "app/shop/page.tsx"), "utf8");
assert(/buyCosmetic\(/.test(shop), "the shop still purchases through the authoritative buyCosmetic path");
assert(/Dialog/.test(shop), "purchases go through an explicit confirmation dialog");
assert(/shopInsufficient/.test(shop), "insufficient balance gets explicit feedback");
assert(/shopRestoreDefault|DEFAULT_FOR_SLOT/.test(shop), "each slot can be reset to its default look");
assert(!/🎁/.test(shop), "no emoji in shop chrome (drawn icons only)");

console.log(`store: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
