import type { ActivityStatus, DailyActivity, DailySession } from "./daily-session.ts";
import { boundAccountId } from "./db/dexie.ts";
import { repo } from "./db/index.ts";

const STATUS_RANK: Record<ActivityStatus, number> = {
  pending: 0,
  active: 1,
  "technical-skip": 2,
  completed: 3,
};

function mergeActivity(newer: DailyActivity, older: DailyActivity): DailyActivity {
  const evidence = STATUS_RANK[newer.status] >= STATUS_RANK[older.status] ? newer : older;
  const { completedAt: _newerCompletedAt, ...newerWithoutCompletion } = newer;
  return {
    ...newerWithoutCompletion,
    status: evidence.status,
    ...(evidence.completedAt === undefined ? {} : { completedAt: evidence.completedAt }),
  };
}

/**
 * Merge two copies of the same daily session without allowing stale device
 * state to erase learner evidence or a one-time reward claim.
 */
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

function assertBoundAccount(profileId: string): void {
  const bound = boundAccountId();
  if (bound && bound !== profileId.trim().toLowerCase()) {
    throw new Error("Daily session profile does not match the bound account");
  }
}

/** Read one day from the currently bound account-scoped database. */
export async function getDailySession(day: string): Promise<DailySession | undefined> {
  const local = await repo.getDailySession(day);
  const profileId = boundAccountId();
  if (!profileId) return local;
  try {
    const { pullDailySession } = await import("./sync/supabase-sync.ts");
    const remote = await pullDailySession(profileId, day);
    if (!remote) return local;
    const merged = local ? mergeDailySessions(local, remote) : remote;
    await repo.saveDailySession(merged);
    return merged;
  } catch {
    return local;
  }
}

/**
 * Persist a session without allowing a stale caller to regress evidence already
 * present on this device.
 */
export async function saveDailySession(session: DailySession): Promise<DailySession> {
  assertBoundAccount(session.profileId);
  const existing = await repo.getDailySession(session.day);
  const durable = existing ? mergeDailySessions(existing, session) : session;
  await repo.saveDailySession(durable);
  return durable;
}

export interface ActivityCheckpoint {
  day: string;
  activityId: string;
  status: "completed" | "technical-skip";
  at: number;
}

/**
 * Record one terminal activity result and wait for IndexedDB before returning,
 * so navigation or a tab close immediately after the checkpoint cannot lose it.
 */
export async function checkpointActivity(input: ActivityCheckpoint): Promise<DailySession> {
  const existing = await getDailySession(input.day);
  if (!existing) throw new Error(`No daily session exists for ${input.day}`);
  const found = existing.activities.some((entry) => entry.id === input.activityId);
  if (!found) throw new Error(`Unknown daily activity: ${input.activityId}`);
  const activities = existing.activities.map((entry) => {
    if (entry.id !== input.activityId || entry.status === "completed") return { ...entry };
    return {
      ...entry,
      status: input.status,
      ...(input.status === "completed" ? { completedAt: entry.completedAt ?? input.at } : {}),
    };
  });
  const current = activities.find((entry) => entry.status === "pending" || entry.status === "active");
  const checkpointed: DailySession = {
    ...existing,
    activities,
    currentActivityId: current?.id ?? null,
    startedAt: existing.startedAt ?? input.at,
    completedAt: current ? existing.completedAt : (existing.completedAt ?? input.at),
    updatedAt: Math.max(existing.updatedAt, input.at),
  };
  return saveDailySession(checkpointed);
}
