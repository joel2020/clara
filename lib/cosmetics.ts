import { repo } from "@/lib/db";
import { dayKey } from "@/lib/gamification";
import type { PlayerStats } from "@/lib/db/types";

// The star shop: cosmetics Lumi can wear, bought with the stars earned from
// clear answers. This is the "spend → collect" half of the game loop. Everything
// here is cosmetic (backgrounds, props, ambient effects) and rendered in-app, so
// it costs nothing to run and can grow freely.

export type CosmeticType = "background" | "accessory" | "effect" | "pet";
export type EffectKind =
  | "hearts"
  | "petals"
  | "sparkle"
  | "snow"
  | "confetti"
  | "stars"
  | "bubbles"
  | "notes"
  | "leaves"
  | "rainbow"
  | "coins"
  | "diamonds"
  | "fireworks";

export interface Cosmetic {
  id: string;
  type: CosmeticType;
  name: { es: string; en: string };
  cost: number; // in stars; free items have cost 0
  free?: boolean; // always owned, the default for its slot
  /** Rare, premium items to chase — shown with a special badge and glow. */
  rarity?: "legendary";
  /** For backgrounds: a CSS `background` value. */
  background?: string;
  /** For accessories: an emoji prop shown near Lumi. */
  emoji?: string;
  /** For pets with real artwork: a sticker image path (preferred over emoji). */
  image?: string;
  /** For effects: the ambient particle kind. */
  effect?: EffectKind;
  /** For premium animated backgrounds: a <SceneVideo> base path (a cinematic
   *  loop plays as the stage, with the poster still as the fallback). */
  video?: string;
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
  {
    id: "bg-beach",
    type: "background",
    name: { es: "Playa", en: "Beach" },
    cost: 40,
    background: "linear-gradient(180deg, #8ed6ff 0%, #bfeaff 42%, #ffe7ba 58%, #ffd98a 100%)",
  },
  {
    id: "bg-meadow",
    type: "background",
    name: { es: "Pradera", en: "Flower meadow" },
    cost: 40,
    background: "linear-gradient(180deg, #bfe6ff 0%, #dff5c8 52%, #a8dd7a 100%)",
  },
  {
    id: "bg-rainbow",
    type: "background",
    name: { es: "Arcoíris", en: "Rainbow" },
    cost: 60,
    background: "linear-gradient(160deg, #fde9c8 0%, #f7c8e0 50%, #c9e0ff 100%)",
  },
  {
    id: "bg-night",
    type: "background",
    name: { es: "Noche estrellada", en: "Starry night" },
    cost: 80,
    background:
      "radial-gradient(80% 60% at 78% 18%, #3a5a9c 0%, transparent 55%), linear-gradient(170deg, #0f1a3d 0%, #243b6b 60%, #33528f 100%)",
  },
  {
    id: "bg-city",
    type: "background",
    name: { es: "Luces de ciudad", en: "City lights" },
    cost: 100,
    background: "linear-gradient(175deg, #2a1f4a 0%, #4a2f6b 55%, #8a4f9c 100%)",
  },
  {
    id: "bg-aurora",
    type: "background",
    name: { es: "Aurora boreal", en: "Northern lights" },
    cost: 200,
    rarity: "legendary",
    background:
      "radial-gradient(90% 70% at 30% 30%, rgba(60,220,160,0.35) 0%, transparent 55%), radial-gradient(80% 70% at 75% 40%, rgba(150,90,220,0.35) 0%, transparent 55%), linear-gradient(175deg, #071233 0%, #0d2149 60%, #123063 100%)",
  },
  {
    id: "bg-crystal",
    type: "background",
    name: { es: "Reino de cristal", en: "Crystal kingdom" },
    cost: 250,
    rarity: "legendary",
    background:
      "radial-gradient(80% 70% at 20% 10%, #d7f0ff 0%, transparent 55%), radial-gradient(90% 80% at 90% 90%, #e6c9ff 0%, transparent 55%), linear-gradient(160deg, #bfe3ff 0%, #d9c8ff 55%, #ffd7f0 100%)",
  },

  // ── Cinematic animated backgrounds (premium video loops) ──
  {
    id: "bg-medellin",
    type: "background",
    name: { es: "Atardecer en Medellín", en: "Medellín sunset" },
    cost: 300,
    rarity: "legendary",
    video: "/scenes/bg-home-medellin-16x9",
  },
  {
    id: "bg-cafe",
    type: "background",
    name: { es: "Café al sol", en: "Sunny café" },
    cost: 220,
    rarity: "legendary",
    video: "/scenes/loop-cafe-9x16",
  },
  {
    id: "bg-travel",
    type: "background",
    name: { es: "Aeropuerto", en: "Airport" },
    cost: 220,
    rarity: "legendary",
    video: "/scenes/loop-travel-9x16",
  },
  {
    id: "bg-city-walk",
    type: "background",
    name: { es: "Paseo por la ciudad", en: "City walk" },
    cost: 240,
    rarity: "legendary",
    video: "/scenes/loop-citywalk-9x16",
  },

  // ── Accessories (props near Lumi) ──
  { id: "acc-none", type: "accessory", name: { es: "Ninguno", en: "None" }, cost: 0, free: true },
  { id: "acc-flower", type: "accessory", name: { es: "Flor", en: "Flower" }, cost: 15, emoji: "🌸" },
  { id: "acc-cat", type: "accessory", name: { es: "Gatico", en: "Kitty" }, cost: 25, emoji: "🐱" },
  { id: "acc-balloons", type: "accessory", name: { es: "Globos", en: "Balloons" }, cost: 30, emoji: "🎈" },
  { id: "acc-butterfly", type: "accessory", name: { es: "Mariposa", en: "Butterfly" }, cost: 30, emoji: "🦋" },
  { id: "acc-sunflower", type: "accessory", name: { es: "Girasol", en: "Sunflower" }, cost: 30, emoji: "🌻" },
  { id: "acc-icecream", type: "accessory", name: { es: "Helado", en: "Ice cream" }, cost: 35, emoji: "🍦" },
  { id: "acc-boba", type: "accessory", name: { es: "Boba", en: "Boba tea" }, cost: 40, emoji: "🧋" },
  { id: "acc-rainbow", type: "accessory", name: { es: "Arcoíris", en: "Rainbow" }, cost: 40, emoji: "🌈" },
  { id: "acc-sunglasses", type: "accessory", name: { es: "Gafas de sol", en: "Sunglasses" }, cost: 45, emoji: "🕶️" },
  { id: "acc-wand", type: "accessory", name: { es: "Varita mágica", en: "Star wand" }, cost: 45, emoji: "🌟" },
  { id: "acc-headphones", type: "accessory", name: { es: "Audífonos", en: "Headphones" }, cost: 50, emoji: "🎧" },
  { id: "acc-guitar", type: "accessory", name: { es: "Guitarra", en: "Guitar" }, cost: 55, emoji: "🎸" },
  { id: "acc-crown", type: "accessory", name: { es: "Corona", en: "Crown" }, cost: 60, emoji: "👑" },
  { id: "acc-puppy", type: "accessory", name: { es: "Perrito", en: "Puppy" }, cost: 70, emoji: "🐶" },
  { id: "acc-unicorn", type: "accessory", name: { es: "Unicornio", en: "Unicorn" }, cost: 110, emoji: "🦄" },
  { id: "acc-medal", type: "accessory", name: { es: "Medalla", en: "Medal" }, cost: 50, emoji: "🏅" },
  { id: "acc-coffee", type: "accessory", name: { es: "Cafecito", en: "Coffee" }, cost: 35, emoji: "☕" },
  { id: "acc-book", type: "accessory", name: { es: "Librito", en: "Book" }, cost: 30, emoji: "📖" },
  { id: "acc-rose", type: "accessory", name: { es: "Rosa", en: "Rose" }, cost: 40, emoji: "🌹" },
  { id: "acc-star2", type: "accessory", name: { es: "Estrella fugaz", en: "Shooting star" }, cost: 55, emoji: "💫" },
  { id: "acc-dragon", type: "accessory", name: { es: "Dragón", en: "Dragon" }, cost: 200, rarity: "legendary", emoji: "🐉" },
  { id: "acc-diadem", type: "accessory", name: { es: "Diadema de diamante", en: "Diamond tiara" }, cost: 300, rarity: "legendary", emoji: "💎" },
  { id: "acc-halo", type: "accessory", name: { es: "Aureola", en: "Halo" }, cost: 260, rarity: "legendary", emoji: "😇" },

  // ── Ambient effects ──
  { id: "fx-none", type: "effect", name: { es: "Ninguno", en: "None" }, cost: 0, free: true },
  { id: "fx-hearts", type: "effect", name: { es: "Corazones", en: "Hearts" }, cost: 20, effect: "hearts" },
  { id: "fx-petals", type: "effect", name: { es: "Pétalos", en: "Petals" }, cost: 20, effect: "petals" },
  { id: "fx-snow", type: "effect", name: { es: "Nieve", en: "Snow" }, cost: 25, effect: "snow" },
  { id: "fx-leaves", type: "effect", name: { es: "Hojas", en: "Falling leaves" }, cost: 30, effect: "leaves" },
  { id: "fx-bubbles", type: "effect", name: { es: "Burbujas", en: "Bubbles" }, cost: 35, effect: "bubbles" },
  { id: "fx-sparkle", type: "effect", name: { es: "Destellos", en: "Sparkles" }, cost: 35, effect: "sparkle" },
  { id: "fx-stars", type: "effect", name: { es: "Estrellitas", en: "Twinkling stars" }, cost: 40, effect: "stars" },
  { id: "fx-notes", type: "effect", name: { es: "Notas musicales", en: "Music notes" }, cost: 45, effect: "notes" },
  { id: "fx-coins", type: "effect", name: { es: "Lluvia de estrellas", en: "Star rain" }, cost: 50, effect: "coins" },
  { id: "fx-rainbow", type: "effect", name: { es: "Arcoíris mágico", en: "Rainbow magic" }, cost: 60, effect: "rainbow" },
  { id: "fx-confetti", type: "effect", name: { es: "Confeti", en: "Confetti" }, cost: 65, effect: "confetti" },
  { id: "fx-diamonds", type: "effect", name: { es: "Lluvia de diamantes", en: "Diamond rain" }, cost: 150, rarity: "legendary", effect: "diamonds" },
  { id: "fx-fireworks", type: "effect", name: { es: "Fuegos artificiales", en: "Fireworks" }, cost: 180, rarity: "legendary", effect: "fireworks" },

  // ── Pets (companions on Lumi's stage) — the luxury collection, half of it
  //    proudly Colombian: jaguar, macaw, sloth, and the pink river dolphin. ──
  { id: "pet-none", type: "pet", name: { es: "Ninguna", en: "None" }, cost: 0, free: true },
  // Classic companions — real artwork in the app's anime sticker style.
  { id: "pet-tabby", type: "pet", name: { es: "Gatico naranja", en: "Tabby kitten" }, cost: 80, image: "/pets/tabby.png" },
  { id: "pet-golden", type: "pet", name: { es: "Golden retriever", en: "Golden retriever" }, cost: 150, image: "/pets/golden.png" },
  { id: "pet-dalmatian", type: "pet", name: { es: "Dálmata", en: "Dalmatian" }, cost: 150, image: "/pets/dalmatian.png" },
  { id: "pet-persian", type: "pet", name: { es: "Gata persa real", en: "Royal Persian cat" }, cost: 220, rarity: "legendary", image: "/pets/persian.png" },
  // More classics (emoji companions).
  { id: "pet-rabbit", type: "pet", name: { es: "Conejito", en: "Bunny" }, cost: 70, emoji: "🐰" },
  { id: "pet-hamster", type: "pet", name: { es: "Hámster", en: "Hamster" }, cost: 60, emoji: "🐹" },
  { id: "pet-turtle", type: "pet", name: { es: "Tortuguita", en: "Turtle" }, cost: 70, emoji: "🐢" },
  { id: "pet-blackcat", type: "pet", name: { es: "Gato negro", en: "Black cat" }, cost: 110, emoji: "🐈‍⬛" },
  { id: "pet-macaw", type: "pet", name: { es: "Guacamaya", en: "Macaw" }, cost: 100, emoji: "🦜" },
  { id: "pet-sloth", type: "pet", name: { es: "Perezoso", en: "Sloth" }, cost: 120, emoji: "🦥" },
  { id: "pet-flamingo", type: "pet", name: { es: "Flamenco", en: "Flamingo" }, cost: 140, emoji: "🦩" },
  { id: "pet-peacock", type: "pet", name: { es: "Pavo real", en: "Peacock" }, cost: 160, emoji: "🦚" },
  { id: "pet-dolphin", type: "pet", name: { es: "Delfín rosado", en: "Pink river dolphin" }, cost: 200, rarity: "legendary", emoji: "🐬" },
  { id: "pet-jaguar", type: "pet", name: { es: "Jaguar", en: "Jaguar" }, cost: 250, rarity: "legendary", emoji: "🐆" },
  { id: "pet-tiger", type: "pet", name: { es: "Tigre blanco", en: "White tiger" }, cost: 300, rarity: "legendary", emoji: "🐅" },
  { id: "pet-dragon", type: "pet", name: { es: "Dragón dorado", en: "Golden dragon" }, cost: 400, rarity: "legendary", emoji: "🐲" },
  // More companions
  { id: "pet-fox", type: "pet", name: { es: "Zorrito", en: "Fox" }, cost: 90, emoji: "🦊" },
  { id: "pet-panda", type: "pet", name: { es: "Panda", en: "Panda" }, cost: 130, emoji: "🐼" },
  { id: "pet-penguin", type: "pet", name: { es: "Pingüino", en: "Penguin" }, cost: 110, emoji: "🐧" },
  { id: "pet-koala", type: "pet", name: { es: "Koala", en: "Koala" }, cost: 130, emoji: "🐨" },
  { id: "pet-owl", type: "pet", name: { es: "Búho", en: "Owl" }, cost: 120, emoji: "🦉" },
  { id: "pet-frog", type: "pet", name: { es: "Ranita", en: "Frog" }, cost: 70, emoji: "🐸" },
  { id: "pet-hedgehog", type: "pet", name: { es: "Erizo", en: "Hedgehog" }, cost: 90, emoji: "🦔" },
  { id: "pet-unicorn", type: "pet", name: { es: "Unicornio", en: "Unicorn" }, cost: 260, rarity: "legendary", emoji: "🦄" },
  { id: "pet-phoenix", type: "pet", name: { es: "Fénix", en: "Phoenix" }, cost: 350, rarity: "legendary", emoji: "🔥" },
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
function slotFor(type: CosmeticType): "equippedBg" | "equippedAccessory" | "equippedEffect" | "equippedPet" {
  return type === "background"
    ? "equippedBg"
    : type === "accessory"
      ? "equippedAccessory"
      : type === "pet"
        ? "equippedPet"
        : "equippedEffect";
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

/**
 * Today's chest reward: a generous base that grows with the streak, plus a
 * weekly jackpot every 7th day so streaks feel worth protecting.
 */
export function chestReward(player: Pick<PlayerStats, "currentStreak">): number {
  const streak = player.currentStreak ?? 0;
  const base = 15 + Math.min(streak, 10) * 2; // 15 → 35
  const jackpot = streak > 0 && streak % 7 === 0 ? 30 : 0; // weekly bonus
  return base + jackpot;
}

/** True when today's chest is a weekly jackpot — the UI celebrates it extra. */
export function chestIsJackpot(player: Pick<PlayerStats, "currentStreak">): boolean {
  const streak = player.currentStreak ?? 0;
  return streak > 0 && streak % 7 === 0;
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
