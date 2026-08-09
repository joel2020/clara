// npx tsx lib/closet-catalog.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { LUMI_CITY_REMIX } from "./cosmetics.ts";
import {
  applyClosetAction,
  closetEligibility,
  quoteClosetAction,
} from "./store.ts";
import { levelFloor } from "./gamification.ts";

const expected = [
  ["cancha-chic", 140, { type: "none" }],
  ["club-lectura", 160, { type: "none" }],
  ["nuevo-romance", 180, { type: "none" }],
  ["moto-rosa", 200, { type: "level", level: 5 }],
  ["retro-86", 0, { type: "completed-daily-sessions", count: 7 }],
  ["la-jefa", 0, { type: "milestone", id: "first-passed-interview-call" }],
];

test("City Remix contains exactly the approved six outfits and unlock rules", () => {
  assert.deepEqual(
    LUMI_CITY_REMIX.map(({ id, cost, unlockRule }) => [id, cost, unlockRule]),
    expected,
  );
  assert.equal(new Set(LUMI_CITY_REMIX.map(({ id }) => id)).size, 6);
  assert.ok(LUMI_CITY_REMIX.every(({ type, collection }) => type === "outfit" && collection === "city-remix"));
});

const player = (overrides = {}) => ({
  id: "player",
  xp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDay: null,
  todayKey: null,
  todayXp: 0,
  totalAttempts: 0,
  totalPasses: 0,
  bestCombo: 0,
  achievements: [],
  completedDailySessions: 0,
  unlockedMilestones: [],
  stars: 500,
  ownedCosmetics: [],
  equippedBg: "bg-default",
  equippedAccessory: "acc-none",
  equippedEffect: "fx-none",
  equippedPet: "pet-none",
  equippedOutfit: "outfit-default",
  lastChestDay: null,
  streakFreezes: 0,
  freezeUsedDay: null,
  updatedAt: 1,
  ...overrides,
});
const outfit = (id) => LUMI_CITY_REMIX.find((item) => item.id === id);

test("level, lifetime-session, and milestone gates are enforced", () => {
  const moto = outfit("moto-rosa");
  const retro = outfit("retro-86");
  const boss = outfit("la-jefa");
  assert.equal(quoteClosetAction({ cosmetic: moto, stats: player(), eligibility: closetEligibility(player()) }).status, "locked");
  const levelFive = player({ xp: levelFloor(5) });
  assert.equal(quoteClosetAction({ cosmetic: moto, stats: levelFive, eligibility: closetEligibility(levelFive) }).status, "buy");
  const sixDays = player({ completedDailySessions: 6 });
  assert.equal(quoteClosetAction({ cosmetic: retro, stats: sixDays, eligibility: closetEligibility(sixDays) }).status, "locked");
  const sevenDays = player({ completedDailySessions: 7 });
  assert.equal(quoteClosetAction({ cosmetic: retro, stats: sevenDays, eligibility: closetEligibility(sevenDays) }).status, "equip");
  const callPassed = player({ unlockedMilestones: ["first-passed-interview-call"] });
  assert.equal(quoteClosetAction({ cosmetic: boss, stats: callPassed, eligibility: closetEligibility(callPassed) }).status, "equip");
});

test("ownership wins over later lock-state changes", () => {
  const owned = player({ ownedCosmetics: ["moto-rosa"], xp: 0 });
  assert.equal(
    quoteClosetAction({ cosmetic: outfit("moto-rosa"), stats: owned, eligibility: closetEligibility(owned) }).status,
    "equip",
  );
});

test("preview quote is pure and never reports a negative balance", () => {
  const before = player({ stars: 100 });
  const frozen = structuredClone(before);
  const quote = quoteClosetAction({
    cosmetic: outfit("cancha-chic"),
    stats: before,
    eligibility: closetEligibility(before),
  });
  assert.equal(quote.status, "buy");
  assert.equal(quote.balanceAfter, undefined);
  assert.deepEqual(before, frozen);
});

test("purchase is idempotent and equipping changes only the outfit slot", () => {
  const start = player({ stars: 200, equippedAccessory: "acc-book" });
  const first = applyClosetAction({ cosmetic: outfit("cancha-chic"), stats: start, at: 10 });
  assert.equal(first.status, "applied");
  assert.equal(first.stats.stars, 60);
  assert.deepEqual(first.stats.ownedCosmetics, ["cancha-chic"]);
  assert.equal(first.stats.equippedOutfit, "cancha-chic");
  assert.equal(first.stats.equippedAccessory, "acc-book");
  const repeated = applyClosetAction({ cosmetic: outfit("cancha-chic"), stats: first.stats, at: 20 });
  assert.equal(repeated.stats.stars, 60);
  assert.deepEqual(repeated.stats.ownedCosmetics, ["cancha-chic"]);
});

test("earned outfits cannot be bought and unlock without spending stars", () => {
  const eligible = player({ stars: 1, completedDailySessions: 7 });
  const result = applyClosetAction({ cosmetic: outfit("retro-86"), stats: eligible, at: 10 });
  assert.equal(result.status, "applied");
  assert.equal(result.stats.stars, 1);
  assert.ok(result.stats.ownedCosmetics.includes("retro-86"));
  const locked = applyClosetAction({ cosmetic: outfit("la-jefa"), stats: eligible, at: 11 });
  assert.equal(locked.status, "locked");
  assert.equal(locked.stats, eligible);
});
