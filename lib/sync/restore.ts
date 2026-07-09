import { db } from "@/lib/db/dexie";
import { getProfile, pullProfileData, type Profile } from "./supabase-sync";

// "Logging in" on a new device: the sync code is the account. Pull everything
// the cloud has for that profile and seed the local Dexie stores with it, so
// she picks up exactly where she left off.

export interface RestoreSummary {
  profile: Profile;
  attempts: number;
  progress: number;
  hasPlayer: boolean;
}

export async function restoreProfile(profileId: string): Promise<RestoreSummary | null> {
  const id = profileId.trim().toLowerCase();
  if (!id) return null;
  const profile = await getProfile(id);
  if (!profile) return null;
  const data = await pullProfileData(id);
  if (!data) return null;

  await db.transaction("rw", [db.attempts, db.progress, db.player], async () => {
    if (data.attempts.length) await db.attempts.bulkAdd(data.attempts);
    if (data.progress.length) await db.progress.bulkPut(data.progress);
    if (data.player) await db.player.put(data.player);
  });

  return {
    profile,
    attempts: data.attempts.length,
    progress: data.progress.length,
    hasPlayer: Boolean(data.player),
  };
}
