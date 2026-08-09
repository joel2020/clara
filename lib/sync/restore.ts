import { captureDbBinding, db, isDbBindingCurrent, type DbBinding } from "@/lib/db/dexie";
import type { Settings } from "@/lib/db/types";
import { mergeAttemptHistory } from "@/lib/db/repository";
import {
  getProfile,
  pullConvItemsAndQuests,
  pullCustomLessons,
  pullExamsAndCalls,
  pullPlayerAndProgress,
  pullProfileData,
  pullSettings,
  pullTalkSessions,
  type Profile,
} from "./supabase-sync";

// "Logging in" on a new device: the sync code is the account. Pull everything
// the cloud has for that profile and seed the local Dexie stores with it, so
// she picks up exactly where she left off.

export interface RestoreSummary {
  profile: Profile;
  attempts: number;
  progress: number;
  hasPlayer: boolean;
}

export interface CloudRestoreSource {
  getProfile: typeof getProfile;
  pullProfileData: typeof pullProfileData;
  pullPlayerAndProgress: typeof pullPlayerAndProgress;
  pullSettings: typeof pullSettings;
  pullExamsAndCalls: typeof pullExamsAndCalls;
  pullTalkSessions: typeof pullTalkSessions;
  pullConvItemsAndQuests: typeof pullConvItemsAndQuests;
  pullCustomLessons: typeof pullCustomLessons;
}

const cloudRestoreSource: CloudRestoreSource = {
  getProfile,
  pullProfileData,
  pullPlayerAndProgress,
  pullSettings,
  pullExamsAndCalls,
  pullTalkSessions,
  pullConvItemsAndQuests,
  pullCustomLessons,
};

class StaleDbBindingError extends Error {}

function bindingFor(profileId: string): DbBinding | null {
  const binding = captureDbBinding();
  // Authenticated databases must match exactly. The legacy/local database may
  // still restore its remembered sync code; generation checks keep that safe if
  // authentication binds a real account while the request is in flight.
  return binding
    && (binding.accountId === null || binding.accountId === profileId)
    && isDbBindingCurrent(binding)
    ? binding
    : null;
}

function requireCurrent(binding: DbBinding): void {
  if (!isDbBindingCurrent(binding)) throw new StaleDbBindingError();
}

/**
 * Pull her earned-history stores into the concrete account database captured at
 * request start. Every awaited boundary is followed by a generation check so a
 * late response for A can never be redirected through the active-db proxy to B.
 */
async function seedEarnedHistory(
  profileId: string,
  binding: DbBinding,
  source: CloudRestoreSource,
): Promise<boolean> {
  const target = binding.database;
  const [remote, talks, extras, customLessons] = await Promise.all([
    source.pullExamsAndCalls(profileId),
    source.pullTalkSessions(profileId),
    source.pullConvItemsAndQuests(profileId),
    source.pullCustomLessons(),
  ]);
  if (!isDbBindingCurrent(binding)) return false;

  // Shared instructor lessons are additive: cloud copy upserts, local-only work
  // is never deleted by a pull.
  if (customLessons?.length) {
    await target.transaction("rw", [target.customLessons], async () => {
      for (const lesson of customLessons) {
        requireCurrent(binding);
        await target.customLessons.put(lesson);
      }
    });
  }

  if (extras) {
    requireCurrent(binding);
    await target.transaction("rw", [target.convItems, target.quests], async () => {
      for (const item of extras.convItems) {
        const existing = await target.convItems.get(item.id);
        requireCurrent(binding);
        if (!existing) await target.convItems.put(item);
      }
      for (const quest of extras.quests) {
        const existing = await target.quests.get(quest.day);
        requireCurrent(binding);
        if (!existing) await target.quests.put(quest);
      }
    });
  }

  if (talks?.length) {
    requireCurrent(binding);
    await target.transaction("rw", [target.talkSessions], async () => {
      const localAt = new Set((await target.talkSessions.toArray()).map((talk) => talk.at));
      requireCurrent(binding);
      for (const talk of talks) {
        requireCurrent(binding);
        if (!localAt.has(talk.at)) await target.talkSessions.add(talk);
      }
    });
  }

  if (!remote) return isDbBindingCurrent(binding);
  requireCurrent(binding);
  await target.transaction("rw", [target.examAttempts, target.callScores], async () => {
    const localDays = new Set((await target.examAttempts.toArray()).map((exam) => exam.day));
    requireCurrent(binding);
    for (const exam of remote.exams) {
      requireCurrent(binding);
      if (!localDays.has(exam.day)) await target.examAttempts.add(exam);
    }

    const localCallTimes = new Set((await target.callScores.toArray()).map((call) => call.at));
    requireCurrent(binding);
    for (const call of remote.calls) {
      requireCurrent(binding);
      if (!localCallTimes.has(call.at)) await target.callScores.add(call);
    }
  });
  return isDbBindingCurrent(binding);
}

/** Is the currently bound local database effectively new? */
export async function isFreshLocalData(): Promise<boolean> {
  const [attempts, progress] = await Promise.all([db.attempts.count(), db.progress.count()]);
  return attempts === 0 && progress === 0;
}

export async function restoreProfile(
  profileId: string,
  source: CloudRestoreSource = cloudRestoreSource,
): Promise<RestoreSummary | null> {
  const id = profileId.trim().toLowerCase();
  if (!id) return null;
  const binding = bindingFor(id);
  if (!binding) return null;
  const target = binding.database;

  const profile = await source.getProfile(id);
  if (!isDbBindingCurrent(binding) || !profile) return null;
  const data = await source.pullProfileData(id);
  if (!isDbBindingCurrent(binding) || !data) return null;

  try {
    if (!(await seedEarnedHistory(id, binding, source))) return null;
  } catch (error) {
    // Earned-history restore remains best effort while the main profile restore
    // proceeds. A generation change is different: all subsequent work aborts.
    if (error instanceof StaleDbBindingError || !isDbBindingCurrent(binding)) return null;
  }
  if (!isDbBindingCurrent(binding)) return null;

  try {
    await target.transaction("rw", [target.attempts, target.progress, target.player], async () => {
      if (data.attempts.length) {
        const fresh = mergeAttemptHistory(await target.attempts.toArray(), data.attempts);
        requireCurrent(binding);
        if (fresh.length) await target.attempts.bulkAdd(fresh);
      }
      requireCurrent(binding);
      if (data.progress.length) await target.progress.bulkPut(data.progress);
      requireCurrent(binding);
      if (data.player) await target.player.put(data.player);
    });
  } catch (error) {
    if (error instanceof StaleDbBindingError || !isDbBindingCurrent(binding)) return null;
    throw error;
  }
  if (!isDbBindingCurrent(binding)) return null;

  return {
    profile,
    attempts: data.attempts.length,
    progress: data.progress.length,
    hasPlayer: Boolean(data.player),
  };
}

// Cloud-authoritative refresh for a device that already has this profile. The
// local database stays a fast offline cache; strictly newer local progress wins
// so unsynced practice is not overwritten.
export async function hydrateFromCloud(
  profileId: string,
  source: CloudRestoreSource = cloudRestoreSource,
): Promise<{ settingsPatch: Partial<Settings> } | null> {
  const id = profileId.trim().toLowerCase();
  if (!id) return null;
  const binding = bindingFor(id);
  if (!binding) return null;
  const target = binding.database;

  const [data, cloudSettings] = await Promise.all([
    source.pullPlayerAndProgress(id),
    source.pullSettings(id),
  ]);
  if (!isDbBindingCurrent(binding) || !data) return null;

  try {
    if (!(await seedEarnedHistory(id, binding, source))) return null;
  } catch (error) {
    if (error instanceof StaleDbBindingError || !isDbBindingCurrent(binding)) return null;
  }
  if (!isDbBindingCurrent(binding)) return null;

  try {
    await target.transaction("rw", [target.progress, target.player], async () => {
      if (data.player) {
        const local = await target.player.get("player");
        requireCurrent(binding);
        if (!local || (local.updatedAt ?? 0) <= (data.player.updatedAt ?? 0)) {
          await target.player.put(data.player);
        }
      }

      requireCurrent(binding);
      if (data.progress.length) {
        const locals = new Map((await target.progress.toArray()).map((item) => [item.itemId, item]));
        requireCurrent(binding);
        const toPut = data.progress.filter((cloud) => {
          const local = locals.get(cloud.itemId);
          return !local || (local.updatedAt ?? 0) <= (cloud.updatedAt ?? 0);
        });
        if (toPut.length) await target.progress.bulkPut(toPut);
      }
    });
  } catch (error) {
    if (error instanceof StaleDbBindingError || !isDbBindingCurrent(binding)) return null;
    throw error;
  }
  if (!isDbBindingCurrent(binding)) return null;

  const settingsPatch: Partial<Settings> = {};
  if (cloudSettings) {
    if (cloudSettings.dailyGoal != null) settingsPatch.dailyGoal = cloudSettings.dailyGoal;
    if (cloudSettings.speechRate != null) settingsPatch.speechRate = cloudSettings.speechRate;
    if (cloudSettings.voiceURI !== undefined) settingsPatch.voiceURI = cloudSettings.voiceURI ?? undefined;
    if (cloudSettings.recognitionLang != null) settingsPatch.recognitionLang = cloudSettings.recognitionLang;
    if (cloudSettings.studentName) settingsPatch.studentName = cloudSettings.studentName;
    if (cloudSettings.onboarding) settingsPatch.onboarding = cloudSettings.onboarding;
    if (cloudSettings.coachLanguage) settingsPatch.coachLanguage = cloudSettings.coachLanguage;
    if (cloudSettings.difficulty) settingsPatch.difficulty = cloudSettings.difficulty;
    if (cloudSettings.soundEnabled != null) settingsPatch.soundEnabled = cloudSettings.soundEnabled;
    if (cloudSettings.instructorMode != null) settingsPatch.instructorMode = cloudSettings.instructorMode;
    if (cloudSettings.voiceConsent !== undefined) settingsPatch.voiceConsent = cloudSettings.voiceConsent;
  }
  return { settingsPatch };
}
