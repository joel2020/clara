"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { repo } from "@/lib/db";
import type { Attempt, CategoryStat, ItemProgress } from "@/lib/db/types";

// Reactive read hooks. These wrap Dexie's live queries so any write updates the
// UI instantly. This is the one layer (besides lib/db) that's backend-aware —
// when moving to Supabase, these get reimplemented with realtime/polling, but
// the components calling them don't change.

function clientQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  return useLiveQuery(() => {
    if (typeof window === "undefined" || !db) return undefined as unknown as Promise<T>;
    return fn();
  }, deps);
}

export function useAllProgress(): ItemProgress[] | undefined {
  return clientQuery(() => db.progress.toArray());
}

export function useProgressMap(): Map<string, ItemProgress> | undefined {
  const all = useAllProgress();
  if (!all) return undefined;
  return new Map(all.map((p) => [p.itemId, p]));
}

export function useCategoryStats(): CategoryStat[] | undefined {
  // Recompute whenever attempts or progress change.
  return clientQuery(async () => {
    await db.attempts.count();
    await db.progress.count();
    return repo.getCategoryStats();
  });
}

export function useRecentAttempts(limit = 25): Attempt[] | undefined {
  return clientQuery(() => db.attempts.orderBy("at").reverse().limit(limit).toArray(), [limit]);
}

export function useAllAttempts(): Attempt[] | undefined {
  return clientQuery(() => db.attempts.orderBy("at").toArray());
}

export function useItemAttempts(itemId: string, limit = 10): Attempt[] | undefined {
  return clientQuery(
    () => db.attempts.where("itemId").equals(itemId).reverse().sortBy("at").then((r) => r.slice(0, limit)),
    [itemId, limit],
  );
}
