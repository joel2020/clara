"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { repo } from "@/lib/db";
import { dayKey } from "@/lib/gamification";
import { emptyQuests } from "@/lib/quests";
import type { Attempt, CategoryStat, ConvItem, DailyQuestState, ItemProgress } from "@/lib/db/types";

// Reactive read hooks. These wrap Dexie's live queries so any write updates the
// UI instantly. This is the one layer (besides lib/db) that's backend-aware —
// when moving to Supabase, these get reimplemented with realtime/polling, but
// the components calling them don't change.

// Named as a hook because it calls one. It was `clientQuery`, which tripped
// rules-of-hooks: a function that calls useLiveQuery must follow hook rules, and the
// linter can only enforce that if the name says so.
function useClientQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  return useLiveQuery(() => {
    if (typeof window === "undefined" || !db) return undefined as unknown as Promise<T>;
    return fn();
  }, deps);
}

export function useAllProgress(): ItemProgress[] | undefined {
  return useClientQuery(() => db.progress.toArray());
}

export function useProgressMap(): Map<string, ItemProgress> | undefined {
  const all = useAllProgress();
  if (!all) return undefined;
  return new Map(all.map((p) => [p.itemId, p]));
}

export function useCategoryStats(): CategoryStat[] | undefined {
  // Recompute whenever attempts or progress change.
  return useClientQuery(async () => {
    await db.attempts.count();
    await db.progress.count();
    return repo.getCategoryStats();
  });
}

export function useRecentAttempts(limit = 25): Attempt[] | undefined {
  return useClientQuery(() => db.attempts.orderBy("at").reverse().limit(limit).toArray(), [limit]);
}

export function useAllAttempts(): Attempt[] | undefined {
  return useClientQuery(() => db.attempts.orderBy("at").toArray());
}

export function useConvItems(): ConvItem[] | undefined {
  return useClientQuery(() => db.convItems.toArray());
}

export function useTodayQuests(): DailyQuestState | undefined {
  return useClientQuery(async () => {
    const day = dayKey();
    return (await db.quests.get(day)) ?? emptyQuests(day);
  });
}

export function useItemAttempts(itemId: string, limit = 10): Attempt[] | undefined {
  return useClientQuery(
    () => db.attempts.where("itemId").equals(itemId).reverse().sortBy("at").then((r) => r.slice(0, limit)),
    [itemId, limit],
  );
}
