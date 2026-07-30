// node lib/game-system.test.mjs
//
// Release gate for Clara's connected learning loop. These assertions pin the
// product architecture: learning produces XP and one spendable currency;
// today's route gives a next action and missions; the path exposes progression;
// and the store consumes earned stars. It deliberately rejects parallel
// currencies and punitive energy mechanics.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { QUESTS, QUEST_BONUS_XP } from "./quests.ts";
import { levelProgress, starRating, xpForAttempt } from "./gamification.ts";
import { STORE_CATEGORIES } from "./store.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0;
let fail = 0;
const assert = (condition, message) => {
  if (condition) ok++;
  else {
    fail++;
    console.log("FAIL", message);
  }
};

assert(xpForAttempt(true, 1) > xpForAttempt(false, 0), "successful learning earns more XP than a miss");
assert(starRating(true, 95) === 3 && starRating(false, 100) === 0, "stars reward demonstrated success");
assert(levelProgress(0).level === 1 && levelProgress(40).level === 2, "XP drives durable level progression");
assert(QUESTS.length === 3 && QUESTS.every((q) => q.target > 0), "daily loop has three concrete missions");
assert(QUEST_BONUS_XP > 0, "balanced daily practice earns a completion bonus");
assert(STORE_CATEGORIES.some((c) => c.type === "outfit"), "earned currency connects to character customization");

const home = readFileSync(join(ROOT, "app/page.tsx"), "utf8");
const today = readFileSync(join(ROOT, "app/today/page.tsx"), "utf8");
const map = readFileSync(join(ROOT, "app/map/page.tsx"), "utf8");
const nav = readFileSync(join(ROOT, "components/mobile-nav.tsx"), "utf8");
const gamification = readFileSync(join(ROOT, "lib/gamification.ts"), "utf8");
const sessionCard = readFileSync(join(ROOT, "components/today-session-card.tsx"), "utf8");
const sessionComplete = readFileSync(join(ROOT, "components/daily-session/session-complete.tsx"), "utf8");

assert(
  /<TodaySessionCard/.test(home) && /href="\/today"/.test(sessionCard) && /<DailyQuests/.test(home),
  "home makes the next session and missions prominent",
);
assert(/nextActivity\(session\)/.test(today) && /<ActivityShell/.test(today), "today advances to one clear next action");
assert(
  /claimCompletion/.test(today) && /rewardStars/.test(sessionComplete),
  "daily completion leads to an earned store reward",
);
assert(/done|mastered/.test(map) && /currentIndex/.test(map) && /locked/.test(map), "learning path distinguishes progression states");
assert(/\/shop/.test(nav) && /grid-cols-5/.test(nav), "store is a first-class mobile destination");
assert(!/\b(heart|energy|lives)\b/i.test(gamification), "standard learning has no punitive energy gate");

console.log(`game-system: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
