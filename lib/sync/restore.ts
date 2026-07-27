import { db } from "@/lib/db/dexie";
import type { Settings } from "@/lib/db/types";
import { getProfile, pullProfileData, pullSettings, pullExamsAndCalls, pullTalkSessions, pullConvItemsAndQuests, type Profile } from "./supabase-sync";

// "Logging in" on a new device: the sync code is the account. Pull everything
// the cloud has for that profile and seed the local Dexie stores with it, so
// she picks up exactly where she left off.

export interface RestoreSummary {
  profile: Profile;
  attempts: number;
  progress: number;
  hasPlayer: boolean;
}

/**
 * Pull her stage-exam sittings, call runs and talk sessions into the local cache.
 *
 * Additive by design: a row is inserted only when this device has no sitting for
 * that day (or no call at that timestamp), so a cloud pull can never erase local
 * history that has not been mirrored yet. Called from both restore and hydrate,
 * because an earned band must reappear on a new device without any extra step.
 */
async function seedEarnedHistory(profileId: string): Promise<void> {
  const [remote, talks, extras] = await Promise.all([
    pullExamsAndCalls(profileId),
    pullTalkSessions(profileId),
    pullConvItemsAndQuests(profileId),
  ]);
  // Mined conversation phrases are assigned homework, so a fresh device must get
  // them back or she silently loses work. Quests come along so today's progress
  // does not reset when she switches device mid-day.
  if (extras) {
    await db.transaction("rw", [db.convItems, db.quests], async () => {
      for (const c of extras.convItems) {
        if (!(await db.convItems.get(c.id))) await db.convItems.put(c);
      }
      for (const q of extras.quests) {
        const local = await db.quests.get(q.day);
        if (!local) await db.quests.put(q);
      }
    });
  }
  if (talks?.length) {
    await db.transaction("rw", [db.talkSessions], async () => {
      const localAt = new Set((await db.talkSessions.toArray()).map((t) => t.at));
      for (const t of talks) if (!localAt.has(t.at)) await db.talkSessions.add(t);
    });
  }
  if (!remote) return;
  await db.transaction("rw", [db.examAttempts, db.callScores], async () => {
    const localDays = new Set((await db.examAttempts.toArray()).map((e) => e.day));
    for (const e of remote.exams) {
      if (!localDays.has(e.day)) await db.examAttempts.add(e);
    }
    const localCallTimes = new Set((await db.callScores.toArray()).map((c) => c.at));
    for (const c of remote.calls) {
      if (!localCallTimes.has(c.at)) await db.callScores.add(c);
    }
  });
}

export async function restoreProfile(profileId: string): Promise<RestoreSummary | null> {
  const id = profileId.trim().toLowerCase();
  if (!id) return null;
  const profile = await getProfile(id);
  if (!profile) return null;
  const data = await pullProfileData(id);
  if (!data) return null;
  await seedEarnedHistory(id).catch(() => {});

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
  await seedEarnedHistory(id).catch(() => {});

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
    // Identity + placement restore: what keeps a returning learner from being
    // re-onboarded as brand new on a fresh device/origin.
    if (cloudSettings.studentName) settingsPatch.studentName = cloudSettings.studentName;
    if (cloudSettings.onboarding) settingsPatch.onboarding = cloudSettings.onboarding;
    // Preferences, so the app feels like hers on any device she signs into.
    if (cloudSettings.coachLanguage) settingsPatch.coachLanguage = cloudSettings.coachLanguage;
    if (cloudSettings.difficulty) settingsPatch.difficulty = cloudSettings.difficulty;
    if (cloudSettings.soundEnabled != null) settingsPatch.soundEnabled = cloudSettings.soundEnabled;
    if (cloudSettings.instructorMode != null) settingsPatch.instructorMode = cloudSettings.instructorMode;
  }
  return { settingsPatch };
}
