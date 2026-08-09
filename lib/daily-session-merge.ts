import type { ActivityStatus, DailyActivity, DailySession } from "./daily-session.ts";
import { mergeDailyPronunciationGameStates } from "./speech/daily-pronunciation-game.ts";

const STATUS_RANK: Record<ActivityStatus, number> = {
  pending: 0,
  active: 1,
  "technical-skip": 2,
  completed: 3,
};

function mergeActivity(newer: DailyActivity, older: DailyActivity): DailyActivity {
  const evidence = STATUS_RANK[newer.status] >= STATUS_RANK[older.status] ? newer : older;
  const newerWithoutCompletion = { ...newer };
  delete newerWithoutCompletion.completedAt;
  if (newer.pronunciation?.state && older.pronunciation?.state
    && (newer.pronunciation.state.contentHash !== older.pronunciation.state.contentHash
      || newer.pronunciation.state.game !== older.pronunciation.state.game)) {
    throw new Error("Cannot merge incompatible pronunciation content");
  }
  const pronunciation = newer.pronunciation?.state && older.pronunciation?.state
    ? {
        ...newer.pronunciation,
        state: mergeDailyPronunciationGameStates(newer.pronunciation.state, older.pronunciation.state),
      }
    : newer.pronunciation?.state ? newer.pronunciation
      : older.pronunciation?.state ? older.pronunciation
        : newer.pronunciation ?? older.pronunciation;
  return {
    ...newerWithoutCompletion,
    ...(pronunciation ? { pronunciation } : {}),
    status: evidence.status,
    ...(evidence.completedAt === undefined ? {} : { completedAt: evidence.completedAt }),
  };
}

/** Pure monotonic merge shared by the store and the atomic repository write. */
export function mergeDailySessions(local: DailySession, remote: DailySession): DailySession {
  if (local.profileId !== remote.profileId || local.day !== remote.day || local.id !== remote.id) {
    throw new Error("Cannot merge daily sessions from different accounts or days");
  }
  const newer = local.updatedAt >= remote.updatedAt ? local : remote;
  const older = newer === local ? remote : local;
  const olderById = new Map(older.activities.map((entry) => [entry.id, entry]));
  const activities = newer.activities.map((entry) => {
    const other = olderById.get(entry.id);
    if (!other) return entry;
    olderById.delete(entry.id);
    return mergeActivity(entry, other);
  });
  activities.push(...olderById.values());
  const current = activities.find((entry) => entry.status === "pending" || entry.status === "active");
  return {
    ...newer,
    version: Math.max(local.version, remote.version) as DailySession["version"],
    activities,
    currentActivityId: current?.id ?? null,
    rewardClaimed: local.rewardClaimed || remote.rewardClaimed,
    startedAt: [local.startedAt, remote.startedAt]
      .filter((at): at is number => at !== null)
      .sort((a, b) => a - b)[0] ?? null,
    completedAt: local.completedAt ?? remote.completedAt,
    createdAt: Math.min(local.createdAt, remote.createdAt),
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
  };
}
