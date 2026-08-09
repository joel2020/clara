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
  for (const t of ["outfit", "pet", "background", "accessory", "effect", "avatar-outfit", "cap"]) {
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
  assert(DEFAULT_FOR_SLOT?.["avatar-outfit"] === "street-default", "default avatar outfit is street-default");
  assert(DEFAULT_FOR_SLOT?.cap === "cap-none", "default cap is cap-none");

  // Slot mapping (single source of truth, re-exported to cosmetics.ts).
  assert(slotFor("background") === "equippedBg", "slotFor background");
  assert(slotFor("outfit") === "equippedOutfit", "slotFor outfit");
  assert(slotFor("avatar-outfit") === "equippedAvatarOutfit", "slotFor avatar-outfit");
  assert(slotFor("cap") === "equippedCap", "slotFor cap");

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

  // --- B2. Avatar cap/outfit slots stay compatible with existing players ---
  // A player saved before the avatar fields existed carries no equippedCap or
  // equippedAvatarOutfit key — the free defaults must read as equipped, so
  // nothing looks taken away and no migration is needed.
  const legacy = basePlayer();
  assert(itemState(item({ id: "cap-none", type: "cap", cost: 0, free: true }), legacy).status === "equipped",
    "a pre-avatar player reads cap-none as equipped (non-destructive default)");
  assert(itemState(item({ id: "street-default", type: "avatar-outfit", cost: 0, free: true }), legacy).status === "equipped",
    "a pre-avatar player reads street-default as equipped");
  assert(itemState(item({ id: "cap-ink", type: "cap", cost: 60 }), legacy).status === "available",
    "caps flow through the same itemState machinery as every other slot");
  const capQuote = quotePurchase(item({ id: "cap-ink", type: "cap", cost: 60 }), legacy);
  assert(capQuote.sufficient === true && capQuote.after === 40,
    "caps are priced in earned stars like everything else (no other currency)");

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

// --- D. Closet lives under Yo, not primary navigation -----------------------
const mobileNav = readFileSync(join(ROOT, "components/mobile-nav.tsx"), "utf8");
assert(!/navTienda/.test(mobileNav), "mobile tab bar has no store destination");
assert(/grid-cols-4/.test(mobileNav), "mobile tab bar has exactly four spaces");
const header = readFileSync(join(ROOT, "components/site-header.tsx"), "utf8");
assert(!/navTienda/.test(header), "desktop primary navigation has no store destination");
const profile = readFileSync(join(ROOT, "app/profile/page.tsx"), "utf8");
assert(/href="\/shop"/.test(profile), "Yo links to Lumi's Closet");
const i18n = readFileSync(join(ROOT, "lib/i18n.ts"), "utf8");
assert(/navTienda/.test(i18n), "i18n defines navTienda");

// --- E. Purchase safety in the shop UI -------------------------------------
const shop = readFileSync(join(ROOT, "app/shop/page.tsx"), "utf8");
assert(/buyCosmetic\(/.test(shop), "the shop still purchases through the authoritative buyCosmetic path");
assert(/Dialog/.test(shop), "purchases go through an explicit confirmation dialog");
assert(/shopInsufficient/.test(shop), "insufficient balance gets explicit feedback");
assert(/shopRestoreDefault|DEFAULT_FOR_SLOT/.test(shop), "each slot can be reset to its default look");
assert(!/🎁/.test(shop), "no emoji in shop chrome (drawn icons only)");

// --- F. Original baseball-cap and avatar-outfit catalog --------------------
const cosmeticsSrc = readFileSync(join(ROOT, "lib/cosmetics.ts"), "utf8");
for (const id of [
  "cap-none", "cap-ink", "cap-dos-tonos", "cap-curva", "cap-grafico",
  "cap-medellin-verde", "cap-medellin-atardecer", "street-default",
]) {
  assert(cosmeticsSrc.includes(`id: "${id}"`), `catalog has ${id}`);
}
assert(/id: "cap-none",.*free: true/.test(cosmeticsSrc), "cap-none is the free default");
assert(/id: "street-default",.*free: true/.test(cosmeticsSrc), "street-default is the free default");
// Original designs only — no copied sports-team or fashion-brand marks.
assert(!/nike|adidas|puma|yankees|dodgers|gucci|supreme|lacoste|atl[eé]tico nacional|independiente medell/i.test(cosmeticsSrc),
  "no team or fashion-brand names anywhere in the catalog");

// --- Every catalog image must actually exist -------------------------------
// A cosmetic pointing at a missing file degrades to a blank tile in the shop
// and nothing fails, so a learner can buy something that renders as nothing.
{
  const { existsSync } = await import("node:fs");
  const images = [...cosmeticsSrc.matchAll(/image:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert(images.length > 0, "the catalog declares image-backed cosmetics");
  for (const rel of images) {
    assert(existsSync(join(ROOT, "public", rel)), `catalog art exists on disk (${rel})`);
  }
  // Videos are referenced without an extension; check the poster that proves
  // the set was produced.
  const videos = [...cosmeticsSrc.matchAll(/video:\s*"([^"]+)"/g)].map((m) => m[1]);
  for (const rel of videos) {
    assert(existsSync(join(ROOT, "public", `${rel}-poster.jpg`)), `scene poster exists on disk (${rel})`);
    assert(existsSync(join(ROOT, "public", `${rel}.mp4`)), `scene mp4 exists on disk (${rel})`);
  }
}

console.log(`store: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
