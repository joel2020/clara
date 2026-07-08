import { repo } from "@/lib/db";
import { dayKey } from "@/lib/gamification";
import type { DailyQuestState } from "@/lib/db/types";

// Daily quests: three tiny missions that make the everyday habit concrete —
// talk once, review a few words, learn a few new ones. Consistency is the single
// biggest predictor of reaching conversational, so the goal here is "come back
// and do a little, every day", not big numbers. Completing all three banks a
// small XP bonus. State rolls over automatically each local day.

export type QuestKind = "talk" | "review" | "learn";

export interface QuestDef {
  kind: QuestKind;
  target: number;
}

export const QUESTS: QuestDef[] = [
  { kind: "talk", target: 1 }, // have one conversation exchange with Joel
  { kind: "review", target: 5 }, // refresh 5 words that came due
  { kind: "learn", target: 5 }, // practice 5 new words
];

export const QUEST_BONUS_XP = 30;

export function emptyQuests(day: string): DailyQuestState {
  return { day, talk: 0, review: 0, learn: 0, claimed: false };
}

export function questTarget(kind: QuestKind): number {
  return QUESTS.find((q) => q.kind === kind)?.target ?? 1;
}

export function questDone(state: DailyQuestState, kind: QuestKind): boolean {
  return state[kind] >= questTarget(kind);
}

export function allQuestsDone(state: DailyQuestState): boolean {
  return QUESTS.every((q) => state[q.kind] >= q.target);
}

export function questsCompleted(state: DailyQuestState): number {
  return QUESTS.filter((q) => state[q.kind] >= q.target).length;
}

/**
 * Record one quest-relevant action for today, banking the completion bonus the
 * first time all three are done. Best-effort and self-contained (uses the repo);
 * safe to call from any client code path.
 */
export async function recordQuestEvent(kind: QuestKind): Promise<void> {
  const day = dayKey();
  const state = (await repo.getQuests(day)) ?? emptyQuests(day);
  const next: DailyQuestState = { ...state, [kind]: state[kind] + 1 };

  if (!next.claimed && allQuestsDone(next)) {
    next.claimed = true;
    const player = await repo.getPlayerStats();
    await repo.savePlayerStats({ ...player, xp: player.xp + QUEST_BONUS_XP, updatedAt: Date.now() });
  }

  await repo.saveQuests(next);
}
