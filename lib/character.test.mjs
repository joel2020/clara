// node lib/character.test.mjs
//
// Character-system gate, written before the architecture (red-first).
// Identity (from product history, not invented): Joel is the human teacher and
// primary guide; Lumi is the recurring illustrated companion — made to mirror
// the learner — and the store model; Clara is the product voice. Lumi never
// competes with Joel as a teacher. This suite pins:
//   1. Centralized typed character metadata (lib/character.ts): moods, modes,
//      art resolution, bust focal table — no per-callsite crop hacks.
//   2. Asset integrity: every mood resolves to a real file for the default
//      base and every shop outfit base.
//   3. Component contracts: decorative-by-default alt, contain-safe fits (no
//      object-cover on character art), no new ambient/infinite motion.
//   4. Migrated surfaces use the character components, not raw art paths or
//      ad-hoc <Lumi> calls.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

// --- 1. Central metadata ----------------------------------------------------
let character = null;
try {
  character = await import("./character.ts");
} catch {
  /* red until lib/character.ts exists */
}
assert(character, "lib/character.ts exists (central character config)");

const EXPECTED_MOODS = ["idle", "wave", "cheer", "think", "encourage", "clap", "point", "love"];
const EXPECTED_MODES = ["full", "three-quarter", "bust", "avatar", "scene"];

if (character) {
  const { MOODS, MOOD_SUFFIX, MODES, BUST_FOCAL, artFor, CHARACTER } = character;
  for (const m of EXPECTED_MOODS) assert(MOODS?.includes(m), `mood ${m} declared`);
  for (const m of EXPECTED_MODES) assert(MODES && m in MODES, `display mode ${m} declared`);
  assert(CHARACTER?.id === "lumi" && CHARACTER?.role === "companion",
    "identity: Lumi is the companion (Joel remains the teacher)");
  assert(CHARACTER?.alt?.es && CHARACTER?.alt?.en, "meaningful alt text is centrally defined, bilingual");

  // Art resolution + focal table cover every mood (no per-callsite hacks).
  assert(artFor?.("/character/lumi", "cheer") === "/character/lumi-cheer.png", "artFor resolves mood art");
  assert(artFor?.("/character/lumi", "wave") === "/character/lumi.png", "wave shares the base art");
  for (const m of EXPECTED_MOODS) {
    assert(BUST_FOCAL && BUST_FOCAL[m], `bust focal crop defined centrally for ${m}`);
  }

  // Modes are contain-safe: only the face chips (bust/avatar) may crop, and
  // they must declare the focal strategy rather than free-cropping.
  for (const [name, mode] of Object.entries(MODES ?? {})) {
    if (name === "bust" || name === "avatar") assert(mode.fit === "focal", `${name} declares its focal crop`);
    else assert(mode.fit === "contain", `mode ${name} is contain-safe (never cover/stretch)`);
  }

  // --- 2. Asset integrity ---------------------------------------------------
  // Every mood must resolve to a real file for the default base and for every
  // outfit base in the catalog source.
  const cosmeticsSrc = readFileSync(join(ROOT, "lib/cosmetics.ts"), "utf8");
  const bases = ["/character/lumi", ...new Set([...cosmeticsSrc.matchAll(/outfit:\s*"([^"]+)"/g)].map((m) => m[1]))];
  for (const base of bases) {
    for (const m of MOODS ?? []) {
      const p = join(ROOT, "public", artFor(base, m).replace(/^\//, ""));
      assert(existsSync(p), `asset exists: ${artFor(base, m)}`);
    }
  }
  // And nothing in the pose directories is orphaned from the mood set.
  const suffixes = new Set(Object.values(MOOD_SUFFIX ?? {}));
  const outfitFiles = readdirSync(join(ROOT, "public/character/outfits"));
  for (const f of outfitFiles) {
    const m = f.match(/^[a-z]+(-[a-z]+)?\.png$/);
    assert(m && suffixes.has(m[1] ?? ""), `outfit file ${f} maps to a declared mood`);
  }
}

// --- 3. Component contracts -------------------------------------------------
const compDir = join(ROOT, "components/character");
let compFiles = [];
try {
  compFiles = readdirSync(compDir).filter((f) => f.endsWith(".tsx"));
} catch {
  /* red until the directory exists */
}
assert(compFiles.length >= 4,
  "components/character/ exists with illustration/avatar/reaction/preview");

for (const f of compFiles) {
  const src = readFileSync(join(compDir, f), "utf8");
  if (f === "character-illustration.tsx") {
    // The focal branch (bust/avatar) is the ONE sanctioned crop, and it must
    // be driven by the central focal table — never ad-hoc per call site.
    const covers = src.match(/object-cover/g) ?? [];
    assert(covers.length === 1 && /BUST_FOCAL/.test(src),
      `${f} crops only in its focal branch, via the central BUST_FOCAL table`);
  } else {
    assert(!/object-cover/.test(src), `${f} never uses object-cover on character art`);
  }
  assert(!/animate-float/.test(src), `${f} adds no ambient infinite motion`);
}
const illusPath = join(compDir, "character-illustration.tsx");
if (existsSync(illusPath)) {
  const src = readFileSync(illusPath, "utf8");
  assert(/aria-hidden/.test(src) && /alt\?/.test(src),
    "CharacterIllustration is decorative by default, meaningful alt opt-in");
}

// --- 4. Migrated surfaces use the character system --------------------------
const MIGRATED = [
  "app/shop/page.tsx",
  "app/mundo/page.tsx",
  "components/onboarding-flow.tsx",
  "components/practice/produce-panel.tsx",
];
for (const f of MIGRATED) {
  const src = readFileSync(join(ROOT, f), "utf8");
  assert(/@\/components\/character/.test(src), `${f} imports the character system`);
  assert(!/"\/character\/lumi/.test(src), `${f} has no raw character asset paths`);
}
// The store preview goes through the responsive CharacterPreview composition.
assert(/CharacterPreview/.test(readFileSync(join(ROOT, "app/shop/page.tsx"), "utf8")),
  "store preview uses CharacterPreview");
const previewSrc = readFileSync(join(ROOT, "components/character/character-preview.tsx"), "utf8");
const sceneSrc = readFileSync(join(ROOT, "components/lumi-scene.tsx"), "utf8");
const shopSrc = readFileSync(join(ROOT, "app/shop/page.tsx"), "utf8");
assert(/outfit\?: string/.test(previewSrc) && /outfit=\{outfit\}/.test(previewSrc),
  "CharacterPreview accepts and forwards a temporary outfit");
assert(/outfit\?: string/.test(sceneSrc) && /outfit=\{outfit\}/.test(sceneSrc),
  "LumiScene forwards the temporary outfit to Lumi");
assert(/priority/.test(previewSrc) && /priority=\{priority\}/.test(sceneSrc),
  "above-the-fold store preview preloads its character art");
assert(/previewCosmetic/.test(shopSrc) && /previewOutfit/.test(shopSrc),
  "store derives a pre-purchase preview from the selected cosmetic");

console.log(`character: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
