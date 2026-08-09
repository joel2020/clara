import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StagePracticeRequired } from "@/components/exam/stage-practice-required";

let ok = 0, fail = 0;
const assert = (condition, message) => condition ? ok++ : (fail++, console.log("FAIL", message));
const html = renderToStaticMarkup(React.createElement(StagePracticeRequired, {
  attempts: 3,
  focus: { itemId: "ship", itemText: "ship", feature: "short-i-long-ee", lessonId: "i-vs-ii", mouthHint: "Relax the lips and keep the vowel short." },
}));

assert(html.includes('data-exam-terminal="practice-required"'), "the third miss renders a terminal practice-required state");
assert(html.includes('href="/lesson/i-vs-ii?focus=ship"'), "the terminal state provides a targeted supported practice route");
assert(/no cambia tu nivel/.test(html) && /no entrega premios/.test(html), "the UI says there is no stage award or reward");
assert(!/Subiste de nivel|Pasaste a/.test(html), "the incomplete state never renders pass copy");
assert(/\/ɪ\/ – \/iː\//.test(html) && /Relax the lips/.test(html), "the exact failed sound label and mouth cue remain actionable");
assert(/>ship</.test(html), "the exact bounded authored item text remains visible");
assert(/relaja la boca/.test(html) && /relax and keep it short/i.test(html), "the recovery cue is bilingual");
assert(/3 intentos acústicos válidos/.test(html) && /3 valid acoustic attempts/.test(html), "the exact valid-attempt count is bilingual");

console.log(`exam-ui: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
