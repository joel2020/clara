import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

import { verifyContextAssets } from "../../scripts/verify-context-assets.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const REAL_MANIFEST_PATH = join(ROOT, "docs/redesign/assets/context-scene-manifest.json");
const realManifest = JSON.parse(readFileSync(REAL_MANIFEST_PATH, "utf8"));
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const productionResult = await verifyContextAssets();
assert.deepEqual(productionResult.errors, [], productionResult.errors.join("\n"));

async function verifyManifest(manifest, root = ROOT) {
  const directory = mkdtempSync(join(tmpdir(), "clara-context-manifest-"));
  try {
    const manifestPath = join(directory, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify(manifest));
    return await verifyContextAssets({ root, manifestPath });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const duplicatePath = structuredClone(realManifest);
duplicatePath.assets.find((asset) => asset.id === "card").runtimePath =
  duplicatePath.assets.find((asset) => asset.id === "coffee").runtimePath;
assert.match(
  (await verifyManifest(duplicatePath)).errors.join("\n"),
  /card: runtime path must be the locked path/,
  "two accepted assets must never share a runtime path",
);

const aliasPath = structuredClone(realManifest);
const aliasCard = aliasPath.assets.find((asset) => asset.id === "card");
const aliasCoffee = aliasPath.assets.find((asset) => asset.id === "coffee");
aliasCard.runtimePath = "public/visual-learning/cafe-restaurant/objects/../objects/coffee.webp";
aliasCard.bytes = aliasCoffee.bytes;
aliasCard.sha256 = aliasCoffee.sha256;
assert.match(
  (await verifyManifest(aliasPath)).errors.join("\n"),
  /card: runtime path must be the locked path/,
  "normalized path aliases must not let two logical assets share one physical file",
);

const missingProvenance = structuredClone(realManifest);
delete missingProvenance.assets.find((asset) => asset.id === "coffee").reviewer;
assert.match(
  (await verifyManifest(missingProvenance)).errors.join("\n"),
  /coffee: accepted provenance is missing reviewer/,
  "accepted files without complete review provenance must fail",
);

const malformedProvenance = structuredClone(realManifest);
const malformedCoffee = malformedProvenance.assets.find((asset) => asset.id === "coffee");
malformedCoffee.promptSha256 = "not-a-sha";
malformedCoffee.reviewedAt = "not-a-timestamp";
const malformedErrors = (await verifyManifest(malformedProvenance)).errors.join("\n");
assert.match(malformedErrors, /coffee: accepted provenance has invalid promptSha256/);
assert.match(malformedErrors, /coffee: accepted provenance has invalid reviewedAt/);

const wrongRecordedDimensions = structuredClone(realManifest);
wrongRecordedDimensions.assets.find((asset) => asset.id === "coffee").width = 511;
assert.match(
  (await verifyManifest(wrongRecordedDimensions)).errors.join("\n"),
  /coffee: recorded dimensions must be 512x512/,
  "recorded dimensions cannot redefine the locked asset contract",
);

const sensitiveManifest = structuredClone(realManifest);
const sensitiveCoffee = sensitiveManifest.assets.find((asset) => asset.id === "coffee");
sensitiveCoffee.runtimePath = "https://provider.example/generation?token=do-not-print";
sensitiveCoffee.generationId = "credential-do-not-print";
const sensitiveErrors = (await verifyManifest(sensitiveManifest)).errors.join("\n");
assert.match(sensitiveErrors, /coffee: runtime path must be the locked path/);
assert.doesNotMatch(sensitiveErrors, /provider\.example|do-not-print|credential/,
  "CI diagnostics must never expose provider URLs or credentials");

const maliciousIdManifest = structuredClone(realManifest);
maliciousIdManifest.assets.find((asset) => asset.id === "coffee").id =
  "https://provider.example/generation?token=id-secret-do-not-print";
const maliciousIdErrors = (await verifyManifest(maliciousIdManifest)).errors.join("\n");
assert.match(maliciousIdErrors, /assets\[\d+\]: accepted asset ID is not registered/,
  "unknown IDs must use a bounded manifest-position label");
assert.doesNotMatch(maliciousIdErrors, /provider\.example|id-secret|do-not-print/,
  "untrusted asset IDs must never enter CI diagnostics");

const fixtureRoot = mkdtempSync(join(tmpdir(), "clara-context-budget-"));

try {
  const runtimePath = "public/visual-learning/cafe-restaurant/objects/coffee.webp";
  const absolutePath = join(fixtureRoot, runtimePath);
  mkdirSync(join(fixtureRoot, "public/visual-learning/cafe-restaurant/objects"), { recursive: true });
  const pixels = randomBytes(512 * 512 * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const pixel = offset / 4;
    pixels[offset + 3] = pixel % 512 < 64 ? 0 : 255;
  }
  await sharp(pixels, { raw: { width: 512, height: 512, channels: 4 } })
    .webp({ lossless: true })
    .toFile(absolutePath);

  const manifestPath = join(fixtureRoot, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify({
    version: 1,
    provider: "fixture-provider",
    runtimeGeneration: false,
    assets: [{
      id: "coffee",
      type: "object",
      status: "accepted",
      runtimePath,
      generationId: "fixture-generation",
      promptSha256: "a".repeat(64),
      model: "fixture-model",
      settings: { quality: "test" },
      generatedAt: "2026-08-09T00:00:00.000Z",
      reviewer: "Fixture reviewer",
      reviewedAt: "2026-08-09T00:00:00.000Z",
      creditCost: 0,
      sha256: "b".repeat(64),
      sourceSha256: "c".repeat(64),
      sourceWidth: 512,
      sourceHeight: 512,
      width: 512,
      height: 512,
      bytes: 1,
    }],
  }));

  const result = await verifyContextAssets({ root: fixtureRoot, manifestPath });
  assert.match(
    result.errors.join("\n"),
    /coffee: object budget 61440 bytes exceeded/,
    "an oversized object must fail with its asset ID and exact budget",
  );
  assert.match(
    result.errors.join("\n"),
    /environment-mobile: required accepted asset is missing/,
    "an incomplete accepted pack must not pass the CI gate",
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

function acceptedAsset({ id, type, runtimePath, width, height, path }) {
  return {
    id,
    type,
    status: "accepted",
    runtimePath,
    approvalId: "fixture-approval",
    generationId: "fixture-generation",
    promptSha256: "a".repeat(64),
    model: "fixture-model",
    settings: { quality: "test" },
    generatedAt: "2026-08-09T00:00:00.000Z",
    reviewer: "Fixture reviewer",
    reviewedAt: "2026-08-09T00:00:00.000Z",
    creditCost: 0,
    sha256: digest(path),
    sourceSha256: "c".repeat(64),
    sourceWidth: width,
    sourceHeight: height,
    width,
    height,
    bytes: statSync(path).size,
  };
}

async function withImageFixture({ id, type, width, height, alpha, contents }, operation) {
  const root = mkdtempSync(join(tmpdir(), "clara-context-image-"));
  try {
    const runtimePath = type === "environment"
      ? `public/visual-learning/cafe-restaurant/${id}.webp`
      : `public/visual-learning/cafe-restaurant/objects/${id}.webp`;
    const path = join(root, runtimePath);
    mkdirSync(dirname(path), { recursive: true });
    if (contents) {
      writeFileSync(path, contents);
    } else {
      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 27, g: 80, b: 89, alpha },
        },
      }).webp().toFile(path);
    }
    const asset = acceptedAsset({ id, type, runtimePath, width, height, path });
    return await operation({ root, asset, path });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const symlinkRoot = mkdtempSync(join(tmpdir(), "clara-context-symlink-"));
try {
  const objectDirectory = join(symlinkRoot, "public/visual-learning/cafe-restaurant/objects");
  mkdirSync(objectDirectory, { recursive: true });
  const coffeePath = join(objectDirectory, "coffee.webp");
  copyFileSync(join(ROOT, "public/visual-learning/cafe-restaurant/objects/coffee.webp"), coffeePath);
  const cardPath = join(objectDirectory, "card.webp");
  symlinkSync("coffee.webp", cardPath);
  const assets = [
    acceptedAsset({
      id: "card",
      type: "object",
      runtimePath: "public/visual-learning/cafe-restaurant/objects/card.webp",
      width: 512,
      height: 512,
      path: cardPath,
    }),
    acceptedAsset({
      id: "coffee",
      type: "object",
      runtimePath: "public/visual-learning/cafe-restaurant/objects/coffee.webp",
      width: 512,
      height: 512,
      path: coffeePath,
    }),
  ];
  const result = await verifyManifest({ runtimeGeneration: false, assets }, symlinkRoot);
  assert.match(result.errors.join("\n"), /card: runtime path must not contain symbolic links/,
    "a locked runtime filename must not hide an alias to another accepted asset");
} finally {
  rmSync(symlinkRoot, { recursive: true, force: true });
}

const secretPathRoot = mkdtempSync(join(tmpdir(), "clara-context-secret-path-"));
try {
  const secretRuntimePath = "public/token=SECRET_CREDENTIAL.webp";
  mkdirSync(join(secretPathRoot, secretRuntimePath), { recursive: true });
  const secretManifest = {
    runtimeGeneration: false,
    assets: [{
      ...structuredClone(realManifest.assets.find((asset) => asset.id === "coffee")),
      runtimePath: secretRuntimePath,
    }],
  };
  let result;
  try {
    result = await verifyManifest(secretManifest, secretPathRoot);
  } catch (error) {
    assert.fail(`verifier must return safe errors instead of throwing: ${error?.name ?? "unknown error"}`);
  }
  const diagnostic = result.errors.join("\n");
  assert.match(diagnostic, /coffee: runtime path must be the locked path/);
  assert.doesNotMatch(diagnostic, /SECRET_CREDENTIAL|token=/,
    "a rejected runtime path must never reach filesystem diagnostics");
} finally {
  rmSync(secretPathRoot, { recursive: true, force: true });
}

await withImageFixture({
  id: "environment-mobile",
  type: "environment",
  width: 780,
  height: 1688,
  alpha: 0.5,
}, async ({ root, asset }) => {
  const result = await verifyManifest({ runtimeGeneration: false, assets: [asset] }, root);
  assert.match(result.errors.join("\n"), /environment-mobile: environment must be opaque/,
    "environment images must not carry transparency");
});

await withImageFixture({ id: "coffee", type: "object", width: 512, height: 512, alpha: 1 },
  async ({ root, asset }) => {
    const result = await verifyManifest({ runtimeGeneration: false, assets: [asset] }, root);
    assert.match(result.errors.join("\n"), /coffee: object needs meaningful alpha transparency/,
      "object images need a meaningful transparent surround");
  });

await withImageFixture({ id: "coffee", type: "object", width: 512, height: 512, alpha: 0 },
  async ({ root, asset }) => {
    const result = await verifyManifest({ runtimeGeneration: false, assets: [asset] }, root);
    assert.match(result.errors.join("\n"), /coffee: object needs meaningful visible pixels/,
      "a fully transparent object must not pass as meaningful alpha artwork");
  });

await withImageFixture({ id: "coffee", type: "object", width: 512, height: 512, contents: "not-webp" },
  async ({ root, asset }) => {
    const result = await verifyManifest({ runtimeGeneration: false, assets: [asset] }, root);
    assert.match(result.errors.join("\n"), /coffee: runtime file could not be inspected or decoded as WebP/,
      "a file extension alone must not satisfy the decoder gate");
  });

await withImageFixture({ id: "coffee", type: "object", width: 256, height: 256, alpha: 0 },
  async ({ root, asset }) => {
    const result = await verifyManifest({ runtimeGeneration: false, assets: [asset] }, root);
    assert.match(result.errors.join("\n"), /coffee: intrinsic dimensions must be 512x512/,
      "intrinsic dimensions must match the locked object contract");
  });

const mobileBudgetRoot = mkdtempSync(join(tmpdir(), "clara-context-mobile-budget-"));
try {
  const mobile = structuredClone(realManifest.assets.find((asset) => asset.id === "environment-mobile"));
  const source = join(ROOT, mobile.runtimePath);
  const target = join(mobileBudgetRoot, mobile.runtimePath);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  appendFileSync(target, Buffer.alloc(140 * 1024));
  mobile.bytes = statSync(target).size;
  mobile.sha256 = digest(target);
  const result = await verifyManifest({ runtimeGeneration: false, assets: [mobile] }, mobileBudgetRoot);
  assert.match(
    result.errors.join("\n"),
    /environment-mobile: mobile environment budget 184320 bytes exceeded/,
    "the mobile environment has its own transfer budget",
  );
} finally {
  rmSync(mobileBudgetRoot, { recursive: true, force: true });
}

const storyRoot = mkdtempSync(join(tmpdir(), "clara-context-story-"));
try {
  const storyManifest = structuredClone(realManifest);
  for (const asset of storyManifest.assets) {
    const source = join(ROOT, asset.runtimePath);
    const target = join(storyRoot, asset.runtimePath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  const desktop = storyManifest.assets.find((asset) => asset.id === "environment-desktop");
  const desktopPath = join(storyRoot, desktop.runtimePath);
  appendFileSync(desktopPath, Buffer.alloc(220 * 1024));
  desktop.bytes = statSync(desktopPath).size;
  desktop.sha256 = digest(desktopPath);
  const result = await verifyManifest(storyManifest, storyRoot);
  assert.match(
    result.errors.join("\n"),
    /environment-desktop: initial story budget 460800 bytes exceeded/,
    "the story gate must sum the real environment and first-use object bytes",
  );
} finally {
  rmSync(storyRoot, { recursive: true, force: true });
}

console.log("20 ok");
