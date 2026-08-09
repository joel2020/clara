import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(ROOT, path), "utf8");

let ok = 0;
let failed = 0;
function check(condition, message) {
  if (condition) ok += 1;
  else {
    failed += 1;
    console.error(`FAIL ${message}`);
  }
}

const reset = source("components/reset-password-screen.tsx");
const onboarding = source("components/onboarding-flow.tsx");
const dialog = source("components/ui/dialog.tsx");
const modalSources = [
  ["voice consent", source("components/voice-consent-sheet.tsx")],
  ["media player", source("app/media/page.tsx")],
  ["level-up", source("components/practice/level-up-overlay.tsx")],
];

check(/<label[^>]*htmlFor="new-password"/.test(reset), "the new-password label is associated with its input");
check(/<input[\s\S]*?id="new-password"[\s\S]*?type="password"/.test(reset), "the new-password input has a stable id");
check(/<label[^>]*htmlFor="confirm-password"/.test(reset), "the confirm-password label is associated with its input");
check(/<input[\s\S]*?id="confirm-password"[\s\S]*?type="password"/.test(reset), "the confirm-password input has a stable id");

const nameStep = onboarding.slice(onboarding.indexOf('{step === "name"'), onboarding.indexOf('{step === "place"'));
check(/<label[^>]*htmlFor="student-name"/.test(nameStep), "the onboarding name field has a visible associated label");
check(/id="student-name"/.test(nameStep), "the onboarding name field has a stable id");
check(/name="studentName"/.test(nameStep), "the onboarding name field has a form name");
check(/autoComplete="name"/.test(nameStep), "the onboarding name field exposes the name autocomplete purpose");
check(!/autoFocus/.test(nameStep), "the onboarding name field does not force mobile focus");
check(/focus-visible:ring-(?:2|3)\s+focus-visible:ring-ring(?!\/)/.test(nameStep), "onboarding uses an opaque focus ring");

check(dialog.includes("DialogPrimitive.Root"), "the shared Dialog delegates modal behavior to Base UI");
check(dialog.includes("DialogPrimitive.Popup"), "the shared Dialog content delegates focus management to Base UI");

for (const [name, component] of modalSources) {
  check(component.includes('from "@/components/ui/dialog"'), `${name} imports the shared dialog primitive`);
  check(/<Dialog(?:\s|>)/.test(component), `${name} renders the shared Dialog root`);
  check(/<DialogContent(?:\s|>)/.test(component), `${name} renders shared focus-trapped dialog content`);
  check(/<DialogTitle(?:\s|>)/.test(component), `${name} provides an accessible dialog name`);
  check(/<DialogDescription(?:\s|>)/.test(component), `${name} provides an accessible dialog description`);
  check(/initialFocus=/.test(component), `${name} intentionally selects its initial safe focus target`);
  check(!/role=["']dialog["']/.test(component), `${name} has no hand-rolled dialog role`);
}

const levelUp = modalSources[2][1];
check(/<DialogClose(?:\s|>)/.test(levelUp), "the level-up dialog has a real close button");
check(!/onClick=\{onClose\}[\s\S]{0,180}role=["']dialog["']/.test(levelUp), "the level-up backdrop is not a clickable div");
check(/setTimeout\(onClose, 2400\)/.test(levelUp), "the level-up celebration keeps its non-interactive timer");

for (const [name, component] of [
  ["voice consent", modalSources[0][1]],
  ["media player", modalSources[1][1]],
  ["level-up", modalSources[2][1]],
  ["reset password", reset],
  ["onboarding", onboarding],
]) {
  check(!/focus-visible:ring-(?:primary|ring)\/(?:30|40)/.test(component), `${name} has no translucent low-contrast focus ring`);
  check(/focus-visible:ring-(?:2|3)\s+focus-visible:ring-ring(?!\/)/.test(component), `${name} uses an opaque focus ring token`);
}

console.log(`${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
