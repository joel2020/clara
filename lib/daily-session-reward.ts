import type { DailySession } from "./daily-session.ts";
import type { PlayerStats } from "./db/types.ts";

/** A modest completion bonus on top of the attempt-level rewards in the loop. */
export const DAILY_SESSION_REWARD_XP = 20;
export const DAILY_SESSION_REWARD_STARS = 5;

export interface DailySessionReward {
  xp: number;
  stars: number;
}

export interface SessionCompletionResult {
  player: PlayerStats;
  session: DailySession;
  reward: DailySessionReward;
}

const NO_REWARD: DailySessionReward = { xp: 0, stars: 0 };

/**
 * Apply the one-time daily-session completion transition without reading time
 * or storage. A technical skip closes the activity but never changes attempt,
 * pass, weakness, combo, or streak evidence.
 */
export function applySessionCompletion(
  player: PlayerStats,
  session: DailySession,
  today: string = session.day,
): SessionCompletionResult {
  const complete =
    session.activities.length > 0 &&
    session.activities.every(
      (activity) =>
        activity.status === "completed" || activity.status === "technical-skip",
    );
  if (!complete || session.rewardClaimed) {
    return { player, session, reward: NO_REWARD };
  }

  const at = session.completedAt ?? session.updatedAt;
  const isCurrentDay = session.day === today;
  return {
    player: {
      ...player,
      xp: player.xp + DAILY_SESSION_REWARD_XP,
      stars: (player.stars ?? 0) + DAILY_SESSION_REWARD_STARS,
      ...(isCurrentDay
        ? {
            todayKey: today,
            todayXp:
              player.todayKey === today
                ? player.todayXp + DAILY_SESSION_REWARD_XP
                : DAILY_SESSION_REWARD_XP,
          }
        : {}),
      updatedAt: Math.max(player.updatedAt, at),
    },
    session: {
      ...session,
      rewardClaimed: true,
      updatedAt: Math.max(session.updatedAt, at),
    },
    reward: {
      xp: DAILY_SESSION_REWARD_XP,
      stars: DAILY_SESSION_REWARD_STARS,
    },
  };
}
