// node lib/closet-ui.test.mjs
import { readFileSync } from "node:fs";

const source = readFileSync("app/shop/page.tsx", "utf8");
let ok = 0, fail = 0;
const check = (condition, message) => {
  if (condition) ok++;
  else { fail++; console.log("FAIL", message); }
};

check(source.includes("Lumi’s Closet") && source.includes("El clóset de Lumi"), "the page is explicitly Lumi's bilingual Closet");
check(source.includes("LUMI_CITY_REMIX.map"), "only the approved City Remix collection drives outfit cards");
check(source.includes("CharacterPreview") && source.includes("previewOutfit"), "one large Lumi stage previews the selected look");
check(!source.includes("AvatarPreview") && !source.includes("PetSprite") && !source.includes("petId="), "the Closet presents no learner avatar or pet");
check(!source.includes("STORE_CATEGORIES") && !source.includes("cosmeticsByType"), "legacy multi-category store navigation is gone");
check(source.includes('role="list"') && source.includes('aria-pressed={chosen}'), "the six-look picker exposes selection semantics");
check(source.includes("quoteClosetAction") && source.includes("buyCosmetic") && source.includes("equipCosmetic"), "preview, purchase, and equip use authoritative economy paths");
check(source.includes("Dialog") && source.includes("shopConfirmAfter"), "star spending has an explicit balance confirmation");
check(source.includes("min-h-11") && source.includes("focus-visible:outline-2"), "interactive controls preserve target size and keyboard focus");
check(source.includes('href="/profile"') && source.includes('href="/today"'), "Closet returns to Yo and routes insufficient balances to practice");

console.log(`${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
