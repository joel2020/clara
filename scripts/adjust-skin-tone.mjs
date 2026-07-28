// Adjust Lumi's skin tone across every pose and outfit.
//
//   node scripts/adjust-skin-tone.mjs            # apply the default lift
//   AMOUNT=0.4 node scripts/adjust-skin-tone.mjs # gentler
//   DRY=1 node scripts/adjust-skin-tone.mjs      # report only, write nothing
//
// Why pixel surgery rather than regenerating the art: there are 78 images (8
// base poses plus 10 outfits x 7 poses) and every one has to stay recognisably
// the SAME girl, in the same pose, wearing the same outfit. An image model
// redraws her differently each time; editing pixels changes the tone and
// nothing else. The originals live in git history, so `git checkout -- public/
// character` restores them.
//
// Method: each pixel goes to HSV and counts as skin only when it sits in the
// skin hue band, is not saturated enough to be fabric, and is not near-black
// line art. Matching pixels get a lightness lift with a slight saturation
// pull-down (so the lift does not read as orange), weighted by how confidently
// the pixel reads as skin — which feathers the edges instead of banding them.
//
// Deliberately skipped: lumi-depth.png is a greyscale depth map, not artwork.
// It would score zero weight anyway (no saturation), but it is excluded by name
// so the intent is explicit.
import sharp from "sharp";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const AMOUNT = Number(process.env.AMOUNT ?? "0.55");
// Brightness floor separating skin from hair. Her hair is brown, so it shares
// the skin hue band and a naive filter lifts it too — which is the opposite of
// what is wanted when the point is to match a learner with dark hair. Skin is
// brighter than the hair everywhere in this art, even in shadow, so value is
// the discriminator hue cannot be. Feathered over FLOOR_FEATHER so shadowed
// skin fades out smoothly instead of leaving a hard edge.
const MIN_V = Number(process.env.MIN_V ?? "0.55");
const FLOOR_FEATHER = 0.12;
const DRY = process.env.DRY === "1";
const ROOT = "public/character";
const SKIP = new Set(["lumi-depth.png"]);

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** 0..1 confidence that a pixel is skin. */
function skinWeight(h, s, v) {
  if (v < MIN_V) return 0;       // hair, line art, deep shadow
  if (s < 0.06) return 0;        // greys, whites, eye highlights
  if (h < 5 || h > 52) return 0; // outside the skin hue band
  if (s > 0.72) return 0;        // saturated -> fabric (her hoodie is yellow)
  const hueEdge = Math.min((h - 5) / 12, (52 - h) / 12, 1);
  const satEdge = Math.min((s - 0.06) / 0.08, (0.72 - s) / 0.15, 1);
  const valEdge = Math.min((v - MIN_V) / FLOOR_FEATHER, 1);
  return (
    Math.max(0, Math.min(1, hueEdge)) *
    Math.max(0, Math.min(1, satEdge)) *
    Math.max(0, Math.min(1, valEdge))
  );
}

async function adjust(file, amount) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = info.width * info.height;
  let touched = 0;
  for (let i = 0; i < px; i++) {
    const o = i * info.channels;
    if (data[o + 3] < 8) continue;
    const [h, s, v] = rgbToHsv(data[o], data[o + 1], data[o + 2]);
    const w = skinWeight(h, s, v);
    if (w === 0) continue;
    touched++;
    const k = amount * w;
    const [r, g, b] = hsvToRgb(h, Math.max(0, s * (1 - k * 0.42)), Math.min(1, v + (1 - v) * k));
    data[o] = Math.round(r);
    data[o + 1] = Math.round(g);
    data[o + 2] = Math.round(b);
  }
  if (!DRY) {
    await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
      .png()
      .toFile(file + ".tmp");
    const { renameSync } = await import("node:fs");
    renameSync(file + ".tmp", file);
  }
  return { touched, pct: (touched / px) * 100 };
}

function lumiPngs(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      out.push(...lumiPngs(p));
    } else if (name.endsWith(".png") && !SKIP.has(name) && !name.startsWith("joel-")) {
      out.push(p);
    }
  }
  return out;
}

const files = lumiPngs(ROOT).sort();
console.log(`${DRY ? "DRY RUN — " : ""}adjusting ${files.length} images at AMOUNT=${AMOUNT}\n`);

let changed = 0;
let untouched = [];
for (const f of files) {
  const r = await adjust(f, AMOUNT);
  if (r.touched === 0) untouched.push(f);
  else changed++;
  console.log(`  ${r.pct.toFixed(1).padStart(5)}%  ${f}`);
}

console.log(`\n${changed}/${files.length} images adjusted.`);
if (untouched.length) {
  // A file with no skin pixels means the detector missed — worth knowing rather
  // than silently shipping one pose that no longer matches the others.
  console.log(`WARNING — no skin found in ${untouched.length}: ${untouched.join(", ")}`);
  process.exit(1);
}
