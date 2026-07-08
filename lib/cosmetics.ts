import { repo } from "@/lib/db";
import { dayKey } from "@/lib/gamification";
import type { PlayerStats } from "@/lib/db/types";

// The star shop: cosmetics Lumi can wear, bought with the stars earned from
// clear answers. This is the "spend → collect" half of the game loop. Everything
// here is cosmetic (backgrounds, props, ambient effects) and rendered in-app, so
// it costs nothing to run and can grow freely.

export type CosmeticType = "background" | "accessory" | "effect";
export type EffectKind = "hearts" | "petals" | "sparkle" | "snow" | "confetti";

export interface Cosmetic {
  id: string;
  type: CosmeticType;
  name: { es: string; en: string };
  cost: number; // in stars; free items have cost 0
  free?: boolean; // always owned, the default for its slot
  /** For backgrounds: a CSS `background` value. */
  background?: string;
  /** For accessories: an emoji prop shown near Lumi. */
  emoji?: string;
  /** For effects: the ambient particle kind. */
  effect?: EffectKind;
}

export const COSMETICS: Cosmetic[] = [
  // ── Backgrounds ──
  {
    id: "bg-default",
    type: "background",
    name: { es: "Fiesta tricolor", en: "Tricolor party" },
    cost: 0,
    free: true,
    background:
      "radial-gradient(120% 120% at 8% 0%, #ffe08a 0%, transparent 46%), radial-gradient(130% 120% at 100% 100%, #ffb3a1 0%, transparent 52%), linear-gradient(140deg, #cfd9f5 0%, #fdeecb 100%)",
  },
  {
    id: "bg-sunset",
    type: "background",
    name: { es: "Atardecer", en: "Sunset" },
    cost: 20,
    background: "linear-gradient(160deg, #ffd194 0%, #ff9a8b 45%, #d76d9a 100%)",
  },
  {
    id: "bg-ocean",
    type: "background",
    name: { es: "Mar Caribe", en: "Caribbean sea" },
    cost: 20,
    background: "linear-gradient(160deg, #a8edea 0%, #6dd5ed 55%, #2193b0 100%)",
  },
  {
    id: "bg-candy",
    type: "background",
    name: { es: "Algodón de azúcar", en: "Cotton candy" },
    cost: 30,
    background: "linear-gradient(160deg, #fbc2eb 0%, #c9a7f5 55%, #a6c1ee 100%)",
  },
  {
    id: "bg-jungle",
    type: "background",
    name: { es: "Selva", en: "Jungle" },
    cost: 30,
    background: "linear-gradient(160deg, #d4fc79 0%, #7ad18f 50%, #2eae7d 100%)",
  },
  {
    id: "bg-galaxy",
    type: "background",
    name: { es: "Galaxia", en: "Galaxy" },
    cost: 50,
    background:
      "radial-gradient(90% 90% at 30% 20%, #6a3ea1 0%, transparent 60%), radial-gradient(80% 80% at 80% 80%, #b0468b 0%, transparent 55%), linear-gradient(160deg, #1b1044 0%, #2b1b6b 100%)",
  },

  // ── Accessories (props near Lumi) ──
  { id: "acc-none", type: "accessory", name: { es: "Ninguno", en: "None" }, cost: 0, free: true },
  { id: "acc-flower", type: "accessory", name: { es: "Flor", en: "Flower" }, cost: 15, emoji: "🌸" },
  { id: "acc-cat", type: "accessory", name: { es: "Gatico", en: "Kitty" }, cost: 25, emoji: "🐱" },
  { id: "acc-balloons", type: "accessory", name: { es: "Globos", en: "Balloons" }, cost: 30, emoji: "🎈" },
  { id: "acc-butterfly", type: "accessory", name: { es: "Mariposa", en: "Butterfly" }, cost: 30, emoji: "🦋" },
  { id: "acc-crown", type: "accessory", name: { es: "Corona", en: "Crown" }, cost: 60, emoji: "👑" },

  // ── Ambient effects ──
  { id: "fx-none", type: "effect", name: { es: "Ninguno", en: "None" }, cost: 0, free: true },
  { id: "fx-hearts", type: "effect", name: { es: "Corazones", en: "Hearts" }, cost: 20, effect: "hearts" },
  { id: "fx-petals", type: "effect", name: { es: "Pétalos", en: "Petals" }, cost: 20, effect: "petals" },
  { id: "fx-sparkle", type: "effect", name: { es: "Destellos", en: "Sparkles" }, cost: 35, effect: "sparkle" },
  { id: "fx-snow", type: "effect", name: { es: "Nieve", en: "Snow" }, cost: 25, effect: "snow" },
];

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function getCosmetic(id: string | undefined): Cosmetic | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function cosmeticsByType(type: CosmeticType): Cosmetic[] {
  return COSMETICS.filter((c) => c.type === type);
}

export function isOwned(player: Pick<PlayerStats, "ownedCosmetics">, id: string): boolean {
  const c = BY_ID.get(id);
  return !!c && (c.free === true || (player.ownedCosmetics ?? []).includes(id));
}

/** The equipped-slot field name for a cosmetic type. */
function slotFor(type: CosmeticType): "equippedBg" | "equippedAccessory" | "equippedEffect" {
  return type === "background" ? "equippedBg" : type === "accessory" ? "equippedAccessory" : "equippedEffect";
}

export interface BuyResult {
  ok: boolean;
  reason?: "owned" | "insufficient" | "unknown";
}

/** Spend stars to buy a cosmetic, then equip it. No-op if already owned (just equips). */
export async function buyCosmetic(id: string): Promise<BuyResult> {
  const c = BY_ID.get(id);
  if (!c) return { ok: false, reason: "unknown" };
  const player = await repo.getPlayerStats();
  if (isOwned(player, id)) {
    await equipCosmetic(id);
    return { ok: true, reason: "owned" };
  }
  if ((player.stars ?? 0) < c.cost) return { ok: false, reason: "insufficient" };
  await repo.savePlayerStats({
    ...player,
    stars: player.stars - c.cost,
    ownedCosmetics: [...player.ownedCosmetics, id],
    [slotFor(c.type)]: id,
    updatedAt: Date.now(),
  });
  return { ok: true };
}

/** Equip an already-owned cosmetic in its slot. */
export async function equipCosmetic(id: string): Promise<void> {
  const c = BY_ID.get(id);
  if (!c) return;
  const player = await repo.getPlayerStats();
  if (!isOwned(player, id)) return;
  await repo.savePlayerStats({ ...player, [slotFor(c.type)]: id, updatedAt: Date.now() });
}

// ── Daily reward chest ───────────────────────────────────────────────────────

export function chestAvailable(player: Pick<PlayerStats, "lastChestDay">): boolean {
  return player.lastChestDay !== dayKey();
}

/** Today's chest reward: a base plus a little more the longer the streak. */
export function chestReward(player: Pick<PlayerStats, "currentStreak">): number {
  return 8 + Math.min(player.currentStreak, 7);
}

/** Open today's chest (idempotent per day). Returns the stars awarded, or 0 if already opened. */
export async function openChest(): Promise<number> {
  const player = await repo.getPlayerStats();
  if (!chestAvailable(player)) return 0;
  const reward = chestReward(player);
  await repo.savePlayerStats({
    ...player,
    stars: (player.stars ?? 0) + reward,
    lastChestDay: dayKey(),
    updatedAt: Date.now(),
  });
  return reward;
}
