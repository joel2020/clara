// node lib/ui/typography.test.mjs
//
// Typography rendering gate. Pins the production distorted-letter defect
// diagnosed on the deployed build (2026-07-28) so it cannot ship again:
//
//   1. IPA transcriptions must never render in the app fonts. Geist and
//      Geist Mono are served as latin subsets with ZERO IPA glyphs
//      (verified via document.fonts.check against production), so every IPA
//      character fell back per-character to whatever system font had it —
//      a mid-word typeface swap that reads as distorted/stretched/malformed
//      letters (the broken "Ɔ" in /ˈdɔːtər/). IPA-bearing JSX must use the
//      dedicated .font-ipa utility, which selects ONE face with full IPA
//      coverage (the platform UI font) for the whole transcription.
//
//   2. The .font-ipa utility must exist, must not lead with the subsetted app
//      fonts, and must neutralize inherited font-feature-settings (the body
//      sets Geist-specific cv/ss sets that other faces may misinterpret).
//
//   3. No animation may leave text visibly distorted: any @keyframes final
//      frame that retains a skew or non-identity scale/rotate must belong to
//      an element that has also faded to opacity 0 by that frame (particles
//      and overlay sweeps — invisible transforms can't distort anything).
//      The production audit found no violations; this pins that state.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let ok = 0, fail = 0;
const assert = (cond, msg) => { if (cond) ok++; else { fail++; console.log("FAIL", msg); } };

function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const rel = join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (e.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

// --- 1. IPA render sites use .font-ipa, never the subsetted app fonts -------
const IPA_EXPR = /\{(?:\w+\.)?ipa\}/; // {item.ipa}, {current.ipa}, {opt.ipa}, {ipa}
const files = [...walk("app"), ...walk("components")];
let ipaSites = 0;
for (const f of files) {
  const lines = readFileSync(join(ROOT, f), "utf8").split("\n");
  lines.forEach((line, i) => {
    if (!IPA_EXPR.test(line)) return;
    ipaSites++;
    const where = `${f}:${i + 1}`;
    assert(!/font-mono/.test(line), `${where} renders IPA in font-mono (no IPA glyphs in the served subset)`);
    assert(!/font-display/.test(line), `${where} renders IPA in the display serif (no IPA glyphs)`);
    assert(/font-ipa/.test(line), `${where} renders IPA without the .font-ipa utility`);
  });
}
assert(ipaSites >= 4, `expected the known IPA render sites to be scanned (found ${ipaSites})`);

// /play's sound list renders IPA through the `subtitle` field ("/ɪ/ vs /iː/"),
// which the generic {x.ipa} pattern can't see — pinned explicitly.
{
  const play = readFileSync(join(ROOT, "app/play/page.tsx"), "utf8").split("\n");
  play.forEach((line, i) => {
    if (!/\{l\.subtitle\}/.test(line)) return;
    assert(/font-ipa/.test(line) && !/font-mono/.test(line),
      `app/play/page.tsx:${i + 1} renders IPA-bearing subtitles without .font-ipa`);
  });
}

// --- 2. The .font-ipa utility itself ---------------------------------------
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
const ipaRule = css.match(/\.font-ipa\s*\{[^}]*\}/);
assert(ipaRule, ".font-ipa utility is defined in globals.css");
if (ipaRule) {
  const body = ipaRule[0];
  assert(/font-family:\s*system-ui/.test(body), ".font-ipa leads with system-ui (full IPA coverage on every platform)");
  assert(!/var\(--font-mono\)|var\(--font-sans\)|Geist/.test(body), ".font-ipa must not fall through the subsetted app fonts");
  assert(/font-feature-settings:\s*normal/.test(body), ".font-ipa neutralizes inherited Geist feature settings");
}

// --- 3. Final animation frames may not retain a visible distortion ----------
// A retained transform is only allowed if that same final frame is invisible
// (opacity: 0). Frames are "to"/"100%" blocks inside each @keyframes.
//
// Infinite loops have no "retained" final frame — their 100% is a mid-cycle
// waypoint. Each allowlisted loop below is infinite AND applies only to
// non-text elements (verified 2026-07-28); adding a new name here requires
// re-verifying both properties.
const INFINITE_NON_TEXT_LOOPS = new Set([
  "eq-bounce", // speaking-indicator bars (empty <i> elements)
  "lumi-sway", // Lumi illustration
  "cine-ray-spin", // decorative light rays (aria-hidden overlay)
  "spin-slow", // map-node conic halo (::before, no text)
]);
const keyframeBlocks = css.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\n\}/g);
for (const [, name, kfBody] of keyframeBlocks) {
  if (INFINITE_NON_TEXT_LOOPS.has(name)) { ok++; continue; }
  const finals = [...kfBody.matchAll(/(?:^|\s)(?:to|100%)[^{]*\{([^}]*)\}/g)].map((m) => m[1]);
  for (const frame of finals) {
    const skewed = /skew[XY]?\(\s*-?\d*\.?\d+(?:deg)?\s*\)/.test(frame) && !/skew[XY]?\(\s*0(?:deg)?\s*\)/.test(frame);
    const scaled = /scale[XY]?\(\s*(?!1(?:\.0*)?\s*[,)])[\d.]+/.test(frame);
    const rotated = /rotate[XYZ]?\(\s*(?!0(?:deg)?\s*\))-?\d*\.?\d+/.test(frame);
    const invisible = /opacity:\s*0(?:\D|$)/.test(frame);
    assert(
      !(skewed || scaled || rotated) || invisible,
      `@keyframes ${name} ends with a retained visible transform — text inside it would stay distorted`,
    );
  }
}

// --- 4. The dashboard starts with today's guided session -------------------
// This is deliberately source-level: the order is the product hierarchy, and
// rendering the data hooks in a DOM test would require the IndexedDB app shell.
{
  const home = readFileSync(join(ROOT, "app/page.tsx"), "utf8");
  const cardPath = join(ROOT, "components/today-session-card.tsx");
  const card = existsSync(cardPath) ? readFileSync(cardPath, "utf8") : "";
  const first = (needle) => home.indexOf(needle);

  assert(first("<TodaySessionCard") >= 0, "home renders TodaySessionCard");
  for (const later of ["<ReadinessCard", "<PlayerBar", "<ReviewCallout", "homeExplore"]) {
    assert(
      first("<TodaySessionCard") >= 0 && first("<TodaySessionCard") < first(later),
      `TodaySessionCard appears before ${later}`,
    );
  }
  assert(Boolean(card), "TodaySessionCard source exists");
  assert(/<section[\s>]/.test(card), "TodaySessionCard has a semantic section");
  for (const detail of [
    "objective",
    "outcome",
    "estimatedMinutes",
    "sessionProgress",
    "todayReward",
    "todayStart",
    "todayContinue",
  ]) {
    assert(card.includes(detail), `TodaySessionCard includes ${detail}`);
  }
}

// --- 5. Today is a guided, resumable daily-session runner ------------------
// These source contracts pin the cross-route wiring and learner-visible
// states without booting the IndexedDB-backed application shell.
{
  const today = readFileSync(join(ROOT, "app/today/page.tsx"), "utf8");
  const component = (name) => {
    const path = join(ROOT, "components/daily-session", name);
    return existsSync(path) ? readFileSync(path, "utf8") : "";
  };
  const intro = component("session-intro.tsx");
  const shell = component("activity-shell.tsx");
  const navigation = component("navigation.ts");
  const recovery = component("technical-recovery.tsx");
  const complete = component("session-complete.tsx");

  for (const [name, source] of [
    ["SessionIntro", intro],
    ["ActivityShell", shell],
    ["TechnicalRecovery", recovery],
    ["SessionComplete", complete],
  ]) {
    assert(Boolean(source), `${name} source exists`);
    assert(today.includes(`<${name}`), `/today renders ${name}`);
  }

  for (const detail of [
    "sessionProgress",
    "estimatedMinutes",
    "todaySessionSaved",
    "objective",
  ]) {
    assert(shell.includes(detail), `ActivityShell includes ${detail}`);
  }
  assert(
    shell.includes("activityHref") &&
      navigation.includes("returnTo") &&
      navigation.includes("sessionActivity"),
    "activity links preserve the /today return checkpoint",
  );
  assert(
    navigation.includes("sessionDay") && today.includes("staleDay"),
    "returns that crossed midnight cannot credit today's new session",
  );
  assert(
    today.includes("todayUnavailableTitle") && today.includes("todayUnavailableRetry"),
    "a session that cannot be composed explains itself instead of hanging on the splash",
  );
  for (const detail of [
    "todayTechnicalSafe",
    "todayTechnicalNoScore",
    "todayTechnicalRetry",
    "todayTechnicalListen",
  ]) {
    assert(recovery.includes(detail), `TechnicalRecovery includes ${detail}`);
  }
  for (const detail of [
    "todayCompletionPracticed",
    "todayCompletionImproved",
    "todayCompletionReview",
    "todayCompletionReward",
    "todayCompletionTomorrow",
    "todayDoneForToday",
  ]) {
    assert(complete.includes(detail), `SessionComplete includes ${detail}`);
  }
  assert(
    today.includes('searchParams.get("sessionActivity")'),
    "/today reads the returning activity checkpoint",
  );
  for (const route of [
    "app/lesson/[id]/page.tsx",
    "app/review/page.tsx",
    "app/listen/page.tsx",
    "app/shadow/page.tsx",
    "app/talk/page.tsx",
  ]) {
    const source = readFileSync(join(ROOT, route), "utf8");
    assert(
      source.includes("useSessionReturn"),
      `${route} honors the daily-session return query`,
    );
  }
}

// --- 6. Dashboard activity state is truthful and accessible ----------------
{
  const card = readFileSync(join(ROOT, "components/today-session-card.tsx"), "utf8");
  for (const attr of [
    'role="progressbar"',
    "aria-valuenow",
    "aria-valuemin",
    "aria-valuemax",
  ]) {
    assert(card.includes(attr), `dashboard progress includes ${attr}`);
  }
  assert(
    /activity\.status\s*===\s*"completed"[\s\S]*?<Check/.test(card),
    "dashboard shows check icons only for completed activities",
  );
  assert(
    !card.includes("current === null"),
    "dashboard removes the dead current-activity conditional",
  );
}

console.log(`typography: ${ok} ok, ${fail} failed`);
if (fail) process.exit(1);
