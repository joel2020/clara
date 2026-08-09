// npx tsx lib/navigation.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEARNER_NAV, isImmersiveRoute, isLearnerNavActive } from "./navigation.ts";

test("primary learner navigation contains exactly the approved four spaces", () => {
  assert.deepEqual(LEARNER_NAV, [
    { id: "hoy", href: "/", labelKey: "navToday", icon: "sunrise" },
    { id: "camino", href: "/map", labelKey: "navCamino", icon: "route" },
    { id: "hablar", href: "/talk", labelKey: "navTalk", icon: "message" },
    { id: "yo", href: "/profile", labelKey: "navYo", icon: "profile" },
  ]);
  assert.equal(new Set(LEARNER_NAV.map(({ href }) => href)).size, 4);
  assert.ok(!LEARNER_NAV.some(({ href }) => href === "/shop"));
});

test("practice routes are immersive while the four hubs and Closet are not", () => {
  for (const path of ["/today", "/lesson/coffee", "/exam", "/call", "/virtual-call", "/duet", "/listen", "/play", "/review", "/shadow"]) {
    assert.equal(isImmersiveRoute(path), true, `${path} is immersive`);
  }
  for (const path of ["/", "/map", "/talk", "/profile", "/shop", "/settings"]) {
    assert.equal(isImmersiveRoute(path), false, `${path} keeps the shell`);
  }
});

test("Closet remains visibly nested under Yo", () => {
  const yo = LEARNER_NAV.find(({ id }) => id === "yo");
  assert.ok(yo);
  assert.equal(isLearnerNavActive(yo, "/profile"), true);
  assert.equal(isLearnerNavActive(yo, "/shop"), true);
  assert.equal(isLearnerNavActive(yo, "/"), false);
});

test("desktop and mobile consume one contract and Yo owns the Closet entry", () => {
  const mobile = readFileSync("components/mobile-nav.tsx", "utf8");
  const header = readFileSync("components/site-header.tsx", "utf8");
  const profile = readFileSync("app/profile/page.tsx", "utf8");
  const home = readFileSync("app/page.tsx", "utf8");
  assert.ok(mobile.includes("LEARNER_NAV") && header.includes("LEARNER_NAV"));
  assert.ok(mobile.includes("grid-cols-4"));
  assert.ok(!mobile.includes("navTienda") && !header.includes("navTienda"));
  assert.ok(profile.includes('href="/shop"'));
  assert.ok(!home.includes('href="/shop"'));
  assert.ok(!home.includes("PetSprite"));
});
