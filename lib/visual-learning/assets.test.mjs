import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST_PATH = join(ROOT, "docs/redesign/assets/context-scene-manifest.json");

const cli = await import(join(ROOT, "scripts/context-assets.mjs")).catch(() => null);
assert.ok(cli, "scripts/context-assets.mjs must implement the asset contract");
const {
  ASSET_DEFINITIONS,
  INITIAL_STORY_OBJECT_IDS,
  assertAttemptAuthorized,
  calculateCoverCrop,
  calculateInitialStoryBytes,
  inspectImage,
  processCandidate,
  promptFor,
  validateManifest,
} = cli;

for (const [id, noun] of Object.entries({
  table: "table",
  chicken: "plated chicken meal",
  onion: "whole and sliced onion",
  meal: "plated café meal",
  check: "restaurant check/bill slip",
  card: "payment card",
  "takeaway-bag": "takeaway paper bag",
  change: "coins and small bills",
})) {
  assert.match(promptFor(id, "recraft-v4-1-remaining-objects-1"),
    new RegExp(`^Single isolated ${noun.replace("/", "\\/")} for `),
    `${id} must use its approved concrete recognizable noun`);
}

assert.equal(
  promptFor("menu"),
  "One single analog restaurant menu booklet, standing slightly open in three-quarter view, as a clean vector-like 2.5D editorial illustration for an adult English-learning app. Dark coral bound cover, visible center spine, two cream paper pages with only a few simple horizontal line groupings and small blank image rectangles that suggest a printed food menu without forming any readable characters. Clearly a physical handheld menu booklet, not a phone, tablet, app screen, control panel, sign, table, chair, or furniture. Centered and recognizable at 96 CSS pixels, restrained cel shading from upper left, isolated subject only, true transparent surroundings. No person, hand, food, text, letters, numbers, prices, logo, brand, watermark, button grid, checkerboard, colored background, frame, chibi style, or photorealism.",
  "menu must use the separately approved physical-booklet retry prompt",
);

const focalDefinition = ASSET_DEFINITIONS["environment-mobile"];
const centerCrop = calculateCoverCrop({
  sourceWidth: 2688,
  sourceHeight: 1536,
  targetWidth: focalDefinition.width,
  targetHeight: focalDefinition.height,
  focalPoint: { x: 0.5, y: 0.5 },
});
const configuredCrop = calculateCoverCrop({
  sourceWidth: 2688,
  sourceHeight: 1536,
  targetWidth: focalDefinition.width,
  targetHeight: focalDefinition.height,
  focalPoint: focalDefinition.cropFocalPoint,
});
assert.ok(!(600 >= centerCrop.left && 600 < centerCrop.left + centerCrop.width),
  "a center crop must demonstrate loss of the source's café counter focal cue");
assert.ok(600 >= configuredCrop.left && 600 < configuredCrop.left + configuredCrop.width,
  "the configured crop must retain the café counter focal cue");
assert.deepEqual(
  calculateCoverCrop({
    sourceWidth: 2688,
    sourceHeight: 1536,
    targetWidth: focalDefinition.width,
    targetHeight: focalDefinition.height,
    focalPoint: focalDefinition.cropFocalPoint,
  }),
  { left: 398, top: 0, width: 710, height: 1536 },
  "the configured focal crop must be deterministic",
);

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const originalManifestText = readFileSync(MANIFEST_PATH, "utf8");

async function withActiveApproval(approvalId, operation) {
  const temporaryManifest = structuredClone(manifest);
  for (const approval of temporaryManifest.batch.approvals) {
    if (approval.approvalStatus === "approved") approval.approvalStatus = "superseded";
    if (approval.id === approvalId) approval.approvalStatus = "approved";
  }
  temporaryManifest.batch.activeApprovalId = approvalId;
  temporaryManifest.batch.approvalStatus = "approved";
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(temporaryManifest, null, 2)}\n`);
  try {
    return await operation(temporaryManifest);
  } finally {
    writeFileSync(MANIFEST_PATH, originalManifestText);
  }
}

assert.equal(manifest.version, 1, "manifest schema version must be 1");
assert.equal(manifest.provider, "higgsfield", "manifest provider must be Higgsfield");
assert.equal(manifest.runtimeGeneration, false, "runtime generation must stay disabled");
assert.deepEqual(
  Object.keys(manifest.batch).sort(),
  ["activeApprovalId", "approvalStatus", "approvals", "approvedMaximumCredits", "estimatedCredits", "topicId"].sort(),
  "batch must use the bounded cost-approval schema",
);
const historicalMenuAttempt = manifest.assets.find((asset) => asset.id === "menu").rejectedAttempts[0];
assert.match(promptFor("menu", historicalMenuAttempt.approvalId, manifest), /^Single isolated menu for /);
assert.notEqual(
  promptFor("menu", historicalMenuAttempt.approvalId, manifest),
  promptFor("menu", manifest.batch.activeApprovalId, manifest),
  "a historical prompt must resolve from its own approval, not the current active approval",
);
assert.equal(manifest.batch.topicId, "cafe-restaurant");
assert.ok(Array.isArray(manifest.batch.approvals) && manifest.batch.approvals.length >= 4,
  "separate cost approvals must remain auditable");
assert.ok(manifest.batch.approvals.some((approval) =>
  approval.id === "gpt-image-2-test-1" && approval.approvalStatus === "exhausted" &&
  approval.approvedMaximumCredits === 28), "the exhausted GPT Image 2 approval must be retained");
assert.ok(manifest.batch.approvals.some((approval) =>
  approval.id === "recraft-v4-1-test-2" && approval.approvalStatus === "superseded" &&
  approval.approvedMaximumCredits === 36), "the Recraft V4.1 test approval must remain separate");
assert.ok(manifest.batch.approvals.some((approval) =>
  approval.id === "recraft-v4-1-remaining-objects-1" && approval.approvalStatus === "superseded" &&
  approval.approvedMaximumCredits === 90), "the remaining-object approval must remain separate");
assert.ok(manifest.batch.approvals.some((approval) =>
  approval.id === "recraft-v4-1-menu-retry-1" && approval.approvalStatus === "approved" &&
  approval.approvedMaximumCredits === 10), "the menu-retry approval must be separate and active");
assert.equal(manifest.batch.activeApprovalId, "recraft-v4-1-menu-retry-1");
assert.ok(Number.isFinite(manifest.batch.estimatedCredits) && manifest.batch.estimatedCredits >= 0);
assert.ok(Number.isFinite(manifest.batch.approvedMaximumCredits) && manifest.batch.approvedMaximumCredits >= 0);
assert.ok(["pending", "approved"].includes(manifest.batch.approvalStatus));
assert.ok(Array.isArray(manifest.assets), "manifest assets must be an array");

const forbiddenKeys = /^(?:token|secret|password|apiKey|learner|learnerId|userId|email|recording|transcript|rawAudio)$/i;
const visit = (value, trail = "manifest") => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, `${trail}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert.doesNotMatch(key, forbiddenKeys, `${trail}.${key} must not contain secrets or learner data`);
    visit(nested, `${trail}.${key}`);
  }
};
visit(manifest);

const structuralValidation = validateManifest(manifest, { root: ROOT, requireComplete: false });
assert.deepEqual(structuralValidation.errors, [], structuralValidation.errors.join("\n"));

const historicalPromptManifest = structuredClone(manifest);
historicalPromptManifest.batch.approvals.find((approval) =>
  approval.id === historicalPromptManifest.batch.activeApprovalId).approvalStatus = "superseded";
historicalPromptManifest.batch.activeApprovalId = "recraft-v4-1-remaining-objects-1";
historicalPromptManifest.batch.approvals.find((approval) =>
  approval.id === historicalPromptManifest.batch.activeApprovalId).approvalStatus = "approved";
assert.deepEqual(
  validateManifest(historicalPromptManifest, { root: ROOT, requireComplete: false }).errors,
  [],
  "activating a later historical approval must not change any earlier attempt's prompt validation",
);

const missingRejectedReviewer = structuredClone(manifest);
delete missingRejectedReviewer.assets.find((asset) => asset.rejectedAttempts?.length)
  .rejectedAttempts[0].reviewer;
assert.match(
  validateManifest(missingRejectedReviewer, { root: ROOT, requireComplete: false }).errors.join("\n"),
  /rejectedAttempts\[0\].*reviewer/i,
  "every rejected visual attempt must retain reviewer identity",
);

for (const field of ["sourceSha256", "sourceWidth", "sourceHeight"]) {
  const brokenMaster = structuredClone(manifest);
  const desktop = brokenMaster.assets.find((asset) => asset.id === "environment-desktop");
  desktop[field] = field === "sourceSha256" ? "0".repeat(64) : desktop[field] + 1;
  assert.match(
    validateManifest(brokenMaster, { root: ROOT, requireComplete: false }).errors.join("\n"),
    /environment.*same source master|source.*match/i,
    `environment master mismatch in ${field} must fail validation`,
  );
}

assert.deepEqual(INITIAL_STORY_OBJECT_IDS, ["coffee", "menu", "table", "card"]);
assert.equal(calculateInitialStoryBytes(manifest, "environment-mobile"), 140_926);
assert.equal(calculateInitialStoryBytes(manifest, "environment-desktop"), 285_946);
assert.ok(calculateInitialStoryBytes(manifest, "environment-mobile") <= 450_000,
  "the mobile initial story load must remain within 450 KB");
assert.ok(calculateInitialStoryBytes(manifest, "environment-desktop") <= 450_000,
  "the desktop initial story load must remain within 450 KB");
const oversizedInitialStory = structuredClone(manifest);
oversizedInitialStory.assets.find((asset) => asset.id === "environment-desktop").bytes = 400_000;
assert.match(
  validateManifest(oversizedInitialStory, { root: ROOT, requireComplete: false }).errors.join("\n"),
  /desktop initial story.*450000/i,
  "the aggregate desktop initial story budget must not be confused with one file's limit",
);

const activeMenuAttempt = manifest.assets.find((asset) => asset.id === "menu");
assert.doesNotThrow(() => assertAttemptAuthorized(manifest, activeMenuAttempt, { id: "menu" }));
for (const [label, attempt, id, pattern] of [
  ["stale approval", { ...activeMenuAttempt, approvalId: "recraft-v4-1-remaining-objects-1" }, "menu", /active approved approval/i],
  ["model", { ...activeMenuAttempt, model: "gpt_image_2" }, "menu", /model.*not authorized/i],
  ["settings", { ...activeMenuAttempt, settings: { ...activeMenuAttempt.settings, count: 2 } }, "menu", /settings.*not authorized/i],
  ["class/scope", activeMenuAttempt, "environment-mobile", /scope|class/i],
  ["cost", { ...activeMenuAttempt, creditCost: 9 }, "menu", /credit cost.*not authorized/i],
  ["class limit", { ...activeMenuAttempt, generationId: "new-generation-id" }, "menu", /job limit/i],
]) {
  assert.throws(
    () => assertAttemptAuthorized(manifest, attempt, { id }),
    pattern,
    `${label} mismatch must fail authorization`,
  );
}

const crossApprovalOverflow = structuredClone(manifest);
crossApprovalOverflow.assets.find((asset) => asset.id === "coffee").approvalId =
  "recraft-v4-1-remaining-objects-1";
assert.match(
  validateManifest(crossApprovalOverflow, { root: ROOT, requireComplete: false }).errors.join("\n"),
  /recraft-v4-1-remaining-objects-1.*approved maximum/i,
  "each separate approval must enforce its own deduplicated credit ceiling",
);

const missingCropManifest = structuredClone(manifest);
delete missingCropManifest.assets.find((asset) => asset.id === "environment-mobile")?.crop;
assert.match(
  validateManifest(missingCropManifest, { root: ROOT, requireComplete: false }).errors.join("\n"),
  /environment-mobile.*crop/i,
  "an accepted mobile environment without its focal-crop provenance must be invalid",
);

const focalFixture = mkdtempSync(join(tmpdir(), "clara-context-focal-"));
try {
  const source = join(focalFixture, "asymmetric-environment.png");
  const artifactsDir = join(focalFixture, "artifacts");
  await sharp({
    create: { width: 2688, height: 1536, channels: 3, background: "#155e75" },
  }).composite([{
    input: {
      create: { width: 100, height: 1536, channels: 3, background: "#ef4444" },
    },
    left: 550,
    top: 0,
  }]).png().toFile(source);
  const provenance = await withActiveApproval("recraft-v4-1-test-2", async (activeManifest) => {
    const sourceAttempt = activeManifest.assets.find((asset) => asset.id === "environment-mobile");
    return processCandidate({
      id: "environment-mobile",
      source,
      artifactsDir,
      approvalId: sourceAttempt.approvalId,
      generationId: sourceAttempt.generationId,
      model: sourceAttempt.model,
      settings: sourceAttempt.settings,
      generatedAt: sourceAttempt.generatedAt,
      creditCost: sourceAttempt.creditCost,
    });
  });
  assert.deepEqual(provenance.crop, {
    method: "focal-point",
    focalPoint: { x: 0.28, y: 0.5 },
    sourceRegion: { left: 398, top: 0, width: 710, height: 1536 },
  }, "mobile environment provenance must record the deterministic focal crop");
  const { data, info } = await sharp(join(artifactsDir, "environment-mobile.webp"))
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sampleOffset = (Math.floor(info.height / 2) * info.width + 220) * info.channels;
  assert.ok(data[sampleOffset] > 180 && data[sampleOffset + 2] < 120,
    "the processed mobile crop must retain the off-centre focal cue");
} finally {
  rmSync(focalFixture, { recursive: true, force: true });
}

if (manifest.batch.approvalStatus === "pending") {
  const target = join(ROOT, ASSET_DEFINITIONS["environment-mobile"].runtimePath);
  const before = existsSync(target);
  const result = spawnSync(
    process.execPath,
    ["scripts/context-assets.mjs", "accept", "--id", "environment-mobile"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.notEqual(result.status, 0, "accept must fail while cost approval is pending");
  assert.match(`${result.stdout}\n${result.stderr}`, /pending|approval/i);
  assert.equal(existsSync(target), before, "a refused accept must not create a runtime asset");
}

const failureFixture = mkdtempSync(join(tmpdir(), "clara-context-rejection-"));
try {
  const source = join(failureFixture, "opaque-coffee.png");
  const artifactsDir = join(failureFixture, "artifacts");
  await sharp({
    create: { width: 128, height: 128, channels: 3, background: "#f4eadf" },
  }).png().toFile(source);
  await withActiveApproval("recraft-v4-1-test-2", async (activeManifest) => {
    const sourceAttempt = activeManifest.assets.find((asset) => asset.id === "coffee");
    await assert.rejects(
      processCandidate({
        id: "coffee",
        source,
        artifactsDir,
        approvalId: sourceAttempt.approvalId,
        generationId: sourceAttempt.generationId,
        model: sourceAttempt.model,
        settings: sourceAttempt.settings,
        generatedAt: sourceAttempt.generatedAt,
        creditCost: sourceAttempt.creditCost,
      }),
      /transparent pixels/,
      "opaque generated objects must fail processing",
    );
  });
  const rejectionPath = join(artifactsDir, "coffee.json");
  assert.ok(existsSync(rejectionPath), "processing failure must preserve bounded rejection provenance");
  const rejection = JSON.parse(readFileSync(rejectionPath, "utf8"));
  assert.equal(rejection.processingStatus, "rejected");
  assert.match(rejection.processingError, /transparent pixels/);
  assert.ok(!existsSync(join(artifactsDir, "coffee.webp")), "invalid object must not leave a processed candidate");
} finally {
  rmSync(failureFixture, { recursive: true, force: true });
}

const counterfeitFixture = mkdtempSync(join(tmpdir(), "clara-context-counterfeit-alpha-"));
try {
  const counterfeit = join(counterfeitFixture, "single-transparent-pixel.webp");
  const pixels = Buffer.alloc(512 * 512 * 4, 255);
  pixels[3] = 0;
  await sharp(pixels, { raw: { width: 512, height: 512, channels: 4 } })
    .webp({ lossless: true })
    .toFile(counterfeit);
  const inspected = await inspectImage(counterfeit, ASSET_DEFINITIONS.coffee);
  assert.match(inspected.errors.join("\n"), /meaningful transparent background coverage/i,
    "a single transparent pixel must not counterfeit transparent-background compliance");
  assert.match(inspected.errors.join("\n"), /corners must be transparent/i,
    "object transparency must extend to every canvas corner");
} finally {
  rmSync(counterfeitFixture, { recursive: true, force: true });
}

try {
  const estimate = spawnSync(
    process.execPath,
    ["scripts/context-assets.mjs", "estimate", "--credits", "1", "--maximum", "2"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(estimate.status, 0, `${estimate.stdout}\n${estimate.stderr}`);
  const unboundManifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const unbound = unboundManifest.batch.approvals.find((approval) =>
    approval.id === unboundManifest.batch.activeApprovalId);
  assert.equal(unbound.id, "unbound-1-2", "short estimate IDs must be deterministic");
  assert.equal(unbound.approvalStatus, "unbound");
  assert.equal(unboundManifest.batch.approvalStatus, "pending");
  assert.equal(unbound.model, null);
  assert.equal(unbound.settings, null);
  assert.equal(unbound.prompts, null);

  const lockedAccept = spawnSync(
    process.execPath,
    ["scripts/context-assets.mjs", "accept", "--id", "menu", "--reviewer", "Joel"],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.notEqual(lockedAccept.status, 0, "accept must remain locked while the estimate is unbound");
  assert.match(`${lockedAccept.stdout}\n${lockedAccept.stderr}`, /pending|approval/i);

  const boundedSettings = JSON.stringify({
    object: {
      resolution: "2k",
      model_type: "utility_vector",
      aspect_ratio: "1:1",
      count: 1,
      background_color: null,
      creditsPerJob: 1,
      jobLimit: 1,
      assetIds: ["menu"],
    },
  });
  const bind = spawnSync(
    process.execPath,
    ["scripts/context-assets.mjs", "estimate", "--credits", "1", "--maximum", "2",
      "--approval-id", "unbound-1-2", "--model", "recraft_v4_1", "--settings", boundedSettings],
    { cwd: ROOT, encoding: "utf8" },
  );
  assert.equal(bind.status, 0, `${bind.stdout}\n${bind.stderr}`);
  const boundManifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  assert.equal(boundManifest.batch.approvalStatus, "approved");
  assert.equal(boundManifest.batch.approvals.find((approval) => approval.id === "unbound-1-2")
    .prompts.menu, promptFor("menu", "unbound-1-2", boundManifest));
} finally {
  writeFileSync(MANIFEST_PATH, originalManifestText);
}

const completeValidation = validateManifest(manifest, { root: ROOT, requireComplete: true });
assert.deepEqual(completeValidation.errors, [], completeValidation.errors.join("\n"));

const ids = manifest.assets.map((asset) => asset.id);
const runtimePaths = manifest.assets
  .filter((asset) => asset.status === "accepted")
  .map((asset) => asset.runtimePath);
assert.equal(new Set(ids).size, ids.length, "logical asset IDs must be unique");
assert.equal(new Set(runtimePaths).size, runtimePaths.length, "accepted runtime paths must be unique");
assert.deepEqual(
  [...ids].sort(),
  Object.keys(ASSET_DEFINITIONS).sort(),
  "the manifest must account for the exact café asset pack",
);

for (const asset of manifest.assets) {
  if (asset.status === "accepted") {
    assert.ok(existsSync(join(ROOT, asset.runtimePath)), `${asset.id} accepted file must exist`);
    assert.match(asset.generationId, /\S/, `${asset.id} needs a generation ID`);
    assert.match(asset.promptSha256, /^[a-f0-9]{64}$/, `${asset.id} needs a prompt SHA-256`);
    assert.match(asset.model, /\S/, `${asset.id} needs a model`);
    assert.ok(asset.settings && typeof asset.settings === "object" && !Array.isArray(asset.settings));
    assert.ok(!Number.isNaN(Date.parse(asset.generatedAt)), `${asset.id} needs a generated-at timestamp`);
    assert.match(asset.reviewer, /\S/, `${asset.id} needs a reviewer`);
    assert.ok(!Number.isNaN(Date.parse(asset.reviewedAt)), `${asset.id} needs a reviewed-at timestamp`);
    assert.ok(Number.isFinite(asset.creditCost) && asset.creditCost >= 0, `${asset.id} needs a credit cost`);
    assert.ok(!("rejectionReason" in asset), `${asset.id} accepted entry must not have a rejection reason`);
  } else {
    assert.equal(asset.status, "rejected", `${asset.id} status must be accepted or rejected`);
    assert.match(asset.rejectionReason, /\S/, `${asset.id} rejected entry needs a reason`);
    assert.ok(!("runtimePath" in asset), `${asset.id} rejected entry must not claim a runtime path`);
  }
}

console.log(`context-assets: ${manifest.assets.length} records verified`);
