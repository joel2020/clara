"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackDailySession } from "@/lib/analytics";
import { LESSONS } from "@/lib/content/lessons";
import { SCENARIOS } from "@/lib/content/scenarios";
import { SUPPORT_UNIT_IDS } from "@/lib/content/conversation-support";
import type { SessionCompletionResult } from "@/lib/daily-session-reward";
import { composeComebackSession } from "@/lib/comeback";
import {
  type ActivityStatus,
  type DailySession,
} from "@/lib/daily-session";
import {
  claimSessionCompletion,
  checkpointActivity,
  checkpointPronunciationGame,
  getDailySession,
  saveDailySession,
} from "@/lib/daily-session-store";
import type { DailyPronunciationGameState } from "@/lib/speech/daily-pronunciation-game";
import { dailyPronunciationEvidence, loadOrCreateDailySession } from "@/lib/daily-session-loader";
import { repo } from "@/lib/db";
import { dayKey } from "@/lib/gamification";
import { levelLessonPool } from "@/lib/onboarding";
import { pathOf } from "@/lib/paths";
import type { Level } from "@/lib/placement";
import type { PracticePersistenceBinding } from "@/lib/db/repository";

type CheckpointStatus = Extract<
  ActivityStatus,
  "completed" | "technical-skip"
>;

export interface DailySessionHook {
  session: DailySession | null;
  loading: boolean;
  start: () => Promise<DailySession | null>;
  checkpoint: (
    activityId: string,
    status: CheckpointStatus,
  ) => Promise<DailySession>;
  checkpointPronunciation: (activityId: string, state: DailyPronunciationGameState, binding: PracticePersistenceBinding) => Promise<DailySession>;
  claimCompletion: () => Promise<SessionCompletionResult | null>;
}

function estimatedRecentMinutes(
  quests:
    | { talk: number; review: number; learn: number }
    | undefined,
): number {
  if (!quests) return 0;
  return Math.min(
    15,
    quests.talk * 3 + Math.ceil(quests.review / 2) + Math.ceil(quests.learn / 2),
  );
}

/**
 * Load or create today's stable session, then expose durable lifecycle
 * transitions. Composition happens only after the persisted-day lookup misses.
 */
export function useDailySession(): DailySessionHook {
  const [day] = useState(() => dayKey());
  const [session, setSession] = useState<DailySession | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<DailySession | null>(null);
  const claimRef = useRef<Promise<SessionCompletionResult | null> | null>(null);

  const publish = useCallback((next: DailySession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const loaded = await loadOrCreateDailySession({
          day,
          load: getDailySession,
          compose: async () => {
            const settings = await repo.getSettings();
            if (!settings.profileId) return null;
            const [progress, attempts, customLessons, quests, stats] =
              await Promise.all([
                repo.getAllProgress(),
                repo.getAttempts({ limit: 50 }),
                repo.getCustomLessons(),
                repo.getQuests(day),
                repo.getPlayerStats(),
              ]);
            const now = Date.now();
            const level: Level = settings.onboarding?.level ?? "A1";
            const path = pathOf(settings.onboarding);
            const pathLessonIds =
              path === "job"
                ? [...SUPPORT_UNIT_IDS, ...levelLessonPool(level)]
                : levelLessonPool(level);
            // Composes the ordinary session unless a local day was missed, in
            // which case the learner gets the shorter recovery plan.
            return composeComebackSession({
              profileId: settings.profileId,
              day,
              now,
              level,
              path,
              lessons: [...LESSONS, ...customLessons],
              scenarios: SCENARIOS,
              progress,
              attempts: attempts.map(dailyPronunciationEvidence),
              pathLessonIds,
              recentMinutes: estimatedRecentMinutes(quests),
              lastActiveDay: stats.lastActiveDay,
            });
          },
          save: saveDailySession,
          publish: (persisted) => {
            if (active) publish(persisted);
          },
        });
        if (
          active &&
          loaded?.startedAt !== null &&
          loaded?.completedAt === null
        ) {
          trackDailySession("resume", loaded);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [day, publish]);

  const start = useCallback(async (): Promise<DailySession | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    if (current.completedAt !== null) return current;
    if (current.startedAt !== null) {
      trackDailySession("resume", current);
      return current;
    }

    const at = Date.now();
    const currentId =
      current.currentActivityId ??
      current.activities.find((entry) => entry.status === "pending")?.id ??
      null;
    const started: DailySession = {
      ...current,
      currentActivityId: currentId,
      activities: current.activities.map((entry) =>
        entry.id === currentId && entry.status === "pending"
          ? { ...entry, status: "active" as const }
          : entry,
      ),
      startedAt: at,
      updatedAt: Math.max(current.updatedAt, at),
    };
    const persisted = await saveDailySession(started);
    publish(persisted);
    trackDailySession("start", persisted);
    return persisted;
  }, [publish]);

  const checkpoint = useCallback(
    async (
      activityId: string,
      status: CheckpointStatus,
    ): Promise<DailySession> => {
      const persisted = await checkpointActivity({
        day,
        activityId,
        status,
        at: Date.now(),
      });
      publish(persisted);
      const activity = persisted.activities.find(
        (entry) => entry.id === activityId,
      );
      trackDailySession("checkpoint", persisted, activity);
      return persisted;
    },
    [day, publish],
  );

  const claimCompletion = useCallback(() => {
    if (claimRef.current) return claimRef.current;
    const claim = (async (): Promise<SessionCompletionResult | null> => {
      const result = await claimSessionCompletion({
        day,
        today: dayKey(),
      });
      if (!result) return null;
      publish(result.session);
      if (result.reward.xp > 0 || result.reward.stars > 0) {
        trackDailySession("complete", result.session);
      }
      return result;
    })();
    claimRef.current = claim;
    const clearClaim = () => {
      if (claimRef.current === claim) claimRef.current = null;
    };
    void claim.then(clearClaim, clearClaim);
    return claim;
  }, [day, publish]);

  const checkpointPronunciation = useCallback(async (activityId: string, state: DailyPronunciationGameState, binding: PracticePersistenceBinding) => {
    const persisted = await checkpointPronunciationGame(binding, {
      day,
      activityId,
      contentHash: state.contentHash,
      state,
      at: Date.now(),
    });
    publish(persisted);
    const activity = persisted.activities.find((entry) => entry.id === activityId);
    if (state.terminal) trackDailySession("checkpoint", persisted, activity);
    return persisted;
  }, [day, publish]);

  return { session, loading, start, checkpoint, checkpointPronunciation, claimCompletion };
}
