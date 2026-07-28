// node lib/content/content-lint.test.mjs
//
// Content-quality gate (Phase 0). Three classes of defect shipped to learners
// before this existed, so each is pinned here:
//   1. Identity residue — curriculum written for one named student must never
//      reach a different signed-in learner. Learner-facing content may only
//      reference a student by the {name} token (resolved at render time) or by
//      an intentional fictional character (call-scenario customers).
//   2. Authoring artifacts — abandoned self-corrections ("... no,"), TODOs,
//      and malformed strings.
//   3. Harmful pronunciation respellings — hints that spell English /θ/ as
//      Spanish z or English /h/ as Spanish j teach the exact transfer errors
//      the sound track exists to fix, and British-only IPA contradicts the
//      American-English brand. See docs/pronunciation-standard.md.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_ITEMS, LESSONS } from "./lessons.ts";
import { SCENARIOS } from "./scenarios.ts";
import { CALL_SCENARIOS } from "./call-scenarios.ts";
import { personalize, personalizeList } from "../personalize.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

// --- 1. Identity residue ----------------------------------------------------
// The one real student the app was first built for. Her name may appear in
// git history and internal docs, but never in anything a learner can see.
const STUDENT_NAMES = /mariana/i;

for (const it of ALL_ITEMS) {
  for (const field of ["text", "meaning", "mouthHint"]) {
    assert(!STUDENT_NAMES.test(it[field] ?? ""), `item ${it.id} ${field} leaks a student identity: ${it[field]}`);
  }
}
for (const l of LESSONS) {
  assert(!STUDENT_NAMES.test(JSON.stringify(l.intro ?? "")), `lesson ${l.id} intro leaks a student identity`);
}
for (const s of SCENARIOS) {
  for (const field of ["role", "setting"]) {
    assert(!STUDENT_NAMES.test(s[field]), `scenario ${s.id} ${field} leaks a student identity`);
  }
  assert(!STUDENT_NAMES.test(s.opener.en + s.opener.es), `scenario ${s.id} opener leaks a student identity`);
  for (const st of s.starters) assert(!STUDENT_NAMES.test(st), `scenario ${s.id} starter leaks a student identity: ${st}`);
}
for (const c of CALL_SCENARIOS) {
  // Fictional customers (Denise, Tom, …) are intentional; the STUDENT must not be named.
  assert(!STUDENT_NAMES.test(c.persona + (c.opener ?? "")), `call scenario ${c.id} leaks a student identity`);
}

// User-facing surfaces that once carried the original student's identity as
// placeholder/fallback text. Scanned as source so a reintroduction anywhere in
// the file (string, placeholder, fallback) fails loudly.
const USER_FACING_FILES = [
  "components/login-screen.tsx",
  "components/onboarding-flow.tsx",
  "components/instructor/voice-settings.tsx",
  "app/call/page.tsx",
  "app/talk/page.tsx",
  "lib/content/es.ts",
  "lib/content/word-es.ts",
];
for (const f of USER_FACING_FILES) {
  const src = readFileSync(join(ROOT, f), "utf8");
  assert(!STUDENT_NAMES.test(src), `${f} contains a student identity`);
}

// --- personalize() ----------------------------------------------------------
assert(personalize("Hey {name}! Nice day.", "Sofía") === "Hey Sofía! Nice day.", "personalize inserts the name");
assert(personalize("Hey {name}! Nice day.", null) === "Hey! Nice day.", "personalize drops the token cleanly without a name");
assert(personalize("meeting {name} for the first time", null, "the student") === "meeting the student for the first time", "personalize uses the provided fallback");
assert(personalize("Hola, {name}. ¿Bien?", "") === "Hola. ¿Bien?", "personalize tidies a dangling comma");
assert(personalize("No token here.", "Ana") === "No token here.", "personalize leaves plain text alone");
const list = personalizeList(["Hi, I'm {name}.", "Nice to meet you too."], null);
assert(list.length === 1 && list[0] === "Nice to meet you too.", "starters that need a missing name are dropped, not mangled");
const list2 = personalizeList(["Hi, I'm {name}.", "Nice to meet you too."], "Valentina");
assert(list2[0] === "Hi, I'm Valentina.", "starters resolve the name when present");

// --- 2. Authoring artifacts -------------------------------------------------
const ARTIFACTS = [
  /\.\.\.\s*no,/, // abandoned self-correction ("'foun' con h muda... no, 'f'.")
  /\bTODO:/,      // case-sensitive with colon: Spanish "todo"/emphatic "TODO" are fine
  /\bFIXME\b/,
  /\bXXX\b/,
  /lorem ipsum/i,
];
for (const it of ALL_ITEMS) {
  for (const field of ["text", "meaning", "mouthHint"]) {
    const v = it[field] ?? "";
    for (const re of ARTIFACTS) assert(!re.test(v), `item ${it.id} ${field} has an authoring artifact: ${v}`);
  }
}

// --- 3. Pronunciation hints -------------------------------------------------
// Prescriptive respellings that teach the transfer error. Each token below was
// found live in shipped hints; the list is exact-match on purpose — hints
// legitimately contain Spanish words with j/z ("se junta", "zapato").
const BANNED_RESPELLINGS = [
  "zank", "zri", "zrout", "ZER-ti", "EV-ri-zing", "zé-ti",       // θ/ð as z
  "jelp", "JELP", "'jom'", "'jau", "jau-", "jaus", "'jus'", "jir-mi",
  "jaf-", "jai-", "ja-va", "jang-", "jauaryú",                    // /h/ as Spanish j
];
for (const it of ALL_ITEMS) {
  const h = it.mouthHint ?? "";
  for (const tok of BANNED_RESPELLINGS) {
    assert(!h.includes(tok), `item ${it.id} hint respells with "${tok}": ${h}`);
  }
}

// British-only vowel symbols in an American English course. /ɒ/ is the LOT
// vowel BrE writes; GenAm uses /ɑ(ː)/ (or /ɔː ʌ/ for CLOTH/STRUT words).
// (Centring diphthongs ɪə/eə/ʊə are also BrE-only, but as substrings they
// collide with /aɪə oʊə/ sequences — /ɒ/ alone is the unambiguous marker.)
const BRITISH_IPA = /ɒ/;
for (const it of ALL_ITEMS) {
  assert(!BRITISH_IPA.test(it.ipa ?? ""), `item ${it.id} uses British IPA: ${it.ipa}`);
}

console.log(`content-lint: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
