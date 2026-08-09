import sharp from "sharp";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = join(ROOT, "docs/redesign/assets/context-scene-manifest.json");
const ARTIFACTS_DIR = join(ROOT, ".artifacts/context-scenes");

const ENVIRONMENT_PROMPT = `Premium anime-influenced 2.5D editorial illustration of a contemporary independent café
in Medellín for an adult English-learning app. Warm daylight, polished wood, restrained
coral and teal accents, clear ordering counter, menu area, tables, payment terminal, and
takeaway station. Clean contours, readable silhouettes, sophisticated adult atmosphere,
generous central and lower safe areas for live UI overlays. Empty of recurring characters.
No text, letters, numbers, logos, brands, speech bubbles, mascots, chibi proportions,
children's clip art, photorealism, or imitation of another language-learning product.`;

const OBJECT_PROMPT = `Single isolated [OBJECT] for a premium adult English-learning app, matching a warm
anime-influenced 2.5D editorial café scene. Three-quarter view, clean contour, recognizable
at 96 CSS pixels, restrained modeled light from upper left, centered with safe padding,
transparent background. No person, hand, face, text, letters, numbers, logo, brand,
watermark, extra object, cast-off frame, chibi style, or photorealism.`;

const RECRAFT_ENVIRONMENT_PROMPT = "Illustrated 2.5D editorial background, not a photograph and not an architectural render: a contemporary independent café in Medellín for an adult English-learning app. Clean anime-influenced contours, simplified shapes, cel-shaded modeled light, warm daylight, polished wood, restrained coral and teal palette, ordering counter, menu area, tables, payment terminal, takeaway station. Human-free. Generous central and lower safe areas for live UI. Sophisticated adult visual novel background. No text, letters, numbers, logos, brands, speech bubbles, mascots, chibi proportions, children's clip art, photorealism, lens effects, or imitation of another language-learning product.";

const RECRAFT_COFFEE_PROMPT = "One coffee cup and saucer as a clean vector-like 2.5D editorial illustration for an adult English-learning app. Warm ceramic cup filled with coffee, three-quarter view, simple anime-influenced contour, restrained cel shading from upper left, centered, recognizable at 96 CSS pixels. Isolated subject only. No person, hand, face, text, letters, numbers, logo, brand, watermark, second object, drop-shadow background, checkerboard, colored rectangle, frame, chibi style, or photorealism. Output should contain only the object with empty transparent surroundings.";

const RECRAFT_MENU_PROMPT = "One single analog restaurant menu booklet, standing slightly open in three-quarter view, as a clean vector-like 2.5D editorial illustration for an adult English-learning app. Dark coral bound cover, visible center spine, two cream paper pages with only a few simple horizontal line groupings and small blank image rectangles that suggest a printed food menu without forming any readable characters. Clearly a physical handheld menu booklet, not a phone, tablet, app screen, control panel, sign, table, chair, or furniture. Centered and recognizable at 96 CSS pixels, restrained cel shading from upper left, isolated subject only, true transparent surroundings. No person, hand, food, text, letters, numbers, prices, logo, brand, watermark, button grid, checkerboard, colored background, frame, chibi style, or photorealism.";

const objectIds = [
  "table",
  "menu",
  "coffee",
  "chicken",
  "onion",
  "meal",
  "check",
  "card",
  "takeaway-bag",
  "change",
];

const objectPromptNouns = Object.freeze({
  table: "table",
  menu: "menu",
  coffee: "coffee",
  chicken: "plated chicken meal",
  onion: "whole and sliced onion",
  meal: "plated café meal",
  check: "restaurant check/bill slip",
  card: "payment card",
  "takeaway-bag": "takeaway paper bag",
  change: "coins and small bills",
});

export const INITIAL_STORY_OBJECT_IDS = Object.freeze(["coffee", "menu", "table", "card"]);
const INITIAL_STORY_MAX_BYTES = 450_000;
const APPROVAL_POLICY_KEYS = new Set(["assetIds", "creditsPerJob", "jobLimit"]);

export const ASSET_DEFINITIONS = Object.freeze({
  "environment-mobile": Object.freeze({
    type: "environment",
    runtimePath: "public/visual-learning/cafe-restaurant/environment-mobile.webp",
    width: 780,
    height: 1688,
    maxBytes: 180_000,
    cropFocalPoint: Object.freeze({ x: 0.28, y: 0.5 }),
  }),
  "environment-desktop": Object.freeze({
    type: "environment",
    runtimePath: "public/visual-learning/cafe-restaurant/environment-desktop.webp",
    width: 2880,
    height: 1800,
    maxBytes: 450_000,
  }),
  ...Object.fromEntries(objectIds.map((id) => [
    id,
    Object.freeze({
      type: "object",
      runtimePath: `public/visual-learning/cafe-restaurant/objects/${id}.webp`,
      width: 512,
      height: 512,
      maxBytes: 60_000,
    }),
  ])),
});

export function calculateCoverCrop({
  sourceWidth,
  sourceHeight,
  targetWidth,
  targetHeight,
  focalPoint,
}) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = Math.min(sourceWidth, Math.round(targetWidth / scale));
  const height = Math.min(sourceHeight, Math.round(targetHeight / scale));
  return {
    left: Math.max(0, Math.min(sourceWidth - width, Math.round(sourceWidth * focalPoint.x - width / 2))),
    top: Math.max(0, Math.min(sourceHeight - height, Math.round(sourceHeight * focalPoint.y - height / 2))),
    width,
    height,
  };
}

const sha256Text = (text) => createHash("sha256").update(text).digest("hex");
const sha256File = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

function defaultPromptFor(id, model) {
  const definition = ASSET_DEFINITIONS[id];
  if (!definition) throw new Error(`unknown asset id: ${id}`);
  if (model === "recraft_v4_1") {
    if (definition.type === "environment") return RECRAFT_ENVIRONMENT_PROMPT;
    if (id === "coffee") return RECRAFT_COFFEE_PROMPT;
    if (id === "menu") return RECRAFT_MENU_PROMPT;
  }
  if (definition.type === "environment") return ENVIRONMENT_PROMPT;
  return OBJECT_PROMPT.replace("[OBJECT]", objectPromptNouns[id]);
}

export function promptFor(id, approvalId, manifest = existsSync(MANIFEST_PATH) ? readManifest() : null) {
  const definition = ASSET_DEFINITIONS[id];
  if (!definition) throw new Error(`unknown asset id: ${id}`);
  const resolvedApprovalId = approvalId ?? manifest?.batch?.activeApprovalId;
  const approval = manifest?.batch?.approvals?.find((entry) => entry.id === resolvedApprovalId);
  if (!approval) throw new Error(`prompt approval is not recorded: ${resolvedApprovalId ?? "none"}`);
  const prompt = approval.prompts?.[id];
  if (!hasText(prompt)) throw new Error(`${approval.id} does not bind a prompt for ${id}`);
  return prompt;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function generationSettings(policy) {
  return Object.fromEntries(Object.entries(policy ?? {}).filter(([key]) => !APPROVAL_POLICY_KEYS.has(key)));
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function approvalPrompts(model, settings) {
  const ids = [...new Set(Object.values(settings ?? {}).flatMap((policy) => policy?.assetIds ?? []))];
  return Object.fromEntries(ids.map((id) => [id, defaultPromptFor(id, model)]));
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
  renameSync(temporary, path);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoTimestamp(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function findForbiddenKeys(value, errors, trail = "manifest") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenKeys(entry, errors, `${trail}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  const forbidden = /^(?:token|secret|password|apiKey|learner|learnerId|userId|email|recording|transcript|rawAudio)$/i;
  for (const [key, nested] of Object.entries(value)) {
    if (forbidden.test(key)) errors.push(`${trail}.${key} is forbidden`);
    findForbiddenKeys(nested, errors, `${trail}.${key}`);
  }
}

export function calculateInitialStoryBytes(manifest, environmentId) {
  const ids = [environmentId, ...INITIAL_STORY_OBJECT_IDS];
  return ids.reduce((total, id) => {
    const asset = manifest.assets?.find((entry) => entry.id === id && entry.status === "accepted");
    return total + (Number.isInteger(asset?.bytes) ? asset.bytes : 0);
  }, 0);
}

function approvalClassJobs(manifest, approvalId, type) {
  const jobs = new Set();
  for (const asset of manifest.assets ?? []) {
    if (asset.type !== type) continue;
    for (const attempt of [asset, ...(Array.isArray(asset.rejectedAttempts) ? asset.rejectedAttempts : [])]) {
      if (attempt.approvalId === approvalId && hasText(attempt.generationId)) jobs.add(attempt.generationId);
    }
  }
  return jobs;
}

function approvalSpend(manifest, approvalId) {
  const costs = new Map();
  for (const asset of manifest.assets ?? []) {
    for (const attempt of [asset, ...(Array.isArray(asset.rejectedAttempts) ? asset.rejectedAttempts : [])]) {
      if (attempt.approvalId !== approvalId || !Number.isFinite(attempt.creditCost)) continue;
      const key = hasText(attempt.generationId) ? `generation:${attempt.generationId}` : canonicalJson(attempt);
      if (!costs.has(key)) costs.set(key, attempt.creditCost);
    }
  }
  return costs;
}

export function assertAttemptAuthorized(manifest, attempt, { id = attempt?.id } = {}) {
  const definition = ASSET_DEFINITIONS[id];
  if (!definition) throw new Error(`unknown asset id: ${id}`);
  if (manifest.batch?.approvalStatus !== "approved") throw new Error("the active approval is not bound and approved");
  const approval = manifest.batch?.approvals?.find((entry) => entry.id === attempt?.approvalId);
  if (!approval || approval.id !== manifest.batch.activeApprovalId || approval.approvalStatus !== "approved") {
    throw new Error(`${attempt?.approvalId ?? "candidate"} is not the active approved approval`);
  }
  const policy = approval.settings?.[definition.type];
  if (!isRecord(policy)) throw new Error(`${approval.id} does not authorize the ${definition.type} class`);
  if (!Array.isArray(policy.assetIds) || !policy.assetIds.includes(id)) {
    throw new Error(`${id} is outside ${approval.id}'s authorized class scope`);
  }
  if (attempt.model !== approval.model) throw new Error(`model ${attempt.model} is not authorized by ${approval.id}`);
  if (!sameValue(attempt.settings, generationSettings(policy))) {
    throw new Error(`settings are not authorized by ${approval.id}`);
  }
  if (attempt.creditCost !== policy.creditsPerJob) {
    throw new Error(`credit cost ${attempt.creditCost} is not authorized by ${approval.id}`);
  }
  const prompt = promptFor(id, approval.id, manifest);
  if (attempt.prompt !== undefined && attempt.prompt !== prompt) {
    throw new Error(`prompt is not authorized by ${approval.id}`);
  }
  if (attempt.promptSha256 !== undefined && attempt.promptSha256 !== sha256Text(prompt)) {
    throw new Error(`prompt hash is not authorized by ${approval.id}`);
  }
  if (!hasText(attempt.generationId)) throw new Error("a real generation ID is required for authorization");
  const conflictingGeneration = (manifest.assets ?? []).flatMap((asset) =>
    [asset, ...(Array.isArray(asset.rejectedAttempts) ? asset.rejectedAttempts : [])])
    .find((entry) => entry.generationId === attempt.generationId && entry.approvalId !== approval.id);
  if (conflictingGeneration) throw new Error("generation ID is already bound to another approval");
  const jobs = approvalClassJobs(manifest, approval.id, definition.type);
  if (!jobs.has(attempt.generationId) && jobs.size >= policy.jobLimit) {
    throw new Error(`${approval.id} ${definition.type} job limit is exhausted`);
  }
  const costs = approvalSpend(manifest, approval.id);
  const addedCost = costs.has(`generation:${attempt.generationId}`) ? 0 : attempt.creditCost;
  if ([...costs.values()].reduce((sum, cost) => sum + cost, 0) + addedCost >
    approval.approvedMaximumCredits) {
    throw new Error(`${approval.id} approved maximum is exhausted`);
  }
  return { approval, policy, prompt };
}

function recordedAttemptAuthorizationErrors(manifest, attempt, id, label) {
  const errors = [];
  const definition = ASSET_DEFINITIONS[id];
  const approval = manifest.batch?.approvals?.find((entry) => entry.id === attempt.approvalId);
  const policy = approval?.settings?.[definition?.type];
  if (!approval || approval.approvalStatus === "unbound") return [`${label} needs a bound approval`];
  if (!isRecord(policy) || !policy.assetIds?.includes(id)) errors.push(`${label} is outside approval scope`);
  if (attempt.model !== approval.model) errors.push(`${label} model does not match its approval`);
  if (!sameValue(attempt.settings, generationSettings(policy))) {
    errors.push(`${label} settings do not match its approval`);
  }
  if (attempt.creditCost !== policy?.creditsPerJob) errors.push(`${label} credit cost does not match its approval`);
  let prompt;
  try {
    prompt = promptFor(id, approval.id, manifest);
  } catch {
    errors.push(`${label} prompt is not bound by its approval`);
  }
  if (prompt && attempt.promptSha256 !== sha256Text(prompt)) {
    errors.push(`${label} prompt SHA-256 does not match its approval`);
  }
  return errors;
}

export function validateManifest(manifest, { root = ROOT, requireComplete = false } = {}) {
  const errors = [];
  if (!isRecord(manifest)) return { errors: ["manifest must be an object"] };

  const topKeys = Object.keys(manifest).sort();
  const expectedTopKeys = ["assets", "batch", "provider", "runtimeGeneration", "version"].sort();
  if (JSON.stringify(topKeys) !== JSON.stringify(expectedTopKeys)) {
    errors.push("manifest top-level schema is not exact");
  }
  if (manifest.version !== 1) errors.push("manifest.version must be 1");
  if (manifest.provider !== "higgsfield") errors.push("manifest.provider must be higgsfield");
  if (manifest.runtimeGeneration !== false) errors.push("runtimeGeneration must be false");

  const batch = manifest.batch;
  if (!isRecord(batch)) {
    errors.push("manifest.batch must be an object");
  } else {
    const keys = Object.keys(batch).sort();
    const expected = [
      "activeApprovalId",
      "approvalStatus",
      "approvals",
      "approvedMaximumCredits",
      "estimatedCredits",
      "topicId",
    ].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) errors.push("batch schema is not exact");
    if (batch.topicId !== "cafe-restaurant") errors.push("batch.topicId must be cafe-restaurant");
    if (!Number.isFinite(batch.estimatedCredits) || batch.estimatedCredits < 0) {
      errors.push("batch.estimatedCredits must be a non-negative number");
    }
    if (!Number.isFinite(batch.approvedMaximumCredits) || batch.approvedMaximumCredits < 0) {
      errors.push("batch.approvedMaximumCredits must be a non-negative number");
    }
    if (!["pending", "approved"].includes(batch.approvalStatus)) {
      errors.push("batch.approvalStatus must be pending or approved");
    }
    if (batch.approvalStatus === "approved" &&
      (!(batch.estimatedCredits > 0) || !(batch.approvedMaximumCredits > 0) ||
        batch.estimatedCredits > batch.approvedMaximumCredits)) {
      errors.push("an approved batch needs a positive estimate within its approved maximum");
    }
    if (!Array.isArray(batch.approvals) || batch.approvals.length === 0) {
      errors.push("batch.approvals must retain each separate approval");
    } else {
      const approvalIds = new Set();
      let cumulativeEstimate = 0;
      let cumulativeMaximum = 0;
      for (const [index, approval] of batch.approvals.entries()) {
        const label = `batch.approvals[${index}]`;
        if (!isRecord(approval)) {
          errors.push(`${label} must be an object`);
          continue;
        }
        if (!hasText(approval.id) || approvalIds.has(approval.id)) errors.push(`${label} needs a unique ID`);
        approvalIds.add(approval.id);
        if (!Number.isFinite(approval.estimatedCredits) || approval.estimatedCredits <= 0) {
          errors.push(`${label} needs a positive estimate`);
        } else {
          cumulativeEstimate += approval.estimatedCredits;
        }
        if (!Number.isFinite(approval.approvedMaximumCredits) || approval.approvedMaximumCredits <= 0 ||
          approval.estimatedCredits > approval.approvedMaximumCredits) {
          errors.push(`${label} needs a positive approved maximum at or above its estimate`);
        } else {
          cumulativeMaximum += approval.approvedMaximumCredits;
        }
        if (!["approved", "exhausted", "superseded", "unbound"].includes(approval.approvalStatus)) {
          errors.push(`${label} has an invalid approval status`);
        }
        if (approval.approvalStatus === "unbound") {
          if (approval.model !== null || approval.settings !== null || approval.prompts !== null) {
            errors.push(`${label} unbound approval must not claim model, settings, or prompts`);
          }
        } else {
          if (!hasText(approval.model)) errors.push(`${label} needs a model`);
          if (!isRecord(approval.settings) || Object.keys(approval.settings).length === 0) {
            errors.push(`${label} needs bounded settings`);
          } else {
            for (const [type, policy] of Object.entries(approval.settings)) {
              const policyLabel = `${label}.settings.${type}`;
              if (!["environment", "object"].includes(type) || !isRecord(policy)) {
                errors.push(`${policyLabel} is not a valid class policy`);
                continue;
              }
              if (!Array.isArray(policy.assetIds) || policy.assetIds.length === 0 ||
                policy.assetIds.some((id) => ASSET_DEFINITIONS[id]?.type !== type) ||
                new Set(policy.assetIds).size !== policy.assetIds.length) {
                errors.push(`${policyLabel} needs valid scoped asset IDs`);
              }
              if (!Number.isInteger(policy.jobLimit) || policy.jobLimit <= 0) {
                errors.push(`${policyLabel} needs a positive job limit`);
              }
              if (!Number.isFinite(policy.creditsPerJob) || policy.creditsPerJob <= 0) {
                errors.push(`${policyLabel} needs a positive per-job credit cost`);
              }
              if (Object.keys(generationSettings(policy)).length === 0) {
                errors.push(`${policyLabel} needs exact generation settings`);
              }
            }
            const authorizedMaximum = Object.values(approval.settings).reduce((sum, policy) =>
              sum + (Number.isInteger(policy?.jobLimit) && Number.isFinite(policy?.creditsPerJob) ?
                policy.jobLimit * policy.creditsPerJob : 0), 0);
            if (authorizedMaximum > approval.approvedMaximumCredits) {
              errors.push(`${label} class policies exceed its approved maximum`);
            }
          }
          if (!isRecord(approval.prompts)) {
            errors.push(`${label} needs approval-bound prompts`);
          } else {
            const scopedIds = Object.values(approval.settings ?? {}).flatMap((policy) => policy?.assetIds ?? []);
            for (const id of scopedIds) {
              if (!hasText(approval.prompts[id])) errors.push(`${label}.prompts needs ${id}`);
            }
            if (!sameValue(Object.keys(approval.prompts).sort(), [...new Set(scopedIds)].sort())) {
              errors.push(`${label}.prompts must exactly match its scoped asset IDs`);
            }
          }
        }
      }
      if (!approvalIds.has(batch.activeApprovalId)) errors.push("batch.activeApprovalId is not recorded");
      const active = batch.approvals.find((approval) => approval.id === batch.activeApprovalId);
      if (batch.approvalStatus === "approved" && active?.approvalStatus !== "approved") {
        errors.push("the active approval must be approved");
      }
      if (batch.approvalStatus === "pending" && active?.approvalStatus !== "unbound") {
        errors.push("a pending batch must point to an unbound approval");
      }
      if (cumulativeEstimate !== batch.estimatedCredits) errors.push("batch estimate must equal approval totals");
      if (cumulativeMaximum !== batch.approvedMaximumCredits) errors.push("batch maximum must equal approval totals");
    }
  }

  findForbiddenKeys(manifest, errors);
  if (!Array.isArray(manifest.assets)) {
    errors.push("manifest.assets must be an array");
    return { errors };
  }

  const seenIds = new Set();
  const seenPaths = new Set();
  const creditsByGeneration = new Map();
  const approvalIds = new Set(Array.isArray(batch?.approvals) ? batch.approvals.map((approval) => approval.id) : []);
  for (const [index, asset] of manifest.assets.entries()) {
    const label = hasText(asset?.id) ? asset.id : `assets[${index}]`;
    if (!isRecord(asset)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    const definition = ASSET_DEFINITIONS[asset.id];
    if (!definition) errors.push(`${label} has an unknown logical ID`);
    if (seenIds.has(asset.id)) errors.push(`${label} logical ID is duplicated`);
    seenIds.add(asset.id);
    if (!["accepted", "rejected"].includes(asset.status)) {
      errors.push(`${label} status must be accepted or rejected`);
    }
    if (definition && asset.type !== definition.type) errors.push(`${label} type is incorrect`);
    if (approvalIds.size && !approvalIds.has(asset.approvalId)) errors.push(`${label} needs a recorded approval ID`);

    if (asset.status === "accepted") {
      if (definition && asset.runtimePath !== definition.runtimePath) {
        errors.push(`${label} runtime path is not the locked path`);
      }
      if (!hasText(asset.runtimePath)) errors.push(`${label} needs a runtime path`);
      if (seenPaths.has(asset.runtimePath)) errors.push(`${label} runtime path is duplicated`);
      seenPaths.add(asset.runtimePath);
      if (!hasText(asset.generationId)) errors.push(`${label} needs a generation ID`);
      if (!/^[a-f0-9]{64}$/.test(asset.promptSha256 ?? "")) {
        errors.push(`${label} needs a prompt SHA-256`);
      } else if (definition && approvalIds.has(asset.approvalId)) {
        try {
          if (asset.promptSha256 !== sha256Text(promptFor(asset.id, asset.approvalId, manifest))) {
            errors.push(`${label} prompt SHA-256 does not match its approval-bound prompt`);
          }
        } catch {
          errors.push(`${label} prompt is not bound by its approval`);
        }
      }
      if (!hasText(asset.model)) errors.push(`${label} needs a model`);
      if (!isRecord(asset.settings) || Object.keys(asset.settings).length === 0) {
        errors.push(`${label} needs non-empty generation settings`);
      }
      if (!isIsoTimestamp(asset.generatedAt)) errors.push(`${label} needs an ISO generated-at timestamp`);
      if (!hasText(asset.reviewer)) errors.push(`${label} needs a reviewer`);
      if (!isIsoTimestamp(asset.reviewedAt)) errors.push(`${label} needs an ISO reviewed-at timestamp`);
      if (!Number.isFinite(asset.creditCost) || asset.creditCost < 0) {
        errors.push(`${label} needs a non-negative credit cost`);
      } else {
        const creditKey = hasText(asset.generationId) ? `generation:${asset.generationId}` : `asset:${label}`;
        if (creditsByGeneration.has(creditKey) && creditsByGeneration.get(creditKey) !== asset.creditCost) {
          errors.push(`${label} repeats a generation ID with a different credit cost`);
        } else {
          creditsByGeneration.set(creditKey, asset.creditCost);
        }
      }
      if (!/^[a-f0-9]{64}$/.test(asset.sha256 ?? "")) errors.push(`${label} needs an asset SHA-256`);
      if (!/^[a-f0-9]{64}$/.test(asset.sourceSha256 ?? "")) {
        errors.push(`${label} needs a source SHA-256`);
      }
      if (!Number.isInteger(asset.sourceWidth) || asset.sourceWidth <= 0 ||
        !Number.isInteger(asset.sourceHeight) || asset.sourceHeight <= 0) {
        errors.push(`${label} needs positive source dimensions`);
      }
      if (definition && (asset.width !== definition.width || asset.height !== definition.height)) {
        errors.push(`${label} dimensions are incorrect`);
      }
      if (!Number.isInteger(asset.bytes) || asset.bytes <= 0 ||
        (definition && asset.bytes > definition.maxBytes)) {
        errors.push(`${label} byte size is invalid`);
      }
      if (asset.id === "environment-mobile") {
        const crop = asset.crop;
        const region = crop?.sourceRegion;
        if (!isRecord(crop) || crop.method !== "focal-point" ||
          crop.focalPoint?.x !== definition.cropFocalPoint.x ||
          crop.focalPoint?.y !== definition.cropFocalPoint.y ||
          !isRecord(region) || ![region.left, region.top, region.width, region.height]
            .every((value) => Number.isInteger(value) && value >= 0) ||
          region.width <= 0 || region.height <= 0) {
          errors.push(`${label} needs valid deterministic focal-crop provenance`);
        }
      }
      if ("rejectionReason" in asset) errors.push(`${label} accepted entry has a rejection reason`);
      if (hasText(asset.runtimePath) && !existsSync(join(root, asset.runtimePath))) {
        errors.push(`${label} accepted runtime file is missing`);
      }
      errors.push(...recordedAttemptAuthorizationErrors(manifest, asset, asset.id, label));
    }

    if (asset.status === "rejected") {
      if ("runtimePath" in asset) errors.push(`${label} rejected entry must not have a runtime path`);
      if (!hasText(asset.rejectionReason)) errors.push(`${label} rejected entry needs a rejection reason`);
      if (!hasText(asset.reviewer)) errors.push(`${label} rejected entry needs a reviewer`);
      if (asset.creditCost !== undefined) {
        if (!Number.isFinite(asset.creditCost) || asset.creditCost < 0) {
          errors.push(`${label} rejected credit cost must be non-negative`);
        } else {
          const creditKey = hasText(asset.generationId) ? `generation:${asset.generationId}` : `asset:${label}`;
          if (creditsByGeneration.has(creditKey) && creditsByGeneration.get(creditKey) !== asset.creditCost) {
            errors.push(`${label} repeats a generation ID with a different credit cost`);
          } else {
            creditsByGeneration.set(creditKey, asset.creditCost);
          }
        }
      }
      errors.push(...recordedAttemptAuthorizationErrors(manifest, asset, asset.id, label));
    }

    if (asset.rejectedAttempts !== undefined) {
      if (!Array.isArray(asset.rejectedAttempts)) {
        errors.push(`${label} rejectedAttempts must be an array`);
      } else {
        for (const [attemptIndex, attempt] of asset.rejectedAttempts.entries()) {
          const attemptLabel = `${label}.rejectedAttempts[${attemptIndex}]`;
          if (!isRecord(attempt)) {
            errors.push(`${attemptLabel} must be an object`);
            continue;
          }
          if (approvalIds.size && !approvalIds.has(attempt.approvalId)) {
            errors.push(`${attemptLabel} needs a recorded approval ID`);
          }
          if ("runtimePath" in attempt) errors.push(`${attemptLabel} must not have a runtime path`);
          if (!hasText(attempt.rejectionReason)) errors.push(`${attemptLabel} needs a rejection reason`);
          if (!hasText(attempt.generationId)) errors.push(`${attemptLabel} needs a generation ID`);
          if (!/^[a-f0-9]{64}$/.test(attempt.promptSha256 ?? "")) {
            errors.push(`${attemptLabel} needs a prompt SHA-256`);
          }
          if (!hasText(attempt.model)) errors.push(`${attemptLabel} needs a model`);
          if (!isRecord(attempt.settings) || Object.keys(attempt.settings).length === 0) {
            errors.push(`${attemptLabel} needs generation settings`);
          }
          if (!isIsoTimestamp(attempt.generatedAt)) errors.push(`${attemptLabel} needs a generated-at timestamp`);
          if (!isIsoTimestamp(attempt.reviewedAt)) errors.push(`${attemptLabel} needs a reviewed-at timestamp`);
          if (!hasText(attempt.reviewer)) errors.push(`${attemptLabel} needs a reviewer`);
          if (!Number.isFinite(attempt.creditCost) || attempt.creditCost < 0) {
            errors.push(`${attemptLabel} needs a non-negative credit cost`);
          } else {
            const creditKey = hasText(attempt.generationId) ? `generation:${attempt.generationId}` :
              `asset:${label}:rejected:${attemptIndex}`;
            if (creditsByGeneration.has(creditKey) && creditsByGeneration.get(creditKey) !== attempt.creditCost) {
              errors.push(`${attemptLabel} repeats a generation ID with a different credit cost`);
            } else {
              creditsByGeneration.set(creditKey, attempt.creditCost);
            }
          }
          errors.push(...recordedAttemptAuthorizationErrors(manifest, attempt, asset.id, attemptLabel));
        }
      }
    }
  }

  const mobileEnvironment = manifest.assets.find((asset) =>
    asset.id === "environment-mobile" && asset.status === "accepted");
  const desktopEnvironment = manifest.assets.find((asset) =>
    asset.id === "environment-desktop" && asset.status === "accepted");
  if (mobileEnvironment && desktopEnvironment) {
    if (mobileEnvironment.generationId !== desktopEnvironment.generationId ||
      mobileEnvironment.sourceSha256 !== desktopEnvironment.sourceSha256 ||
      mobileEnvironment.sourceWidth !== desktopEnvironment.sourceWidth ||
      mobileEnvironment.sourceHeight !== desktopEnvironment.sourceHeight) {
      errors.push("environment variants must retain the same source master generation, hash, and dimensions");
    }
    const expectedCrop = calculateCoverCrop({
      sourceWidth: mobileEnvironment.sourceWidth,
      sourceHeight: mobileEnvironment.sourceHeight,
      targetWidth: ASSET_DEFINITIONS["environment-mobile"].width,
      targetHeight: ASSET_DEFINITIONS["environment-mobile"].height,
      focalPoint: ASSET_DEFINITIONS["environment-mobile"].cropFocalPoint,
    });
    if (!sameValue(mobileEnvironment.crop?.sourceRegion, expectedCrop)) {
      errors.push("environment-mobile crop must be deterministically derived from its source master");
    }
  }

  for (const environmentId of ["environment-mobile", "environment-desktop"]) {
    if (calculateInitialStoryBytes(manifest, environmentId) > INITIAL_STORY_MAX_BYTES) {
      errors.push(`${environmentId.replace("environment-", "")} initial story load exceeds 450000 bytes`);
    }
  }

  const creditsByApproval = new Map();
  for (const [assetIndex, asset] of manifest.assets.entries()) {
    const attempts = [asset, ...(Array.isArray(asset.rejectedAttempts) ? asset.rejectedAttempts : [])];
    for (const [attemptIndex, attempt] of attempts.entries()) {
      if (!hasText(attempt.approvalId) || !Number.isFinite(attempt.creditCost)) continue;
      const approvalCredits = creditsByApproval.get(attempt.approvalId) ?? new Map();
      const key = hasText(attempt.generationId) ? `generation:${attempt.generationId}` :
        `asset:${assetIndex}:${attemptIndex}`;
      if (!approvalCredits.has(key)) approvalCredits.set(key, attempt.creditCost);
      creditsByApproval.set(attempt.approvalId, approvalCredits);
    }
  }
  for (const approval of Array.isArray(batch?.approvals) ? batch.approvals : []) {
    const spent = [...(creditsByApproval.get(approval.id)?.values() ?? [])]
      .reduce((sum, credits) => sum + credits, 0);
    if (spent > approval.approvedMaximumCredits) {
      errors.push(`${approval.id} recorded credits exceed its approved maximum`);
    }
    for (const type of ["environment", "object"]) {
      const policy = approval.settings?.[type];
      if (policy && approvalClassJobs(manifest, approval.id, type).size > policy.jobLimit) {
        errors.push(`${approval.id} recorded ${type} jobs exceed its approved job limit`);
      }
    }
  }

  const recordedCredits = [...creditsByGeneration.values()].reduce((sum, credits) => sum + credits, 0);
  if (manifest.batch?.approvalStatus === "approved" && recordedCredits > manifest.batch.approvedMaximumCredits) {
    errors.push("recorded asset credits exceed the approved maximum");
  }

  if (requireComplete) {
    for (const id of Object.keys(ASSET_DEFINITIONS)) {
      const entry = manifest.assets.find((asset) => asset.id === id && asset.status === "accepted");
      if (!entry) errors.push(`${id} is missing an accepted asset`);
    }
  }

  return { errors };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`invalid argument near ${flag ?? "end of command"}`);
    }
    const name = flag.slice(2);
    if (name in options) throw new Error(`duplicate option: --${name}`);
    options[name] = value;
  }
  return { command, options };
}

function required(options, key) {
  if (!hasText(options[key])) throw new Error(`missing required option: --${key}`);
  return options[key];
}

function assertOnlyOptions(options, allowed) {
  const unknown = Object.keys(options).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`unknown option: --${unknown}`);
}

function finiteNumber(value, label, { positive = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) {
    throw new Error(`${label} must be ${positive ? "a positive" : "a non-negative"} number`);
  }
  return number;
}

function parseSettings(value) {
  let settings;
  try {
    settings = JSON.parse(value);
  } catch {
    throw new Error("--settings must be valid JSON");
  }
  if (!isRecord(settings) || Object.keys(settings).length === 0) {
    throw new Error("--settings must be a non-empty JSON object");
  }
  return settings;
}

function candidatePaths(id, artifactsDir = ARTIFACTS_DIR) {
  return {
    image: join(artifactsDir, `${id}.webp`),
    provenance: join(artifactsDir, `${id}.json`),
  };
}

function ensureArtifactDirectory(artifactsDir = ARTIFACTS_DIR) {
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(join(artifactsDir, ".gitignore"), "*\n");
}

export async function inspectImage(path, definition) {
  const image = sharp(path, { failOn: "error" });
  const [metadata, stats] = await Promise.all([image.metadata(), image.stats()]);
  const errors = [];
  if (metadata.format !== "webp") errors.push("format must be WebP");
  if (metadata.width !== definition.width || metadata.height !== definition.height) {
    errors.push(`dimensions must be ${definition.width}x${definition.height}`);
  }
  if (definition.type === "object") {
    const alpha = stats.channels[3];
    if (!metadata.hasAlpha || !alpha || alpha.min >= 255) {
      errors.push("object must contain transparent pixels");
    } else {
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let transparentPixels = 0;
      for (let offset = 3; offset < data.length; offset += info.channels) {
        if (data[offset] <= 16) transparentPixels += 1;
      }
      if (transparentPixels / (info.width * info.height) < 0.1) {
        errors.push("object needs meaningful transparent background coverage");
      }
      const cornerOffsets = [
        3,
        (info.width - 1) * info.channels + 3,
        ((info.height - 1) * info.width) * info.channels + 3,
        ((info.height * info.width) - 1) * info.channels + 3,
      ];
      if (cornerOffsets.some((offset) => data[offset] > 16)) {
        errors.push("object corners must be transparent");
      }
    }
  } else if (!stats.isOpaque) {
    errors.push("environment must be opaque");
  }
  const forbiddenMetadata = [metadata.exif, metadata.icc, metadata.iptc, metadata.xmp].some(Boolean);
  if (forbiddenMetadata) errors.push("image metadata must be stripped");
  const bytes = statSync(path).size;
  if (bytes > definition.maxBytes) errors.push(`file exceeds ${definition.maxBytes} bytes`);
  return { metadata, bytes, errors };
}

export async function processCandidate({
  id,
  source,
  model,
  settings,
  generatedAt,
  creditCost,
  generationId,
  approvalId,
  artifactsDir = ARTIFACTS_DIR,
}) {
  const definition = ASSET_DEFINITIONS[id];
  if (!definition) throw new Error(`unknown asset id: ${id}`);
  if (!isAbsolute(source)) throw new Error("--source must be an absolute path");
  if (!existsSync(source)) throw new Error(`source does not exist: ${source}`);
  const realSource = realpathSync(source);
  const publicRoot = realpathSync(join(ROOT, "public"));
  const fromPublic = relative(publicRoot, realSource);
  if (fromPublic === "" || (!fromPublic.startsWith(`..${sep}`) && fromPublic !== "..")) {
    throw new Error("source must be outside public");
  }
  if (!hasText(model)) throw new Error("--model is required and must not be empty");
  if (!isRecord(settings) || Object.keys(settings).length === 0) {
    throw new Error("--settings is required and must be a non-empty object");
  }
  const sensitiveSettings = [];
  findForbiddenKeys(settings, sensitiveSettings, "settings");
  if (sensitiveSettings.length) throw new Error(sensitiveSettings.join("; "));
  if (!isIsoTimestamp(generatedAt)) throw new Error("--generated-at must be an exact ISO-8601 timestamp");
  if (!Number.isFinite(creditCost) || creditCost < 0) throw new Error("--credit-cost must be non-negative");
  if (!hasText(generationId) || /[<>]/.test(generationId)) {
    throw new Error("--generation-id must be a real provider ID");
  }
  const manifest = readManifest();
  const actualApprovalId = approvalId ?? manifest.batch?.activeApprovalId;
  const prompt = promptFor(id, actualApprovalId, manifest);
  assertAttemptAuthorized(manifest, {
    approvalId: actualApprovalId,
    generationId,
    model,
    settings,
    generatedAt,
    creditCost,
    prompt,
    promptSha256: sha256Text(prompt),
  }, { id });
  const sourceMetadata = await sharp(realSource, { failOn: "error" }).metadata();
  if (!Number.isInteger(sourceMetadata.width) || !Number.isInteger(sourceMetadata.height)) {
    throw new Error("source image dimensions are unavailable");
  }

  ensureArtifactDirectory(artifactsDir);
  const paths = candidatePaths(id, artifactsDir);
  rmSync(paths.image, { force: true });
  rmSync(paths.provenance, { force: true });
  const temporary = `${paths.image}.tmp-${process.pid}`;
  const baseProvenance = {
    version: 1,
    id,
    type: definition.type,
    prompt,
    promptSha256: sha256Text(prompt),
    sourceSha256: sha256File(realSource),
    sourceWidth: sourceMetadata.width,
    sourceHeight: sourceMetadata.height,
    processedAt: new Date().toISOString(),
    approvalId: actualApprovalId,
    generationId,
    model,
    settings,
    generatedAt,
    creditCost,
  };
  try {
    let pipeline = sharp(realSource, { failOn: "error" }).rotate();
    let crop;
    if (definition.type === "object") {
      pipeline = pipeline.ensureAlpha().resize({
        width: definition.width,
        height: definition.height,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      });
    } else {
      pipeline = pipeline.flatten({ background: "#f7f0e7" });
      if (definition.cropFocalPoint) {
        const sourceRegion = calculateCoverCrop({
          sourceWidth: sourceMetadata.width,
          sourceHeight: sourceMetadata.height,
          targetWidth: definition.width,
          targetHeight: definition.height,
          focalPoint: definition.cropFocalPoint,
        });
        crop = {
          method: "focal-point",
          focalPoint: definition.cropFocalPoint,
          sourceRegion,
        };
        pipeline = pipeline.extract(sourceRegion).resize({
          width: definition.width,
          height: definition.height,
          fit: "fill",
        });
      } else {
        pipeline = pipeline.resize({
          width: definition.width,
          height: definition.height,
          fit: "cover",
          position: "centre",
        });
      }
    }
    await pipeline.webp({ quality: 78, alphaQuality: 90, effort: 6 }).toFile(temporary);
    const inspected = await inspectImage(temporary, definition);
    if (inspected.errors.length) throw new Error(inspected.errors.join("; "));
    renameSync(temporary, paths.image);

    const provenance = {
      ...baseProvenance,
      candidatePath: relative(ROOT, paths.image),
      sha256: sha256File(paths.image),
      width: definition.width,
      height: definition.height,
      bytes: inspected.bytes,
      ...(crop ? { crop } : {}),
    };
    writeJsonAtomic(paths.provenance, provenance);
    return provenance;
  } catch (error) {
    rmSync(temporary, { force: true });
    rmSync(paths.image, { force: true });
    writeJsonAtomic(paths.provenance, {
      ...baseProvenance,
      processingStatus: "rejected",
      processingError: error.message,
    });
    throw error;
  }
}

function assertManifestUsable(manifest) {
  const { errors } = validateManifest(manifest, { requireComplete: false });
  if (errors.length) throw new Error(`manifest is invalid:\n${errors.join("\n")}`);
}

function readCandidate(id, manifest, { allowProcessingFailure = false } = {}) {
  const paths = candidatePaths(id);
  if (!existsSync(paths.provenance)) {
    throw new Error(`processed candidate is missing for ${id}`);
  }
  const provenance = JSON.parse(readFileSync(paths.provenance, "utf8"));
  if (provenance.id !== id) throw new Error(`candidate provenance ID mismatch for ${id}`);
  if (provenance.promptSha256 !== sha256Text(promptFor(id, provenance.approvalId, manifest))) {
    throw new Error(`candidate prompt hash does not match its approval for ${id}`);
  }
  if (!existsSync(paths.image)) {
    if (allowProcessingFailure && provenance.processingStatus === "rejected") {
      return { paths, provenance };
    }
    throw new Error(`processed candidate is missing for ${id}`);
  }
  if (provenance.sha256 !== sha256File(paths.image)) {
    throw new Error(`candidate file hash mismatch for ${id}`);
  }
  return { paths, provenance };
}

function upsertAsset(manifest, record) {
  const assets = manifest.assets.filter((asset) => asset.id !== record.id);
  assets.push(record);
  manifest.assets = assets.sort((left, right) => left.id.localeCompare(right.id));
}

function rejectedAttemptHistory(asset) {
  if (!asset || asset.status !== "rejected") return [];
  const attempt = { ...asset };
  const rejectedAttempts = Array.isArray(attempt.rejectedAttempts) ? attempt.rejectedAttempts : [];
  delete attempt.id;
  delete attempt.type;
  delete attempt.status;
  delete attempt.rejectedAttempts;
  return [...rejectedAttempts, attempt];
}

function allAttempts(assets) {
  return assets.flatMap((asset) => [asset, ...(Array.isArray(asset.rejectedAttempts) ? asset.rejectedAttempts : [])]);
}

export async function acceptCandidate({
  id,
  generationId,
  reviewer,
  model,
  settings,
  generatedAt,
  creditCost,
}) {
  const definition = ASSET_DEFINITIONS[id];
  if (!definition) throw new Error(`unknown asset id: ${id}`);
  const manifest = readManifest();
  assertManifestUsable(manifest);
  if (manifest.batch.approvalStatus !== "approved" || manifest.batch.approvedMaximumCredits <= 0) {
    throw new Error("cost approval is pending; accept is locked");
  }
  if (manifest.assets.some((asset) => asset.id === id && asset.status === "accepted")) {
    throw new Error(`${id} is already accepted`);
  }

  const { paths, provenance } = readCandidate(id, manifest);
  for (const [label, override, recorded] of [
    ["generation ID", generationId, provenance.generationId],
    ["model", model, provenance.model],
    ["settings", settings, provenance.settings],
    ["generated-at timestamp", generatedAt, provenance.generatedAt],
    ["credit cost", creditCost, provenance.creditCost],
  ]) {
    if (override !== undefined && !sameValue(override, recorded)) {
      throw new Error(`${label} override does not match processed candidate provenance`);
    }
  }
  const actualGenerationId = provenance.generationId;
  const actualModel = model ?? provenance.model;
  const actualSettings = settings ?? provenance.settings;
  const actualGeneratedAt = generatedAt ?? provenance.generatedAt;
  const actualCreditCost = creditCost ?? provenance.creditCost;
  if (!hasText(actualGenerationId) || /[<>]/.test(actualGenerationId)) {
    throw new Error("a real --generation-id is required");
  }
  if (!hasText(reviewer) || /[<>]/.test(reviewer)) throw new Error("a real --reviewer is required");
  if (!hasText(actualModel) || /[<>]/.test(actualModel)) {
    throw new Error("actual provider model is required; pass --model during process or accept");
  }
  if (!isRecord(actualSettings) || Object.keys(actualSettings).length === 0) {
    throw new Error("actual provider settings are required; pass --settings during process or accept");
  }
  const sensitiveSettings = [];
  findForbiddenKeys(actualSettings, sensitiveSettings, "settings");
  if (sensitiveSettings.length) throw new Error(sensitiveSettings.join("; "));
  if (!isIsoTimestamp(actualGeneratedAt)) {
    throw new Error("actual generated-at timestamp is required; pass --generated-at during process or accept");
  }
  if (!Number.isFinite(actualCreditCost) || actualCreditCost < 0) {
    throw new Error("actual credit cost is required; pass --credit-cost during process or accept");
  }
  assertAttemptAuthorized(manifest, provenance, { id });

  const matchingGeneration = manifest.assets.flatMap((asset) =>
    [asset, ...(Array.isArray(asset.rejectedAttempts) ? asset.rejectedAttempts : [])])
    .find((attempt) => attempt.generationId === actualGenerationId);
  if (matchingGeneration && matchingGeneration.creditCost !== actualCreditCost) {
    throw new Error("the repeated generation ID has a different credit cost");
  }
  const approvalCosts = new Map();
  for (const attempt of allAttempts(manifest.assets).filter((entry) =>
    entry.approvalId === provenance.approvalId && Number.isFinite(entry.creditCost))) {
    const key = hasText(attempt.generationId) ? `generation:${attempt.generationId}` : canonicalJson(attempt);
    if (!approvalCosts.has(key)) approvalCosts.set(key, attempt.creditCost);
  }
  const priorCredits = [...approvalCosts.values()].reduce((sum, cost) => sum + cost, 0);
  const addedCredits = matchingGeneration ? 0 : actualCreditCost;
  const activeApproval = manifest.batch.approvals.find((approval) => approval.id === provenance.approvalId);
  if (priorCredits + addedCredits > activeApproval.approvedMaximumCredits) {
    throw new Error("accept would exceed the approved maximum credits");
  }
  const inspected = await inspectImage(paths.image, definition);
  if (inspected.errors.length) throw new Error(inspected.errors.join("; "));

  const target = join(ROOT, definition.runtimePath);
  if (existsSync(target)) throw new Error(`runtime target already exists: ${definition.runtimePath}`);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  copyFileSync(paths.image, temporary);
  renameSync(temporary, target);

  const record = {
    id,
    type: definition.type,
    status: "accepted",
    approvalId: provenance.approvalId,
    runtimePath: definition.runtimePath,
    generationId: actualGenerationId,
    promptSha256: provenance.promptSha256,
    model: actualModel,
    settings: actualSettings,
    generatedAt: actualGeneratedAt,
    reviewer,
    reviewedAt: new Date().toISOString(),
    creditCost: actualCreditCost,
    sha256: provenance.sha256,
    sourceSha256: provenance.sourceSha256,
    sourceWidth: provenance.sourceWidth,
    sourceHeight: provenance.sourceHeight,
    width: definition.width,
    height: definition.height,
    bytes: inspected.bytes,
    ...(isRecord(provenance.crop) ? { crop: provenance.crop } : {}),
    ...(() => {
      const history = rejectedAttemptHistory(manifest.assets.find((asset) => asset.id === id));
      return history.length ? { rejectedAttempts: history } : {};
    })(),
  };
  upsertAsset(manifest, record);
  const checked = validateManifest(manifest, { requireComplete: false });
  if (checked.errors.length) {
    rmSync(target, { force: true });
    throw new Error(`refusing invalid acceptance:\n${checked.errors.join("\n")}`);
  }
  try {
    writeJsonAtomic(MANIFEST_PATH, manifest);
  } catch (error) {
    rmSync(target, { force: true });
    throw error;
  }
  return record;
}

export function rejectCandidate({ id, reason, reviewer }) {
  const definition = ASSET_DEFINITIONS[id];
  if (!definition) throw new Error(`unknown asset id: ${id}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reason ?? "")) {
    throw new Error("--reason must be a non-empty kebab-case rejection code");
  }
  if (!hasText(reviewer) || /[<>]/.test(reviewer)) throw new Error("a real --reviewer is required");
  const manifest = readManifest();
  assertManifestUsable(manifest);
  if (manifest.assets.some((asset) => asset.id === id && asset.status === "accepted")) {
    throw new Error(`cannot reject already accepted asset: ${id}`);
  }
  const priorHistory = rejectedAttemptHistory(manifest.assets.find((asset) => asset.id === id));
  const { paths, provenance } = readCandidate(id, manifest, { allowProcessingFailure: true });
  const record = {
    id,
    type: definition.type,
    status: "rejected",
    ...(hasText(provenance.approvalId) ? { approvalId: provenance.approvalId } : {}),
    promptSha256: provenance.promptSha256,
    sha256: provenance.sha256 ?? provenance.sourceSha256,
    reviewer,
    reviewedAt: new Date().toISOString(),
    rejectionReason: reason,
    ...(hasText(provenance.generationId) ? { generationId: provenance.generationId } : {}),
    ...(hasText(provenance.model) ? { model: provenance.model } : {}),
    ...(isRecord(provenance.settings) ? { settings: provenance.settings } : {}),
    ...(isIsoTimestamp(provenance.generatedAt) ? { generatedAt: provenance.generatedAt } : {}),
    ...(Number.isFinite(provenance.creditCost) ? { creditCost: provenance.creditCost } : {}),
    ...(priorHistory.length ? { rejectedAttempts: priorHistory } : {}),
  };
  upsertAsset(manifest, record);
  const checked = validateManifest(manifest, { requireComplete: false });
  if (checked.errors.length) throw new Error(`refusing invalid rejection:\n${checked.errors.join("\n")}`);
  writeJsonAtomic(MANIFEST_PATH, manifest);
  const rejectedProvenance = { ...provenance, status: "rejected", rejectionReason: reason, reviewer };
  writeJsonAtomic(paths.provenance, rejectedProvenance);
  const archiveKey = (provenance.generationId ?? provenance.processedAt).replace(/[^a-zA-Z0-9_-]/g, "-");
  const archiveBase = join(ARTIFACTS_DIR, "rejected", `${id}-${archiveKey}`);
  writeJsonAtomic(`${archiveBase}.json`, rejectedProvenance);
  if (existsSync(paths.image)) copyFileSync(paths.image, `${archiveBase}.webp`);
  return record;
}

export function recordEstimate({ credits, maximum, approvalId, model, settings }) {
  if (!(credits > 0) || !(maximum > 0)) throw new Error("credits and maximum must be positive");
  if (credits > maximum) throw new Error("estimated credits exceed the approved maximum");
  const manifest = readManifest();
  assertManifestUsable(manifest);
  const extendedValues = [approvalId, model, settings];
  const isExtended = extendedValues.some((value) => value !== undefined);
  if (isExtended && extendedValues.some((value) => value === undefined)) {
    throw new Error("binding an estimate requires --approval-id, --model, and --settings together");
  }

  let approvals = manifest.batch.approvals.filter((approval) => approval.approvalStatus !== "unbound");
  let activeApproval;
  if (!isExtended) {
    activeApproval = {
      id: `unbound-${credits}-${maximum}`,
      model: null,
      estimatedCredits: credits,
      approvedMaximumCredits: maximum,
      approvalStatus: "unbound",
      settings: null,
      prompts: null,
    };
  } else {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(approvalId)) {
      throw new Error("--approval-id must be a real kebab-case ID");
    }
    if (!hasText(model) || /[<>]/.test(model)) throw new Error("--model must be the approved provider model");
    if (!isRecord(settings) || Object.keys(settings).length === 0) {
      throw new Error("--settings must record the bounded approval settings");
    }
    const sensitiveSettings = [];
    findForbiddenKeys(settings, sensitiveSettings, "settings");
    if (sensitiveSettings.length) throw new Error(sensitiveSettings.join("; "));
    const existing = manifest.batch.approvals.find((approval) => approval.id === approvalId);
    if (existing && existing.approvalStatus !== "unbound") {
      throw new Error(`approval ID already exists: ${approvalId}`);
    }
    if (existing && (existing.estimatedCredits !== credits || existing.approvedMaximumCredits !== maximum)) {
      throw new Error("bound approval credits must match its unbound estimate");
    }
    activeApproval = {
      id: approvalId,
      model,
      estimatedCredits: credits,
      approvedMaximumCredits: maximum,
      approvalStatus: "approved",
      settings,
      prompts: approvalPrompts(model, settings),
    };
  }
  approvals = approvals.map((approval) => approval.approvalStatus === "approved" ? {
    ...approval,
    approvalStatus: "superseded",
  } : approval);
  approvals.push(activeApproval);
  manifest.batch = {
    topicId: "cafe-restaurant",
    estimatedCredits: approvals.reduce((sum, approval) => sum + approval.estimatedCredits, 0),
    approvedMaximumCredits: approvals.reduce((sum, approval) => sum + approval.approvedMaximumCredits, 0),
    approvalStatus: isExtended ? "approved" : "pending",
    activeApprovalId: activeApproval.id,
    approvals,
  };
  const checked = validateManifest(manifest, { requireComplete: false });
  if (checked.errors.length) throw new Error(`refusing invalid approval:\n${checked.errors.join("\n")}`);
  writeJsonAtomic(MANIFEST_PATH, manifest);
  return { batch: manifest.batch, activeApproval };
}

export async function verifyAssets() {
  const manifest = readManifest();
  const errors = [...validateManifest(manifest, { requireComplete: true }).errors];
  for (const asset of manifest.assets.filter((entry) => entry.status === "accepted")) {
    const definition = ASSET_DEFINITIONS[asset.id];
    if (!definition) continue;
    const path = join(ROOT, asset.runtimePath);
    if (!existsSync(path)) continue;
    const inspected = await inspectImage(path, definition);
    errors.push(...inspected.errors.map((error) => `${asset.id}: ${error}`));
    if (asset.bytes !== inspected.bytes) errors.push(`${asset.id}: recorded byte size does not match file`);
    if (asset.sha256 !== sha256File(path)) errors.push(`${asset.id}: recorded SHA-256 does not match file`);
  }
  return { errors };
}

const usage = `Usage:
  node scripts/context-assets.mjs estimate --credits <live-total> --maximum <approved-maximum>
  node scripts/context-assets.mjs estimate --credits <live-total> --maximum <approved-maximum> --approval-id <id> --model <model> --settings <json>
  node scripts/context-assets.mjs process --source <absolute-path> --id <asset-id> --approval-id <id> <provenance options>
  node scripts/context-assets.mjs accept --id <asset-id> --generation-id <provider-id> --reviewer <name> [provenance options]
  node scripts/context-assets.mjs reject --id <asset-id> --reason <rejection-code> --reviewer <name>
  node scripts/context-assets.mjs verify

Provenance options: --generation-id <provider-id> --model <provider-model> --settings <json> --generated-at <ISO-8601> --credit-cost <credits>`;

export async function runCli(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);
  if (command === "estimate") {
    assertOnlyOptions(options, ["credits", "maximum", "approval-id", "model", "settings"]);
    const result = recordEstimate({
      credits: finiteNumber(required(options, "credits"), "--credits", { positive: true }),
      maximum: finiteNumber(required(options, "maximum"), "--maximum", { positive: true }),
      approvalId: options["approval-id"],
      model: options.model,
      settings: options.settings === undefined ? undefined : parseSettings(options.settings),
    });
    console.log(`context-assets: ${result.activeApproval.approvalStatus} ${result.activeApproval.id} at ` +
      `${result.activeApproval.estimatedCredits}/${result.activeApproval.approvedMaximumCredits} credits ` +
      `(cumulative maximum ${result.batch.approvedMaximumCredits})`);
    return;
  }
  if (command === "process") {
    assertOnlyOptions(options, ["source", "id", "approval-id", "generation-id", "model", "settings", "generated-at", "credit-cost"]);
    const result = await processCandidate({
      id: required(options, "id"),
      source: required(options, "source"),
      approvalId: options["approval-id"],
      generationId: options["generation-id"],
      model: options.model,
      settings: options.settings === undefined ? undefined : parseSettings(options.settings),
      generatedAt: options["generated-at"],
      creditCost: options["credit-cost"] === undefined ? undefined :
        finiteNumber(options["credit-cost"], "--credit-cost"),
    });
    console.log(`context-assets: processed ${result.id} (${result.bytes} bytes, ${result.sha256})`);
    return;
  }
  if (command === "accept") {
    assertOnlyOptions(options, ["id", "generation-id", "reviewer", "model", "settings", "generated-at", "credit-cost"]);
    const result = await acceptCandidate({
      id: required(options, "id"),
      generationId: options["generation-id"],
      reviewer: options.reviewer,
      model: options.model,
      settings: options.settings === undefined ? undefined : parseSettings(options.settings),
      generatedAt: options["generated-at"],
      creditCost: options["credit-cost"] === undefined ? undefined :
        finiteNumber(options["credit-cost"], "--credit-cost"),
    });
    console.log(`context-assets: accepted ${result.id} -> ${result.runtimePath}`);
    return;
  }
  if (command === "reject") {
    assertOnlyOptions(options, ["id", "reason", "reviewer"]);
    const result = rejectCandidate({
      id: required(options, "id"),
      reason: required(options, "reason"),
      reviewer: options.reviewer,
    });
    console.log(`context-assets: rejected ${result.id} (${result.rejectionReason})`);
    return;
  }
  if (command === "verify") {
    assertOnlyOptions(options, []);
    const result = await verifyAssets();
    if (result.errors.length) throw new Error(result.errors.join("\n"));
    console.log(`context-assets: verified ${Object.keys(ASSET_DEFINITIONS).length} accepted assets`);
    return;
  }
  throw new Error(`${usage}\n${command ? `\nUnknown command: ${command}` : ""}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(`context-assets: ${error.message}`);
    process.exitCode = 1;
  });
}
