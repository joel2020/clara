import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SCENARIOS } from "./content/scenarios.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(join(ROOT, path), "utf8");
const talk = source("app/talk/page.tsx");
const chat = source("app/api/chat/route.ts");
const home = source("app/page.tsx");
const plan = source("app/plan/page.tsx");
const call = source("app/call/page.tsx");
let ok = 0;
let failed = 0;
const check = (actual, message) => {
  if (actual) ok += 1;
  else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
};

check(talk.includes('from "@/components/lumi"'), "/talk renders Lumi rather than Joel's avatar");
check(!talk.includes("JoelAvatar") && !talk.includes('role: "joel"'), "/talk uses Lumi identity in turn data and rendering");
check(!chat.includes("You are Joel"), "/api/chat never presents Joel as the AI");
check(chat.includes("You are Lumi") && /honest that you are an AI/i.test(chat), "/api/chat identifies Lumi as AI and requires transparent answers");
check(!home.includes("with Joel") && !home.includes("con Joel"), "home conversation CTA names no human as the AI guide");
check(!plan.includes("Conversation with Joel (AI)") && !plan.includes("Conversación con Joel (IA)"), "plan distinguishes Lumi AI guidance from Joel the instructor");
check(!call.includes("JoelAvatar") && call.includes("Lumi · Customer"), "/call labels Lumi as the simulated customer rather than presenting Joel as AI");
check(SCENARIOS.every((scenario) => !/\bjoel\b/i.test(scenario.role) && !/\bjoel\b/i.test(scenario.opener.en) && !/\bjoel\b/i.test(scenario.opener.es)), "/talk scenario data never introduces or roles the AI as Joel");
const greetings = SCENARIOS.find((scenario) => scenario.id === "greetings");
check(greetings?.opener.en.includes("I'm Lumi") && greetings.opener.es.includes("Soy Lumi"), "the greetings opener introduces Lumi in both languages");

console.log(`${ok} ok`);
process.exit(failed ? 1 : 0);
