// The learner's own avatar — an adult in their 20s, separate from Clara (the
// guide). This is the pure model layer: which base body is selected, what is
// equipped, and how the pieces stack into render layers. No repo access, no
// clock reads, no mutation — runnable in plain node tests, like lib/store.ts.
//
// Everything here is strictly cosmetic. A loadout carries appearance ids only;
// it can never hold (and must never grow) fields that touch level, difficulty,
// scoring, hints, assessment, or access. Both bases share one catalog: every
// cap, outfit, and pet equips on either base — nothing is gender-restricted.

/** The two adult base bodies. Same rendering standard, same catalog. */
export type AvatarBase = "adult-woman-01" | "adult-man-01";

export const AVATAR_BASES: AvatarBase[] = ["adult-woman-01", "adult-man-01"];

/** A baseball-cap catalog id (see lib/cosmetics.ts), e.g. "cap-ink". */
export type AvatarCap = string;

/** A pet catalog id (see lib/cosmetics.ts), e.g. "pet-golden". */
export type AvatarPet = string;

/**
 * What the learner's avatar is wearing. Appearance ids only — cosmetic by
 * construction. "cap-none" / "pet-none" (the free defaults from
 * DEFAULT_FOR_SLOT in lib/store.ts) mean the slot is empty.
 */
export interface AvatarLoadout {
  base: AvatarBase;
  /** Avatar outfit id, e.g. "street-default". Always rendered. */
  outfit: string;
  cap?: AvatarCap;
  pet?: AvatarPet;
}

export type AvatarSlot = "base" | "outfit" | "cap" | "pet";

/** One drawable layer: slot, the catalog id to draw, and its stacking order. */
export interface AvatarLayer {
  slot: AvatarSlot;
  id: string;
  z: number;
}

/** The empty-slot sentinels: equipping these draws nothing. */
const EMPTY_IDS = new Set(["cap-none", "pet-none"]);

function empty(id: string | undefined): boolean {
  return !id || EMPTY_IDS.has(id);
}

/**
 * Flatten a loadout into deterministic z-ordered layers: base, outfit, cap,
 * pet. The base is always first; empty slots after it are omitted. Pure — the
 * same loadout always yields the same layers, for either base.
 */
export function composeAvatarLayers(loadout: AvatarLoadout): AvatarLayer[] {
  const layers: AvatarLayer[] = [{ slot: "base", id: loadout.base, z: 0 }];
  if (!empty(loadout.outfit)) layers.push({ slot: "outfit", id: loadout.outfit, z: 1 });
  if (!empty(loadout.cap)) layers.push({ slot: "cap", id: loadout.cap!, z: 2 });
  if (!empty(loadout.pet)) layers.push({ slot: "pet", id: loadout.pet!, z: 3 });
  return layers;
}

/**
 * What a brand-new (or pre-avatar) player wears: the first base with the free
 * default look and empty cap/pet slots. Existing players who predate the
 * avatar fields resolve to exactly this — nothing is taken away and nothing
 * about their learning state changes.
 */
export function defaultLoadout(): AvatarLoadout {
  return { base: "adult-woman-01", outfit: "street-default", cap: "cap-none", pet: "pet-none" };
}
