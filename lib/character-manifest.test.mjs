// node lib/character-manifest.test.mjs
//
// Clara manifest gate (plan Task 1). Pins the typed asset contract that Task 2
// renders production art against: seven approved states, four frames each,
// normalized safe areas and focal anchors, bilingual alt, reduced-motion
// stills, and the /character/clara/<state>-<frame>.webp naming scheme
// (threeQuarter spelled three-quarter on disk). Clara is the sole
// learner-facing guide; Joel remains the real instructor.
let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

let character = null;
try {
  character = await import("./character.ts");
} catch {
  /* red until the manifest exists */
}
assert(character?.CLARA_ASSETS, "lib/character.ts exports CLARA_ASSETS");

const STATES = ["welcome", "teaching", "listening", "encouraging", "thinking", "celebrating", "store"];
const FRAMES = ["avatar", "bust", "full", "threeQuarter"];
const SLUG = { full: "full", threeQuarter: "three-quarter", bust: "bust", avatar: "avatar" };

if (character?.CLARA_ASSETS) {
  const { CLARA_ASSETS, CHARACTER_STATES, CHARACTER_FRAMES, FRAME_SLUG } = character;

  // The manifest covers exactly the seven approved states — no expansion
  // before the master-sheet gate.
  assert(JSON.stringify(Object.keys(CLARA_ASSETS).sort()) === JSON.stringify([...STATES].sort()),
    "CLARA_ASSETS covers exactly the seven approved states");
  assert(JSON.stringify([...(CHARACTER_STATES ?? [])].sort()) === JSON.stringify([...STATES].sort()),
    "CHARACTER_STATES lists the same seven states");
  assert(JSON.stringify([...(CHARACTER_FRAMES ?? [])].sort()) === JSON.stringify([...FRAMES].sort()),
    "CHARACTER_FRAMES lists full/threeQuarter/bust/avatar");
  assert(JSON.stringify(FRAME_SLUG) === JSON.stringify(SLUG),
    "FRAME_SLUG maps threeQuarter to three-quarter on disk");

  const inUnit = (n) => typeof n === "number" && n >= 0 && n <= 1;

  for (const state of STATES) {
    const s = CLARA_ASSETS[state];

    // Every state ships all four frames, each on the naming scheme.
    assert(JSON.stringify(Object.keys(s.frames).sort()) === JSON.stringify([...FRAMES].sort()),
      `${state} has all four frames`);
    for (const [frame, slug] of Object.entries(SLUG)) {
      assert(s.frames[frame] === `/character/clara/${state}-${slug}.webp`,
        `${state}.${frame} path matches /character/clara/${state}-${slug}.webp`);
    }

    // Safe area: normalized inset from every edge.
    assert(s.safeArea, `${state} declares a safe area`);
    for (const edge of ["top", "right", "bottom", "left"]) {
      assert(inUnit(s.safeArea?.[edge]), `${state} safeArea.${edge} is normalized 0..1`);
    }

    // Focal anchor: her face, normalized on the full-figure canvas.
    assert(inUnit(s.anchor?.x) && inUnit(s.anchor?.y), `${state} anchor is within 0..1`);

    // Bilingual alt for the informative cases (decorative use renders empty).
    assert(typeof s.alt?.es === "string" && s.alt.es.length > 0, `${state} has Spanish alt text`);
    assert(typeof s.alt?.en === "string" && s.alt.en.length > 0, `${state} has English alt text`);

    // Reduced motion falls back to the exact matching still — one of the
    // state's own frames, never a substitute pose.
    assert(typeof s.reducedMotion === "string" && Object.values(s.frames).includes(s.reducedMotion),
      `${state} reducedMotion is one of its own frame stills`);

    // Each state documents where it appears.
    assert(Array.isArray(s.screens) && s.screens.length > 0, `${state} documents its intended screens`);
  }
}

// Joel approved the master sheet on 2026-07-30 and the seven states shipped, so
// the manifest's paths must now actually resolve on disk. Without this, a
// renamed or missing frame degrades silently to a placeholder in production and
// nothing fails.
if (character?.CLARA_ASSETS && character.CLARA_ARTWORK_AVAILABLE) {
  const { existsSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  for (const state of STATES) {
    for (const frame of FRAMES) {
      const rel = character.CLARA_ASSETS[state].frames[frame];
      assert(existsSync(join(ROOT, "public", rel)), `${state}/${frame} exists on disk (${rel})`);
    }
    const still = character.CLARA_ASSETS[state].reducedMotion;
    assert(existsSync(join(ROOT, "public", still)), `${state} reduced-motion still exists (${still})`);
  }
}

console.log(`character-manifest: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
