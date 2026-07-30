// When a Medellín reaction may appear on a call, and which one.
//
// This is an adapter over lib/humor.ts, not a second humor system. It maps call
// events onto the existing contexts and adds the two call-specific rules:
//
//   1. Humor follows SUCCESS only — an accepted retry or a finished call. It is
//      never attached to a correction, a failed retry, a microphone problem or
//      a network error. Landing a joke on someone who just got something wrong
//      is the exact failure mode the content rules forbid.
//   2. The learner's humor setting is honored here rather than at the render
//      site, so "off" means no reaction is ever selected — not one selected and
//      then hidden.
//
// Joel's lines are all held as drafts in lib/content/humor.ts and are excluded
// at runtime by the selector until he approves them, so asking for his voice
// legitimately returns nothing today. That is deliberate: the slot is wired so
// approval is the only remaining step, and nothing is ever put in his mouth
// that he has not signed off.

import { selectHumorReaction } from "../humor.ts";
import type { HumorReaction } from "../content/humor.ts";

export type HumorLevel = "off" | "light" | "full";

/** Call moments that may carry a reaction. Deliberately all positive. */
export type CallHumorEvent = "retry-accepted" | "call-complete";

export interface CallHumorInput {
  event: CallHumorEvent;
  level: HumorLevel;
  day: string;
  sessionId: string;
  lastStrongReactionAt: string | null;
  /** How many reactions have already appeared on this call. */
  shownThisCall: number;
  /**
   * Did the moment actually go well?
   *
   * Required, and not defaulted to true. A celebratory line after a one-turn
   * call that missed its objective reads as the app not listening — which is
   * worse than no joke at all. Observed in browser testing, where a mastery
   * reaction landed on a call the learner had just struggled through.
   */
  succeeded: boolean;
  /** Prefer Joel's voice when he has approved lines; falls back to Clara. */
  preferJoel?: boolean;
}

/** At most this many reactions per call, even at "full". */
export const MAX_REACTIONS_PER_CALL = 2;

const EVENT_CONTEXT: Record<CallHumorEvent, string> = {
  "retry-accepted": "recovery",
  "call-complete": "mastery",
};

export function selectCallHumor(input: CallHumorInput): HumorReaction | null {
  if (input.level === "off") return null;
  if (!input.succeeded) return null;
  if (input.shownThisCall >= MAX_REACTIONS_PER_CALL) return null;
  // "light" gets one reaction per call, and only at the end, so a learner who
  // finds this stuff grating still hears it at most once.
  if (input.level === "light" && (input.shownThisCall >= 1 || input.event !== "call-complete")) return null;

  const context = EVENT_CONTEXT[input.event];
  const base = {
    context,
    day: input.day,
    sessionId: input.sessionId,
    lastStrongReactionAt: input.lastStrongReactionAt,
  };

  if (input.preferJoel) {
    // Returns null until Joel approves his bank — never a draft.
    const joel = selectHumorReaction({ ...base, speaker: "joel" });
    if (joel) return joel;
  }
  return selectHumorReaction({ ...base, speaker: "clara" });
}
