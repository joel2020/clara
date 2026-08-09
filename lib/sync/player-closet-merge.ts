import type { PlayerStats } from "../db/types.ts";

const SAFE_MILESTONE_ID = /^[a-z0-9][a-z0-9:._/-]{0,127}$/i;
const MAX_MILESTONES = 64;

function normalizedMilestones(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (entry): entry is string => typeof entry === "string" && SAFE_MILESTONE_ID.test(entry),
  ))].sort().slice(0, MAX_MILESTONES);
}

function lifetimeCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Merge monotonic Closet evidence without changing the existing newer-row rule
 * for spendable currency and equipped cosmetics.
 */
export function mergePlayerClosetProgress(
  local: PlayerStats | null | undefined,
  cloud: PlayerStats,
): PlayerStats {
  const localUpdatedAt = local?.updatedAt ?? 0;
  const cloudUpdatedAt = cloud.updatedAt ?? 0;
  const winner = local && localUpdatedAt > cloudUpdatedAt ? local : cloud;
  return {
    ...winner,
    completedDailySessions: Math.max(
      lifetimeCount(local?.completedDailySessions),
      lifetimeCount(cloud.completedDailySessions),
    ),
    unlockedMilestones: normalizedMilestones([
      ...normalizedMilestones(local?.unlockedMilestones),
      ...normalizedMilestones(cloud.unlockedMilestones),
    ]),
    updatedAt: Math.max(localUpdatedAt, cloudUpdatedAt),
  };
}
