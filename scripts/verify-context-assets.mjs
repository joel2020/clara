import { createHash } from "node:crypto";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

export const MAX_MOBILE_ENV_BYTES = 180 * 1024;
export const MAX_OBJECT_BYTES = 60 * 1024;
export const MAX_INITIAL_STORY_BYTES = 450 * 1024;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = join(ROOT, "docs/redesign/assets/context-scene-manifest.json");
const INITIAL_STORY_OBJECT_IDS = ["coffee", "menu", "table", "card"];
const REQUIRED_DIMENSIONS = {
  "environment-mobile": {
    type: "environment",
    width: 780,
    height: 1688,
    runtimePath: "public/visual-learning/cafe-restaurant/environment-mobile.webp",
  },
  "environment-desktop": {
    type: "environment",
    width: 2880,
    height: 1800,
    runtimePath: "public/visual-learning/cafe-restaurant/environment-desktop.webp",
  },
  ...Object.fromEntries([
    "card", "change", "check", "chicken", "coffee", "meal", "menu", "onion", "table", "takeaway-bag",
  ].map((id) => [id, {
    type: "object",
    width: 512,
    height: 512,
    runtimePath: `public/visual-learning/cafe-restaurant/objects/${id}.webp`,
  }])),
};

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function safeRuntimeFile(root, runtimePath) {
  if (!isText(runtimePath) || isAbsolute(runtimePath) || /^[a-z][a-z\d+.-]*:/i.test(runtimePath)) {
    return { error: "runtime path must stay inside the public asset root" };
  }
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, runtimePath);
  const assetRoot = resolve(absoluteRoot, "public/visual-learning");
  const assetTrail = relative(assetRoot, absolutePath);
  if (!assetTrail || assetTrail.startsWith("..") || isAbsolute(assetTrail)) {
    return { error: "runtime path must stay inside the public asset root" };
  }

  try {
    let cursor = absoluteRoot;
    if (lstatSync(cursor).isSymbolicLink()) {
      return { error: "runtime path must not contain symbolic links" };
    }
    for (const segment of relative(absoluteRoot, absolutePath).split(sep)) {
      cursor = join(cursor, segment);
      if (lstatSync(cursor).isSymbolicLink()) {
        return { error: "runtime path must not contain symbolic links" };
      }
    }
  } catch (error) {
    if (error?.code === "ENOENT") return { error: "accepted runtime file is missing" };
    return { error: "runtime file could not be inspected" };
  }
  return { path: absolutePath };
}

function validateProvenance(asset, label, errors) {
  const requiredText = [
    "runtimePath", "approvalId", "generationId", "promptSha256", "model", "generatedAt",
    "reviewer", "reviewedAt", "sha256", "sourceSha256",
  ];
  for (const field of requiredText) {
    if (!isText(asset[field])) errors.push(`${label}: accepted provenance is missing ${field}`);
  }
  if (!isRecord(asset.settings) || Object.keys(asset.settings).length === 0) {
    errors.push(`${label}: accepted provenance is missing settings`);
  }
  for (const field of ["promptSha256", "sha256", "sourceSha256"]) {
    if (isText(asset[field]) && !/^[a-f\d]{64}$/.test(asset[field])) {
      errors.push(`${label}: accepted provenance has invalid ${field}`);
    }
  }
  for (const field of ["generatedAt", "reviewedAt"]) {
    if (isText(asset[field]) &&
      (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(asset[field]) ||
        Number.isNaN(Date.parse(asset[field])))) {
      errors.push(`${label}: accepted provenance has invalid ${field}`);
    }
  }
  if (!Number.isFinite(asset.creditCost) || asset.creditCost < 0) {
    errors.push(`${label}: accepted provenance has invalid creditCost`);
  }
  for (const field of ["sourceWidth", "sourceHeight", "width", "height", "bytes"]) {
    if (!Number.isInteger(asset[field]) || asset[field] <= 0) {
      errors.push(`${label}: accepted provenance has invalid ${field}`);
    }
  }
}

async function inspectAsset({ asset, root, definition, id, label }) {
  const errors = [];
  const resolved = safeRuntimeFile(root, asset.runtimePath);
  if (resolved.error) return { errors: [`${label}: ${resolved.error}`], bytes: 0 };
  const path = resolved.path;
  let bytes = 0;
  try {
    const fileStat = statSync(path);
    if (!fileStat.isFile()) {
      return { errors: [`${label}: runtime file must be a regular file`], bytes: 0 };
    }
    bytes = fileStat.size;
    if (asset.type === "object" && bytes > MAX_OBJECT_BYTES) {
      errors.push(`${label}: object budget ${MAX_OBJECT_BYTES} bytes exceeded (${bytes} bytes)`);
    }
    if (id === "environment-mobile" && bytes > MAX_MOBILE_ENV_BYTES) {
      errors.push(`${label}: mobile environment budget ${MAX_MOBILE_ENV_BYTES} bytes exceeded (${bytes} bytes)`);
    }
    if (asset.bytes !== bytes) errors.push(`${label}: recorded byte size does not match runtime file`);
    if (isText(asset.sha256) && asset.sha256 !== sha256(path)) {
      errors.push(`${label}: recorded SHA-256 does not match runtime file`);
    }

    const image = sharp(path, { failOn: "error" });
    const metadata = await image.metadata();
    if (metadata.format !== "webp") errors.push(`${label}: runtime file must be decodable WebP`);
    if (metadata.width !== definition.width || metadata.height !== definition.height) {
      errors.push(`${label}: intrinsic dimensions must be ${definition.width}x${definition.height}`);
    }
    if (asset.width !== definition.width || asset.height !== definition.height) {
      errors.push(`${label}: recorded dimensions must be ${definition.width}x${definition.height}`);
    }

    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    let nonOpaque = 0;
    let visible = 0;
    for (let offset = 3; offset < data.length; offset += info.channels) {
      if (data[offset] <= 16) transparent += 1;
      if (data[offset] < 255) nonOpaque += 1;
      if (data[offset] >= 239) visible += 1;
    }
    const pixels = info.width * info.height;
    if (asset.type === "environment" && nonOpaque > 0) {
      errors.push(`${label}: environment must be opaque`);
    }
    if (asset.type === "object" && transparent / pixels < 0.1) {
      errors.push(`${label}: object needs meaningful alpha transparency`);
    }
    if (asset.type === "object" && visible / pixels < 0.01) {
      errors.push(`${label}: object needs meaningful visible pixels`);
    }
  } catch {
    errors.push(`${label}: runtime file could not be inspected or decoded as WebP`);
  }
  return { errors, bytes };
}

export async function verifyContextAssets({ root = ROOT, manifestPath = DEFAULT_MANIFEST_PATH } = {}) {
  const errors = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { errors: ["manifest: accepted provenance manifest is unreadable"] };
  }
  if (!isRecord(manifest) || !Array.isArray(manifest.assets)) {
    return { errors: ["manifest: assets must be an array"] };
  }
  if (manifest.runtimeGeneration !== false) {
    errors.push("manifest: runtime generation must remain disabled");
  }

  const accepted = manifest.assets
    .map((asset, index) => ({ asset, index }))
    .filter(({ asset }) => asset?.status === "accepted");
  const seenPaths = new Set();
  const seenIds = new Set();
  const actualBytes = new Map();
  for (const { asset, index } of accepted) {
    if (!isRecord(asset)) {
      errors.push(`assets[${index}]: accepted provenance entry must be an object`);
      continue;
    }
    const id = isText(asset.id) && Object.hasOwn(REQUIRED_DIMENSIONS, asset.id) ? asset.id : null;
    const label = id ?? `assets[${index}]`;
    if (id === null) {
      errors.push(`${label}: accepted asset ID is not registered`);
      continue;
    }
    const definition = REQUIRED_DIMENSIONS[id];
    if (seenIds.has(id)) errors.push(`${id}: accepted asset ID must be unique`);
    seenIds.add(id);
    validateProvenance(asset, label, errors);
    if (asset.type !== definition.type) errors.push(`${id}: asset type must be ${definition.type}`);
    if (asset.runtimePath !== definition.runtimePath) {
      errors.push(`${id}: runtime path must be the locked path`);
      continue;
    }
    if (seenPaths.has(asset.runtimePath)) errors.push(`${id}: runtime path must be unique`);
    seenPaths.add(asset.runtimePath);
    const inspected = await inspectAsset({ asset, root, definition, id, label });
    errors.push(...inspected.errors);
    actualBytes.set(id, inspected.bytes);
  }

  for (const id of Object.keys(REQUIRED_DIMENSIONS)) {
    if (!seenIds.has(id)) errors.push(`${id}: required accepted asset is missing`);
  }

  for (const environmentId of ["environment-mobile", "environment-desktop"]) {
    const environmentBytes = actualBytes.get(environmentId);
    const missingObjects = INITIAL_STORY_OBJECT_IDS.filter((id) => !actualBytes.has(id));
    if (environmentBytes === undefined || missingObjects.length > 0) continue;
    const total = INITIAL_STORY_OBJECT_IDS.reduce((sum, id) => sum + actualBytes.get(id), environmentBytes);
    if (total > MAX_INITIAL_STORY_BYTES) {
      errors.push(`${environmentId}: initial story budget ${MAX_INITIAL_STORY_BYTES} bytes exceeded (${total} bytes)`);
    }
  }

  return { errors };
}

async function run() {
  const result = await verifyContextAssets();
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`context-assets: ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("context-assets: accepted assets and story payload are within budget");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run();
}
