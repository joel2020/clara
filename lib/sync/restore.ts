import { db } from "@/lib/db/dexie";
import type { Settings } from "@/lib/db/types";
import { getProfile, pullProfileData, pullSettings, type Profile } from "./supabase-sync";

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

// Cloud-authoritative refresh for a device that already has this profile locally.
// Supabase is the source of truth; the phone's IndexedDB is a fast cache that we
// re-seed from the cloud on every launch. This is what makes her stars, streak,
// and progress survive iOS evicting local storage, and lets a change made in the
// cloud (e.g. an awarded star balance) appear without a manual "restore".
//
// Reconciliation policy:
//   • Player economy/progression and per-item SRS progress — cloud wins unless
//     the local copy is strictly newer (a `updatedAt` tiebreak). That only
//     happens for practice done offline since the last push; that local work is
//     preserved and syncs up on her next write. Cloud wins on ties, so an edit
//     made directly in Supabase (with a fresh `updated_at`) always takes.
// Attempt history isn't re-pulled here (it's append-only and already mirrored) to
// avoid duplicating rows on every launch.
//
// Throws if the cloud is unreachable — the caller treats that as "stay on the
// local cache" so the app still works offline.
export async function hydrateFromCloud(profileId: string): Promise<{ settingsPatch: Partial<Settings> } | null> {
  const id = profileId.trim().toLowerCase();
  if (!id) return null;
  const [data, cloudSettings] = await Promise.all([pullProfileData(id), pullSettings(id)]);
  if (!data) return null; // sync disabled — nothing to do

  await db.transaction("rw", [db.progress, db.player], async () => {
    if (data.player) {
      const local = await db.player.get("player");
      if (!local || (local.updatedAt ?? 0) <= (data.player.updatedAt ?? 0)) {
        await db.player.put(data.player);
      }
    }
    if (data.progress.length) {
      const locals = new Map((await db.progress.toArray()).map((p) => [p.itemId, p]));
      const toPut = data.progress.filter((c) => {
        const l = locals.get(c.itemId);
        return !l || (l.updatedAt ?? 0) <= (c.updatedAt ?? 0);
      });
      if (toPut.length) await db.progress.bulkPut(toPut);
    }
  });

  const settingsPatch: Partial<Settings> = {};
  if (cloudSettings) {
    if (cloudSettings.dailyGoal != null) settingsPatch.dailyGoal = cloudSettings.dailyGoal;
    if (cloudSettings.speechRate != null) settingsPatch.speechRate = cloudSettings.speechRate;
    if (cloudSettings.voiceURI !== undefined) settingsPatch.voiceURI = cloudSettings.voiceURI ?? undefined;
    if (cloudSettings.recognitionLang != null) settingsPatch.recognitionLang = cloudSettings.recognitionLang;
  }
  return { settingsPatch };
}
