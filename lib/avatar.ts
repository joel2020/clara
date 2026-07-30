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

/** The saved cosmetic fields a loadout is read from (a PlayerStats subset —
 *  structural on purpose, so this module keeps no import of the db layer). */
export interface PlayerAvatarFields {
  avatarBase?: AvatarBase;
  equippedAvatarOutfit?: string;
  equippedCap?: string;
  equippedPet?: string;
}

/** Read a player's loadout, filling every missing field from defaultLoadout(). */
export function loadoutFor(player: PlayerAvatarFields | null | undefined): AvatarLoadout {
  const d = defaultLoadout();
  return {
    base: player?.avatarBase ?? d.base,
    outfit: player?.equippedAvatarOutfit ?? d.outfit,
    cap: player?.equippedCap ?? d.cap,
    pet: player?.equippedPet ?? d.pet,
  };
}

// ── Artwork: where the layers live, and how they line up ─────────────────────
//
// Figure sheets are authored full-bleed on ONE canvas, so an outfit needs no
// placement at all. Caps and pets are trimmed sprites of their own, and where
// they land is the whole problem: the two bases are different people, framed
// differently. So each base declares, in normalized 0..1 fractions of the
// canvas, where a cap's brow line sits and where a companion's feet touch the
// ground. Percentages, never pixels — the stage keeps the canvas aspect ratio,
// so the same numbers are correct at 160px and at 400px.
//
// Every value below was measured from the alpha channel of the shipped
// artwork and then confirmed by eye across all base x cap combinations. They
// describe the art; they are not a target the art is expected to hit.

/** The shared authoring canvas every figure sheet is exported at. */
export const AVATAR_CANVAS = { width: 864, height: 1184 } as const;

/**
 * Where the equipment slots land on one base, as fractions of the canvas (x
 * and width of its width, y of its height).
 *
 * A pet is anchored by its bottom edge on petBaselineY, the ground line it
 * stands on. A cap needs more than one number, because the catalog mixes view
 * angles — see CAP_ANCHORS below.
 */
export interface AvatarAnchors {
  capWidth: number;
  capCenterX: number;
  /** The brow line: every cap's own head opening is landed here. */
  capBrowY: number;
  petWidth: number;
  petCenterX: number;
  /** The ground line: a companion's bottom edge sits here. */
  petBaselineY: number;
  /**
   * The figure's own vertical extent — the safe area. The headroom above
   * figureTopY is what a tall crown grows into without leaving the canvas,
   * and feetY is the floor everything shares. A contain-fit stage that keeps
   * the canvas aspect ratio therefore cannot clip any layer.
   */
  figureTopY: number;
  feetY: number;
}

/** Per-base geometry, measured from the artwork. The man base is framed a
 *  little smaller in the canvas, so his cap reads narrower and his ground line
 *  sits higher. */
export const AVATAR_ANCHORS: Record<AvatarBase, AvatarAnchors> = {
  "adult-woman-01": {
    capWidth: 0.155,
    capCenterX: 0.5023,
    capBrowY: 0.1105,
    petWidth: 0.24,
    petCenterX: 0.66,
    petBaselineY: 0.952,
    figureTopY: 0.0574,
    feetY: 0.9519,
  },
  "adult-man-01": {
    capWidth: 0.138,
    capCenterX: 0.5,
    capBrowY: 0.1225,
    petWidth: 0.24,
    petCenterX: 0.66,
    petBaselineY: 0.93,
    figureTopY: 0.0878,
    feetY: 0.9299,
  },
};

/**
 * Per-cap art metadata. The catalog mixes view angles — the sprites run from
 * 1.03 (a near-front elevation) to 1.46 (a three-quarter view) wide — so a
 * sprite's bottom edge is NOT a shared reference: on a front elevation the
 * brim hangs well below the head opening, and anchoring the sprite bottom to
 * the brow line pushes the crown off the top of the canvas.
 *
 * headOpeningY is where the cap actually meets the head, as a fraction of
 * that sprite's OWN height. It was measured as the lowest opaque row within
 * the outer 12% of columns on each side: the brim protrudes from the centre,
 * while the left and right edges of a cap stop exactly at the head opening.
 */
export interface CapArt {
  /** Sprite width / height. */
  aspect: number;
  /** The head opening, as a fraction of the sprite's own height. */
  headOpeningY: number;
}

export const CAP_ANCHORS: Record<AvatarCap, CapArt> = {
  "cap-curva": { aspect: 1.388, headOpeningY: 0.9322 },
  "cap-dos-tonos": { aspect: 1.219, headOpeningY: 0.831 },
  "cap-grafico": { aspect: 1.14, headOpeningY: 0.9955 },
  "cap-ink": { aspect: 1.032, headOpeningY: 0.996 },
  "cap-medellin-atardecer": { aspect: 1.347, headOpeningY: 0.9105 },
  "cap-medellin-verde": { aspect: 1.459, headOpeningY: 0.8632 },
};

/** A cap's box on the canvas, in normalized 0..1 fractions. */
export interface CapLayout {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Place one cap on one base: size it to the base's head width, then slide it
 * so the cap's own head opening lands on that base's brow line. Returns null
 * for a cap with no art metadata (the empty slot, or an item added to the
 * catalog before its sprite was measured) — the compositor then draws no cap
 * rather than a misplaced one.
 */
export function capLayout(base: AvatarBase, cap: AvatarCap): CapLayout | null {
  const art = CAP_ANCHORS[cap];
  if (!art) return null;
  const anchors = AVATAR_ANCHORS[base];
  const width = anchors.capWidth;
  const height = (width * (AVATAR_CANVAS.width / AVATAR_CANVAS.height)) / art.aspect;
  return {
    left: anchors.capCenterX - width / 2,
    top: anchors.capBrowY - height * art.headOpeningY,
    width,
    height,
  };
}

/**
 * The figure sheet: a base wearing one outfit, at
 * `/avatars/<base>/<outfit>.png`. The body and the clothes are one drawing —
 * the base picks the folder, the outfit picks the file — so an outfit can
 * change a silhouette without a bare body showing through underneath.
 */
export function avatarFigureSrc(base: AvatarBase, outfit: string): string {
  return `/avatars/${base}/${outfit}.png`;
}

/** A baseball cap, at `/avatars/caps/<cap>.png` — a trimmed sprite, one file
 *  for both bases, placed by each base's cap anchor. */
export function avatarCapSrc(cap: AvatarCap): string {
  return `/avatars/caps/${cap}.png`;
}

/** How a layer is placed: over the whole canvas, on the head, or at the feet. */
export type AvatarPlacement = "canvas" | "head" | "feet";

export interface AvatarRenderLayer extends AvatarLayer {
  /**
   * The PNG to draw, or null when the slot has no art of its own: the base's
   * body is drawn by the figure sheet, and a pet's artwork comes from the
   * cosmetics catalog (which this module deliberately does not import).
   */
  src: string | null;
  place: AvatarPlacement;
}

/**
 * composeAvatarLayers() plus the artwork each layer needs — same order, same
 * z values, still pure. This is everything a compositor has to know.
 */
export function avatarRenderLayers(loadout: AvatarLoadout): AvatarRenderLayer[] {
  return composeAvatarLayers(loadout).map((layer) => {
    switch (layer.slot) {
      case "outfit":
        return { ...layer, src: avatarFigureSrc(loadout.base, layer.id), place: "canvas" };
      case "cap":
        return { ...layer, src: avatarCapSrc(layer.id), place: "head" };
      case "pet":
        return { ...layer, src: null, place: "feet" };
      default:
        return { ...layer, src: null, place: "canvas" };
    }
  });
}
