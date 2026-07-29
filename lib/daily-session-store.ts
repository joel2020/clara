import type { DailySession } from "./daily-session.ts";
import { boundAccountId } from "./db/dexie.ts";
import { repo } from "./db/index.ts";
import { mergeDailySessions } from "./daily-session-merge.ts";

export { mergeDailySessions } from "./daily-session-merge.ts";

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
  return repo.saveDailySession(session);
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
