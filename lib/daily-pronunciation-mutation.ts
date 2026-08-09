import { dailyPronunciationChoiceIds, type DailySession } from "./daily-session.ts";
import {
  advanceDailyPronunciationGame,
  dailyPronunciationContentHash,
  dailyPronunciationLegacyContentHash,
  isDailyPronunciationAttemptEvent,
  isDailyPronunciationGameState,
  mergeDailyPronunciationGameStates,
  type DailyPronunciationAttemptEvent,
  type DailyPronunciationGameState,
} from "./speech/daily-pronunciation-game.ts";

export interface DailyPronunciationAttemptMutation {
  day: string;
  activityId: string;
  contentHash: string;
  event: DailyPronunciationAttemptEvent;
  at: number;
}

export interface BoundPronunciationCheckpoint {
  day: string;
  activityId: string;
  contentHash: string;
  state: DailyPronunciationGameState;
  at: number;
}

function activityBoundary(session: DailySession, activityId: string, contentHash: string) {
  const activity = session.activities.find((entry) => entry.id === activityId);
  const pronunciation = activity?.pronunciation;
  if (!activity || !pronunciation) throw new Error(`Unknown pronunciation activity: ${activityId}`);
  const expectedHashes = [
    dailyPronunciationContentHash(pronunciation.game, pronunciation.targets, pronunciation.itemPool),
    dailyPronunciationLegacyContentHash(pronunciation.game, pronunciation.targets),
  ];
  if (!expectedHashes.includes(contentHash) || pronunciation.state?.contentHash !== contentHash
    || pronunciation.state?.game !== pronunciation.game
    || !isDailyPronunciationGameState(pronunciation.state, expectedHashes, dailyPronunciationChoiceIds(pronunciation, pronunciation.state?.targetIndex ?? 0))) {
    throw new Error("Pronunciation mutation does not match authored content");
  }
  return { activity, pronunciation };
}

function publishState(session: DailySession, activityId: string, state: DailyPronunciationGameState, at: number): DailySession {
  const terminalStatus = state.terminal ? (state.gradedTargets > 0 ? "completed" as const : "technical-skip" as const) : undefined;
  const activities = session.activities.map((entry) => entry.id !== activityId ? { ...entry } : {
    ...entry,
    ...(terminalStatus ? { status: terminalStatus } : {}),
    ...(terminalStatus === "completed" ? { completedAt: entry.completedAt ?? at } : {}),
    pronunciation: { ...entry.pronunciation!, state },
  });
  const next = activities.find((entry) => entry.status === "pending" || entry.status === "active");
  return {
    ...session,
    version: 2,
    activities,
    currentActivityId: next?.id ?? null,
    startedAt: session.startedAt ?? at,
    completedAt: next ? session.completedAt : (session.completedAt ?? at),
    updatedAt: Math.max(session.updatedAt, at),
  };
}

export function applyDailyPronunciationAttempt(session: DailySession, mutation: DailyPronunciationAttemptMutation): DailySession {
  if (session.day !== mutation.day || !isDailyPronunciationAttemptEvent(mutation.event)) throw new Error("Invalid daily pronunciation attempt mutation");
  const { pronunciation } = activityBoundary(session, mutation.activityId, mutation.contentHash);
  const next = advanceDailyPronunciationGame(pronunciation.state!, { type: "attempt", event: mutation.event });
  return publishState(session, mutation.activityId, next, mutation.at);
}

export function applyBoundPronunciationCheckpoint(session: DailySession, checkpoint: BoundPronunciationCheckpoint): DailySession {
  if (session.day !== checkpoint.day || !isDailyPronunciationGameState(checkpoint.state, checkpoint.contentHash)) throw new Error("Invalid pronunciation checkpoint");
  const { pronunciation } = activityBoundary(session, checkpoint.activityId, checkpoint.contentHash);
  if (!isDailyPronunciationGameState(checkpoint.state, checkpoint.contentHash, dailyPronunciationChoiceIds(pronunciation, checkpoint.state.targetIndex))) {
    throw new Error("Invalid pronunciation checkpoint choice");
  }
  if (checkpoint.state.game !== pronunciation.game) throw new Error("Pronunciation checkpoint game mismatch");
  const merged = mergeDailyPronunciationGameStates(pronunciation.state!, checkpoint.state);
  if (JSON.stringify(merged) === JSON.stringify(pronunciation.state)) return session;
  return publishState(session, checkpoint.activityId, merged, checkpoint.at);
}
