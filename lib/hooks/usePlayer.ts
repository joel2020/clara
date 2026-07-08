"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/dexie";
import { DEFAULT_PLAYER } from "@/lib/db/repository";
import type { PlayerStats } from "@/lib/db/types";

// Reactive player progression (XP, streak, achievements) for the UI.

export function usePlayer(): PlayerStats | undefined {
  return useLiveQuery(() => {
    if (typeof window === "undefined" || !db) return undefined as unknown as Promise<PlayerStats>;
    // Merge defaults so fields added in later versions are always present in the
    // UI, even for a player row saved before those fields existed.
    return db.player.get("player").then((p) => ({ ...DEFAULT_PLAYER, ...(p ?? {}) }));
  }, []);
}
