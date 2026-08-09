import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)));
const source = (path) => readFileSync(join(ROOT, path), "utf8");

const scenarioSource = source("lib/content/virtual-call-scenarios.ts");
const brainSource = source("lib/virtual-call/brain.ts");
const privacySource = source("components/privacy-notice.tsx");
const consentSource = source("components/voice-consent-sheet.tsx");
const disclosureSource = source("components/virtual-call/ai-disclosure.tsx");
const callHookSource = source("components/virtual-call/use-virtual-call.ts");
const i18nSource = source("lib/i18n.ts");

assert(!scenarioSource.includes("I'm Clara"), "scenario openings introduce Lumi, never Clara");
assert(brainSource.includes("You are Lumi"), "the call brain identifies the AI companion as Lumi");
assert(brainSource.includes("Clara is the name of the app"), "the call brain distinguishes Clara the app");
assert(disclosureSource.includes('t("vcallDisclosure", lang)'), "the standing disclosure remains visible on call surfaces");
assert(i18nSource.includes("Lumi is an AI practice guide"), "the standing English disclosure names Lumi as AI");
assert(i18nSource.includes("Lumi es una guía de práctica con IA"), "the standing Spanish disclosure names Lumi as AI");
const muteHook = callHookSource.slice(callHookSource.indexOf("const toggleMute"), callHookSource.indexOf("const end ="));
assert(
  muteHook.includes("recRef.current?.cancel();") && muteHook.includes("setRecording(false);"),
  "muting immediately cancels an active microphone capture",
);

for (const [name, copy] of [
  ["privacy", privacySource],
  ["consent", consentSource],
]) {
  assert(copy.includes("automatically"), `${name} explains English automatic microphone activation`);
  assert(copy.includes("each turn"), `${name} explains English turn-by-turn activation`);
  assert(copy.includes("automáticamente"), `${name} explains Spanish automatic microphone activation`);
  assert(copy.includes("cada turno"), `${name} explains Spanish turn-by-turn activation`);
  assert(copy.includes("Microsoft") && copy.includes("ElevenLabs") && copy.includes("OpenAI"), `${name} names voice and AI processors`);
  assert(/raw audio|audio original/i.test(copy), `${name} discloses ephemeral raw audio`);
  assert(/transcript|transcripci/i.test(copy), `${name} explains transcript use`);
  assert(/cloud|nube/i.test(copy) && /delete|borrar|elimin/i.test(copy), `${name} explains manual cloud deletion`);
}

console.log("identity and voice-consent source contract passed");
