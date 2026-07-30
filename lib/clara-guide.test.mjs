// node lib/clara-guide.test.mjs
//
// Clara-as-sole-guide gate (plan Task 3). Task 1 pinned the manifest and Task 2
// produced the artwork; this suite pins the RENDERING contract and the identity
// boundary that the two of them exist to serve:
//
//   1. CharacterIllustration is manifest-driven — no hardcoded artwork path,
//      no state outside the seven approved ones, alt text only from
//      CLARA_ASSETS, and the reduced-motion still taken from the manifest.
//   2. Every frame is contained. The approved bust/avatar crops are cut by the
//      illustrator against the focal anchor; CSS never crops the guide.
//   3. Nothing renders artwork that does not exist: CLARA_ARTWORK_AVAILABLE
//      gates the request, and a neutral placeholder stands in until it flips.
//   4. No learner-facing surface renders or names Lumi. She survives ONLY as
//      the store's cosmetic model — owned inventory a learner paid stars for —
//      behind components/lumi*.tsx and the store's own preview.
//   5. Clara stays off the failure surfaces. The design system approves no
//      error state, and the guide standing over a crash, a 404, or an access
//      denial turns the app's fault into a verdict on the learner.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

const read = (p) => readFileSync(join(ROOT, p), "utf8");

function tsxFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...tsxFiles(rel));
    else if (entry.endsWith(".tsx")) out.push(rel);
  }
  return out;
}
const SURFACES = [...tsxFiles("app"), ...tsxFiles("components")];
assert(SURFACES.length > 40, "found the app and component surfaces to check");

const STATES = ["welcome", "teaching", "listening", "encouraging", "thinking", "celebrating", "store"];

// --- 1. Manifest-driven rendering ------------------------------------------
const illus = read("components/character/character-illustration.tsx");

assert(/CLARA_ASSETS/.test(illus) && /CLARA_ARTWORK_AVAILABLE/.test(illus),
  "CharacterIllustration reads the manifest and the artwork flag");
assert(!/["'`]\/character\//.test(illus),
  "CharacterIllustration hardcodes no artwork path — every path comes from CLARA_ASSETS");
assert(/art\.alt\[/.test(illus),
  "meaningful alt text comes from the manifest, localized, never from a call site");
assert(/meaningful \? art\.alt\[lang\] : ""/.test(illus),
  "decorative renders get alt=\"\"");
assert(/aria-hidden=\{meaningful \? undefined : true\}/.test(illus),
  "decorative renders are aria-hidden so a screen reader hears the lesson");
assert(/reducedMotion/.test(illus) && /frame \?\? documentedFrame\(state\)/.test(illus),
  "an unpinned render resolves to the manifest's documented reduced-motion still");
assert(/motion-reduce:animate-none/.test(illus),
  "reduced motion also disables any float/entrance animation layered on the figure");

// --- 2. Containment ---------------------------------------------------------
for (const f of tsxFiles("components/character")) {
  const src = read(f);
  assert(!/object-cover/.test(src), `${f} never cover-crops the guide`);
}
assert(/object-contain/.test(illus), "CharacterIllustration is contain-fit by default");

// --- 3. The artwork flag actually guards the request ------------------------
const guard = illus.indexOf("!CLARA_ARTWORK_AVAILABLE");
assert(guard > 0 && guard < illus.indexOf("<Image"),
  "the missing-artwork placeholder returns BEFORE any <Image> is requested");
assert(/ClaraPlaceholder/.test(illus),
  "a neutral placeholder stands in until the approved artwork ships");

// --- 4. Only approved states, and no learner-facing Lumi --------------------
// Lumi is retained for the store's purchasable cosmetics only. Everything else
// is Clara's.
const COSMETIC_ONLY = new Set([
  "components/lumi.tsx",
  "components/lumi-scene.tsx",
  "components/lumi-depth.tsx",
  "components/character/character-preview.tsx",
]);
for (const f of SURFACES) {
  const src = read(f);
  if (!COSMETIC_ONLY.has(f)) {
    assert(!/\bLumi\b/.test(src), `${f} makes no reference to Lumi (the guide is Clara)`);
  }
  assert(!/amiga de estudio/.test(src), `${f} never calls the illustration a study companion`);
  // Every render names a state. WHICH state is legal is the CharacterState
  // union's job — TypeScript already refuses anything outside the seven, so
  // re-checking the spelling here would only duplicate the compiler.
  for (const [tag] of src.matchAll(/<Character(?:Illustration|Avatar|Reaction)\b[^>]*/g)) {
    assert(/\bstate=/.test(tag), `${relative(".", f)} passes an explicit character state`);
  }
}

// Each approved state earns its place. `store` is the deliberate exception:
// the store preview shows the purchasable COSMETIC catalog, not the guide, so
// Clara's store pose stays in the manifest unrendered rather than being forced
// onto a screen that is about inventory.
const allSurfaces = SURFACES.map(read).join("\n");
for (const state of STATES) {
  if (state === "store") continue;
  assert(allSurfaces.includes(`"${state}"`), `the approved "${state}" state is actually used`);
}

// --- 5. Clara stays off the failure surfaces --------------------------------
for (const f of [
  "app/error.tsx",
  "app/not-found.tsx",
  "components/auth-gate.tsx",
  "components/reset-password-screen.tsx",
]) {
  const src = read(f);
  const denials = src.match(/CharacterIllustration|CharacterAvatar|CharacterReaction/g) ?? [];
  // auth-gate keeps the guide on its two loading spinners and nowhere else.
  const allowed = f === "components/auth-gate.tsx" ? 3 : 0;
  assert(denials.length <= allowed, `${f} does not put the guide on a failure screen`);
}

// --- 6. The guide is never dressed by the store ----------------------------
assert(!/usePlayer|equippedOutfitBase|from "@\/lib\/cosmetics"/.test(illus),
  "CharacterIllustration reads no player inventory — the guide is not something the learner dresses");

console.log(`clara-guide: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
