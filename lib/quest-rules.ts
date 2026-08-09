import type { DailyQuestState } from "./db/types";

export type QuestKind = "talk" | "review" | "learn";

export const QUEST_TARGETS: Readonly<Record<QuestKind, number>> = {
  talk: 1,
  review: 5,
  learn: 5,
};

export const QUEST_BONUS_XP = 30;

export function emptyQuestState(day: string): DailyQuestState {
  return { day, talk: 0, review: 0, learn: 0, claimed: false };
}

export function allQuestTargetsMet(state: DailyQuestState): boolean {
  return state.talk >= QUEST_TARGETS.talk
    && state.review >= QUEST_TARGETS.review
    && state.learn >= QUEST_TARGETS.learn;
}

export function applyQuestEvent(
  state: DailyQuestState,
  kind: QuestKind,
): { state: DailyQuestState; bonusXp: number } {
  const next = { ...state, [kind]: state[kind] + 1 };
  if (!next.claimed && allQuestTargetsMet(next)) {
    return { state: { ...next, claimed: true }, bonusXp: QUEST_BONUS_XP };
  }
  return { state: next, bonusXp: 0 };
}
