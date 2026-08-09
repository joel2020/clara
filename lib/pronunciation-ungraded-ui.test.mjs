import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const source = (path) => readFileSync(join(ROOT, path), "utf8");
const duet = source("components/practice/duet-scene.tsx");
const speed = source("components/practice/speed-round.tsx");
const shadow = source("components/practice/shadow-round.tsx");
const exam = source("app/exam/page.tsx");

let ok = 0;
let fail = 0;
const check = (condition, message) => {
  if (condition) ok += 1;
  else {
    fail += 1;
    console.log("FAIL", message);
  }
};

check(/herPhase === "ungraded"[\s\S]{0,1200}onClick=\{\(\) => advance\("skipped"\)\}/.test(duet), "duet ungraded state offers a zero-reward skip");
check(/!flash && notice[\s\S]{0,900}onClick=\{\(\) => advance\(false\)\}/.test(speed), "speed ungraded state offers a zero-reward skip");
check(
  shadow.includes('coach.phase === "ungraded-practice"') &&
    /coach\.phase === "ungraded-practice"[\s\S]{0,1800}onClick=\{\(\) => advance\(false\)\}/.test(shadow),
  "shadow ungraded state offers a zero-reward skip",
);
check(exam.includes('assessmentKind: item.kind'), "exam sends the composed word or phrase kind to Azure");
check(exam.includes('context: "stage"') || exam.includes("transitionStageSpeaking"), "exam routes the original word or phrase through the stage policy");
check(/transition\.disposition === "void"[\s\S]{0,360}voidSitting\(/.test(exam), "exam diagnostic or incomplete evidence clears its checkpoint and voids without recording or advancing");
check(/phase === "voided"[\s\S]{0,1800}Intentar de nuevo[\s\S]{0,500}Back home/.test(exam), "exam outage state offers retry and back paths without recording");
for (const [name, activity] of [["speed", speed], ["shadow", shadow]]) {
  check(activity.includes("gradedAttempts"), `${name} tracks a graded-only denominator`);
  check(activity.includes("gradedAccuracy("), `${name} derives accuracy only from graded attempts`);
  check(activity.includes("shouldCelebrateGradedCompletion("), `${name} gates finish celebration on a graded completion`);
}
check(duet.includes("gradedAttempts") && duet.includes("shouldCelebrateGradedCompletion("), "duet keeps all-ungraded completion neutral");
check(/gradedAttempts === 0[\s\S]{0,220}Sin calificar[\s\S]{0,80}Not graded/.test(duet), "duet labels a fully ungraded completion instead of showing a zero score");

console.log(`${ok} ok, ${fail} failed`);
process.exit(fail ? 1 : 0);
