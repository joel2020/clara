// When (and whether) a humor reaction from lib/content/humor.ts may appear.
// Pure and deterministic — no Math.random, no Date.now — so the same moment
// always makes the same call and the rules are plain-node testable.
//
// Safety rules (spec section 11):
// - Never during consent, microphone trouble, sync/account problems, any
//   technical failure, or corrective explanation.
// - Joel's voice only ever uses lines he explicitly approved; drafts and
//   anything else return null.
// - At most one strong reaction per session, low probability, and a stored
//   cooldown: the caller persists the day a strong reaction was shown and
//   passes it back as lastStrongReactionAt. Same-day calls are inside the
//   cooldown, which is what caps strong reactions at one per session.

import { HUMOR_BANK, type HumorReaction, type HumorSpeaker } from "./content/humor";

/** Moments where humor must never appear, listed explicitly. */
export const RESTRICTED_CONTEXTS = new Set([
  "consent",
  "microphone-error",
  "sync-error",
  "correction",
  "account-error",
]);

/** Days that must pass after a strong reaction before the next one. */
export const STRONG_COOLDOWN_DAYS = 3;

// Out of 100: strong is rare, light is occasional, most moments get nothing.
const STRONG_CHANCE = 8;
const LIGHT_CHANCE = 40;

/** Restricted if explicitly listed, or any technical-failure context. */
export function isRestrictedContext(context: string): boolean {
  return RESTRICTED_CONTEXTS.has(context) || /error|failure/i.test(context);
}

/** Deterministic 32-bit FNV-1a hash (same scheme as lib/exam-compose.ts). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function cooldownElapsed(lastStrongDay: string | null, day: string): boolean {
  if (!lastStrongDay) return true;
  const last = Date.parse(lastStrongDay);
  const now = Date.parse(day);
  if (Number.isNaN(last) || Number.isNaN(now)) return true;
  return (now - last) / 86_400_000 >= STRONG_COOLDOWN_DAYS;
}

export interface HumorSelectionInput {
  speaker: HumorSpeaker;
  context: string;
  /** Day key, YYYY-MM-DD (see dayKey in lib/gamification.ts). */
  day: string;
  sessionId: string;
  /** Day key of the last strong reaction shown, or null. The caller stores
   *  this when a strong reaction is returned and passes it back afterward. */
  lastStrongReactionAt: string | null;
}

export function selectHumorReaction(input: HumorSelectionInput): HumorReaction | null {
  const { speaker, context, day, sessionId, lastStrongReactionAt } = input;
  if (isRestrictedContext(context)) return null;

  // Approval gate: Clara ships reviewed copy; Joel only lines he approved.
  // Drafts never render.
  const releasable = speaker === "joel" ? "joel-approved" : "reviewed";
  const pool = HUMOR_BANK.filter(
    (r) => r.speaker === speaker && r.approval === releasable && (r.contexts as string[]).includes(context),
  );
  if (pool.length === 0) return null;

  const seed = `${day}|${sessionId}|${context}`;
  const roll = hash(seed) % 100;
  const strongPool = pool.filter((r) => r.strength === "strong");
  const lightPool = pool.filter((r) => r.strength === "light");

  if (roll < STRONG_CHANCE && strongPool.length > 0 && cooldownElapsed(lastStrongReactionAt, day)) {
    return strongPool[hash(seed + "|pick") % strongPool.length];
  }
  if (roll < STRONG_CHANCE + LIGHT_CHANCE && lightPool.length > 0) {
    return lightPool[hash(seed + "|pick") % lightPool.length];
  }
  return null;
}
