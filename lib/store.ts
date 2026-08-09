import type { Cosmetic, CosmeticType, UnlockRule } from "./cosmetics.ts";
import type { PlayerStats } from "./db/types.ts";
import { levelForXp } from "./gamification.ts";

// The store's pure state layer. Everything here is a function of (catalog item,
// player snapshot) — no repo access, no clock reads, no mutation — so the UI
// can derive every card's state and quote every purchase for an explicit
// confirmation, while the authoritative spend stays in lib/cosmetics.ts
// (buyCosmetic → repo.savePlayerStats → cloud mirror). Imports are type-only or
// pure on purpose: this module must stay runnable in plain node tests.

export const STORE_CATEGORIES: { type: CosmeticType; label: { es: string; en: string } }[] = [
  { type: "avatar-outfit", label: { es: "Tu look", en: "Your look" } },
  { type: "cap", label: { es: "Gorras", en: "Caps" } },
  { type: "outfit", label: { es: "Estilos clásicos", en: "Classic looks" } },
  { type: "pet", label: { es: "Mascotas", en: "Pets" } },
  { type: "background", label: { es: "Fondos", en: "Backgrounds" } },
  { type: "accessory", label: { es: "Accesorios", en: "Accessories" } },
  { type: "effect", label: { es: "Ambientes", en: "Effects" } },
];

export type SlotKey =
  | "equippedBg"
  | "equippedAccessory"
  | "equippedEffect"
  | "equippedPet"
  | "equippedOutfit"
  | "equippedAvatarOutfit"
  | "equippedCap";

const SLOT_FOR: Record<CosmeticType, SlotKey> = {
  background: "equippedBg",
  accessory: "equippedAccessory",
  effect: "equippedEffect",
  pet: "equippedPet",
  outfit: "equippedOutfit",
  "avatar-outfit": "equippedAvatarOutfit",
  cap: "equippedCap",
};

export function slotFor(type: CosmeticType): SlotKey {
  return SLOT_FOR[type];
}

/** The free default look for every slot — what "restaurar" returns to. */
export const DEFAULT_FOR_SLOT: Record<CosmeticType, string> = {
  background: "bg-default",
  accessory: "acc-none",
  effect: "fx-none",
  pet: "pet-none",
  outfit: "outfit-default",
  "avatar-outfit": "street-default",
  cap: "cap-none",
};

type PlayerSnapshot = Pick<PlayerStats, "xp" | "stars" | "ownedCosmetics"> &
  Partial<
    Pick<
      PlayerStats,
      "equippedBg" | "equippedAccessory" | "equippedEffect" | "equippedPet" | "equippedOutfit" | "equippedAvatarOutfit" | "equippedCap"
    >
  >;

export type ItemStatus = "equipped" | "owned" | "available" | "locked";

export interface ItemState {
  status: ItemStatus;
  /** Whether the current balance covers the price (reported for every status). */
  affordable: boolean;
  /** Why a locked item is locked — level gate or availability window. */
  lockedReason?: { type: "level"; level: number } | { type: "window"; from?: number; until?: number };
}

function owned(c: Cosmetic, player: PlayerSnapshot): boolean {
  return Boolean(c.free) || (player.ownedCosmetics ?? []).includes(c.id);
}

/**
 * Derive one item's card state. Precedence: equipped > owned > locked >
 * available — ownership always wins over a lock, so adding a level gate or
 * closing a seasonal window can never take an item away from a learner who
 * already earned it.
 */
export function itemState(
  c: Cosmetic,
  player: PlayerSnapshot,
  opts: { now?: number } = {},
): ItemState {
  const affordable = (player.stars ?? 0) >= c.cost;
  const equippedId = player[slotFor(c.type)] ?? DEFAULT_FOR_SLOT[c.type];
  if (equippedId === c.id) return { status: "equipped", affordable };
  if (owned(c, player)) return { status: "owned", affordable };

  if (c.unlockLevel && levelForXp(player.xp ?? 0) < c.unlockLevel) {
    return { status: "locked", affordable, lockedReason: { type: "level", level: c.unlockLevel } };
  }
  const now = opts.now ?? Date.now();
  if ((c.availableFrom && now < c.availableFrom) || (c.availableUntil && now > c.availableUntil)) {
    return {
      status: "locked",
      affordable,
      lockedReason: { type: "window", from: c.availableFrom, until: c.availableUntil },
    };
  }
  return { status: "available", affordable };
}

export interface PurchaseQuote {
  cost: number;
  balance: number;
  /** Balance after the purchase (never negative in the sufficient case). */
  after: number;
  sufficient: boolean;
  /** How many stars are missing when insufficient. */
  shortfall: number;
}

export interface ClosetEligibility {
  level: number;
  completedDailySessions: number;
  unlockedMilestones: string[];
}

export function closetEligibility(
  stats: Pick<PlayerStats, "xp" | "completedDailySessions" | "unlockedMilestones">,
): ClosetEligibility {
  return {
    level: levelForXp(stats.xp ?? 0),
    completedDailySessions: stats.completedDailySessions ?? 0,
    unlockedMilestones: stats.unlockedMilestones ?? [],
  };
}

function ruleSatisfied(rule: UnlockRule | undefined, eligibility: ClosetEligibility): boolean {
  if (!rule || rule.type === "none") return true;
  if (rule.type === "level") return eligibility.level >= rule.level;
  if (rule.type === "completed-daily-sessions") {
    return eligibility.completedDailySessions >= rule.count;
  }
  return eligibility.unlockedMilestones.includes(rule.id);
}

export type ClosetActionQuote =
  | { status: "equip"; cost: 0; balanceAfter: number }
  | { status: "buy"; cost: number; balanceAfter?: number }
  | { status: "locked"; cost: number };

/** Pure preview/confirmation state for one City Remix look. */
export function quoteClosetAction(input: {
  cosmetic: Cosmetic;
  stats: Pick<PlayerStats, "stars" | "ownedCosmetics" | "equippedOutfit">;
  eligibility: ClosetEligibility;
}): ClosetActionQuote {
  const { cosmetic, stats, eligibility } = input;
  const balance = Math.max(0, stats.stars ?? 0);
  const alreadyOwned = Boolean(cosmetic.free)
    || (stats.ownedCosmetics ?? []).includes(cosmetic.id)
    || stats.equippedOutfit === cosmetic.id;
  if (alreadyOwned) return { status: "equip", cost: 0, balanceAfter: balance };
  if (!ruleSatisfied(cosmetic.unlockRule, eligibility)) {
    return { status: "locked", cost: cosmetic.cost };
  }
  if (cosmetic.cost === 0) return { status: "equip", cost: 0, balanceAfter: balance };
  return balance >= cosmetic.cost
    ? { status: "buy", cost: cosmetic.cost, balanceAfter: balance - cosmetic.cost }
    : { status: "buy", cost: cosmetic.cost };
}

export type ClosetApplyResult = {
  status: "applied" | "equipped" | "locked" | "insufficient";
  stats: PlayerStats;
};

/** The one pure state transition used by persistence; never permits debt. */
export function applyClosetAction(input: {
  cosmetic: Cosmetic;
  stats: PlayerStats;
  at: number;
}): ClosetApplyResult {
  const { cosmetic, stats, at } = input;
  const quote = quoteClosetAction({
    cosmetic,
    stats,
    eligibility: closetEligibility(stats),
  });
  if (quote.status === "locked") return { status: "locked", stats };
  if (quote.status === "buy" && quote.balanceAfter === undefined) {
    return { status: "insufficient", stats };
  }
  const alreadyOwned = Boolean(cosmetic.free) || stats.ownedCosmetics.includes(cosmetic.id);
  const next: PlayerStats = {
    ...stats,
    stars: quote.status === "buy" ? quote.balanceAfter! : stats.stars,
    ownedCosmetics: alreadyOwned ? stats.ownedCosmetics : [...stats.ownedCosmetics, cosmetic.id],
    [slotFor(cosmetic.type)]: cosmetic.id,
    updatedAt: Math.max(stats.updatedAt, at),
  };
  return {
    status: alreadyOwned ? "equipped" : "applied",
    stats: next,
  };
}

/** The numbers a confirmation dialog shows before any star is spent. Pure. */
export function quotePurchase(c: Cosmetic, player: Pick<PlayerStats, "stars">): PurchaseQuote {
  const balance = player.stars ?? 0;
  const sufficient = balance >= c.cost;
  return {
    cost: c.cost,
    balance,
    after: balance - c.cost,
    sufficient,
    shortfall: sufficient ? 0 : c.cost - balance,
  };
}
