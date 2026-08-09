import assert from "node:assert/strict";
import { resolveLessonFocus } from "./lesson-focus.ts";
import { readFileSync } from "node:fs";
const lesson = { id: "sound", title: "Sound", subtitle: "", description: "", kind: "sound-focus", categoryIds: [], order: 1, items: [
  { id: "word", text: "ship", ipa: "/ʃɪp/", mouthHint: "short", kind: "word", categoryId: "i", phoneme: "ɪ" },
  { id: "phrase", text: "This is it", ipa: "", mouthHint: "", kind: "phrase", categoryId: "i", phoneme: "ɪ" },
] };
assert.equal(resolveLessonFocus(lesson, "word")?.stage, "produce");
assert.equal(resolveLessonFocus(lesson, "phrase")?.stage, "phrases");
assert.equal(resolveLessonFocus(lesson, "foreign"), null);
assert.equal(resolveLessonFocus(lesson, "x".repeat(129)), null);
const page = readFileSync("app/lesson/[id]/page.tsx", "utf8");
const session = readFileSync("components/practice/practice-session.tsx", "utf8");
assert.match(page, /resolveLessonFocus\(lesson, searchParams\.get\("focus"\)\)/);
assert.match(session, /setStage\(focused\.kind === "phrase" \? "phrases" : "produce"\)/);
assert.match(session, /data-targeted-focus=\{focusItemId\}/);
console.log("lesson-focus: 7 ok, 0 failed");
