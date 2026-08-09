import { boundAccountId, captureDbBinding, db, isDbBindingCurrent, type DbBinding } from "./dexie.ts";
import { applyTranscriptRetention, attemptOutboxPayload, DEFAULT_PLAYER, DEFAULT_SETTINGS, examCompletionOutboxPayload, examPromotionIsCanonical, failedExamOutboxPayload, playerOutboxPayload, progressOutboxPayload, questOutboxPayload, sanitizeAttempt, sanitizeNewAttempt, settingsSyncPayload, StaleExamLevelError, StalePracticeBindingError, type DataRepository, type PracticeAttemptCommitResult, type PracticeAttemptMutation, type PracticePersistenceBinding } from "./repository.ts";
import { dailyPronunciationChoiceIds, isAuthoredDailyPronunciationActivity, migrateLegacyDailyPronunciationActivity, type DailySession } from "../daily-session.ts";
import { mergeDailySessions } from "../daily-session-merge.ts";
import {
  applySessionCompletion,
  type SessionCompletionResult,
} from "../daily-session-reward.ts";
import type { DailySessionCompletionClaim } from "./repository.ts";
import type {
  Attempt,
  CallScore,
  CategoryStat,
  ConvItem,
  DailyQuestState,
  ExamAttempt,
  ExamCheckpoint,
  ExamCheckpointCas,
  ExamCheckpointIdentity,
  ExamCompletionPayload,
  ItemProgress,
  Lesson,
  PhraseRecording,
  PlayerStats,
  OutboxRow,
  Settings,
  TalkSession,
  VirtualCallRecord,
} from "./types";
import { applyResult, freshProgress } from "../srs.ts";
import { applyAttempt, dayKey, levelForXp, type AttemptRewards } from "../gamification.ts";
import { applyQuestEvent, emptyQuestState } from "../quest-rules.ts";
import {
  applyBoundPronunciationCheckpoint,
  applyDailyPronunciationAttempt,
  type BoundPronunciationCheckpoint,
} from "../daily-pronunciation-mutation.ts";
import { createDailyPronunciationGameState, dailyPronunciationContentHash, dailyPronunciationLegacyContentHash, isDailyPronunciationGameState } from "../speech/daily-pronunciation-game.ts";
import { ExamCheckpointConflictError, sameExamCheckpointIdentity, sanitizeExamCheckpoint } from "../exam-checkpoint.ts";
import { applyPassedCallMilestone } from "../milestone.ts";

const RECENT_WINDOW = 20; // attempts per category counted as "recent"

/**
 * IndexedDB-backed implementation of DataRepository (via Dexie). This is the
 * local-first default. A SupabaseRepository implementing the same interface can
 * replace it without touching any component.
 */
export class DexieRepository implements DataRepository {
  async recordAttempt(attempt: Omit<Attempt, "id">): Promise<void> {
    const safe = sanitizeNewAttempt(attempt);
    if (!safe) throw new TypeError("Invalid attempt persistence record");
    await db.attempts.add(safe);
  }

  capturePracticeBinding(): PracticePersistenceBinding | null {
    return captureDbBinding() as PracticePersistenceBinding | null;
  }

  async getAttemptsForPracticeBinding(
    bindingToken: PracticePersistenceBinding,
    opts: { itemId?: string; categoryId?: string; limit?: number; since?: number } = {},
  ): Promise<Attempt[]> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const table = binding.database.attempts;
    let rows: Attempt[];
    if (opts.itemId || opts.categoryId) {
      rows = opts.itemId
        ? await table.where("itemId").equals(opts.itemId).toArray()
        : await table.where("categoryId").equals(opts.categoryId!).toArray();
      if (opts.itemId && opts.categoryId) rows = rows.filter((attempt) => attempt.categoryId === opts.categoryId);
      if (opts.since) rows = rows.filter((attempt) => attempt.at >= opts.since!);
      rows.sort((a, b) => b.at - a.at);
      if (opts.limit) rows = rows.slice(0, opts.limit);
    } else {
      const collection = opts.since
        ? table.where("at").aboveOrEqual(opts.since).reverse()
        : table.orderBy("at").reverse();
      rows = await (opts.limit ? collection.limit(opts.limit) : collection).toArray();
    }
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    return rows.map(sanitizeAttempt).filter((attempt): attempt is Attempt => attempt !== null);
  }

  async commitPracticeAttempt(bindingToken: PracticePersistenceBinding, mutation: PracticeAttemptMutation): Promise<PracticeAttemptCommitResult> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const safe = sanitizeNewAttempt(mutation.attempt);
    if (!safe?.clientAttemptId) throw new TypeError("Invalid attempt persistence record");
    const clientAttemptId = safe.clientAttemptId;
    if (mutation.dailyPronunciation && mutation.dailyPronunciation.event.id !== clientAttemptId) {
      throw new TypeError("Pronunciation event UUID must match its attempt UUID");
    }
    const concrete = binding.database;

    const result = await concrete.transaction(
      "rw",
      [concrete.attempts, concrete.settings, concrete.progress, concrete.player, concrete.quests, concrete.dailySessions, concrete.outbox],
      async (): Promise<PracticeAttemptCommitResult> => {
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const existing = await concrete.attempts.where("clientAttemptId").equals(clientAttemptId).first();
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();

      const storedSettings = await concrete.settings.get("app");
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const settings = { ...DEFAULT_SETTINGS, ...storedSettings };
      const owner = (binding.accountId ?? settings.profileId)?.trim().toLowerCase() || null;
      let nextDaily: DailySession | undefined;
      let dailyEventAlreadyPresent = false;
      if (mutation.dailyPronunciation) {
        const currentDaily = await concrete.dailySessions.where("day").equals(mutation.dailyPronunciation.day).first();
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
        if (!currentDaily) throw new Error("Daily pronunciation session is unavailable");
        if (!owner || currentDaily.profileId.trim().toLowerCase() !== owner) {
          throw new StalePracticeBindingError();
        }
        dailyEventAlreadyPresent = Boolean(
          currentDaily.activities
            .find((activity) => activity.id === mutation.dailyPronunciation!.activityId)
            ?.pronunciation?.state?.attemptEvents
            .some((event) => event.id === clientAttemptId),
        );
        nextDaily = applyDailyPronunciationAttempt(currentDaily, mutation.dailyPronunciation);
      }
      if (existing && !nextDaily) return { status: "already-committed", outboxIds: [] };

      // A network/UI retry may arrive after the attempt row committed but before
      // the caller observed success. The event union is idempotent, so applying
      // the same UUID repairs a missing session event without duplicating credit.
      if (existing && dailyEventAlreadyPresent) {
        return { status: "already-committed", outboxIds: [], dailySession: nextDaily };
      }
      const previousProgress = mutation.progress
        ? await concrete.progress.get(safe.itemId)
        : undefined;
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const previousPlayer = mutation.reward
        ? { ...DEFAULT_PLAYER, ...(await concrete.player.get("player")) }
        : undefined;
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();

      const nextProgress = mutation.progress
        ? applyResult(
            previousProgress ?? freshProgress({
              itemId: safe.itemId,
              lessonId: safe.lessonId,
              categoryId: safe.categoryId,
              phoneme: safe.phoneme,
            }, safe.at),
            mutation.progress.passed,
            mutation.progress.score,
            safe.at,
          )
        : undefined;
      if (nextProgress && mutation.progress?.dueInMs !== undefined) {
        nextProgress.dueAt = safe.at + mutation.progress.dueInMs;
      }

      let nextPlayer: PlayerStats | undefined;
      let rewards: AttemptRewards | undefined;
      if (previousPlayer && mutation.reward) {
        const applied = applyAttempt(previousPlayer, {
          passed: mutation.reward.passed,
          combo: mutation.reward.combo,
          dailyGoal: settings.dailyGoal,
          score: mutation.reward.score,
          now: new Date(safe.at),
        });
        if (mutation.reward.xpAward !== undefined) {
          const xpDelta = mutation.reward.xpAward - applied.rewards.xpGain;
          applied.stats.xp += xpDelta;
          applied.stats.todayXp += xpDelta;
          const oldLevel = levelForXp(previousPlayer.xp);
          const newLevel = levelForXp(applied.stats.xp);
          applied.rewards = {
            ...applied.rewards,
            xpGain: mutation.reward.xpAward,
            newXp: applied.stats.xp,
            oldLevel,
            newLevel,
            leveledUp: newLevel > oldLevel,
          };
        }
        if (mutation.reward.masteryStars !== undefined) {
          const starDelta = mutation.reward.masteryStars - applied.rewards.starsEarned;
          applied.stats.stars = (applied.stats.stars ?? 0) + starDelta;
          applied.rewards = {
            ...applied.rewards,
            starsEarned: mutation.reward.masteryStars,
            starTotal: applied.stats.stars,
          };
        }
        nextPlayer = applied.stats;
        rewards = applied.rewards;
      }

      let nextQuest: DailyQuestState | undefined;
      if (mutation.quest) {
        const day = dayKey(new Date(safe.at));
        const quest = (await concrete.quests.get(day)) ?? emptyQuestState(day);
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
        const applied = applyQuestEvent(quest, previousProgress ? "review" : "learn");
        nextQuest = applied.state;
        if (applied.bonusXp && nextPlayer) {
          nextPlayer = {
            ...nextPlayer,
            xp: nextPlayer.xp + applied.bonusXp,
            todayXp: nextPlayer.todayXp + applied.bonusXp,
          };
        }
      }

      if (!existing) await concrete.attempts.add(safe);
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (!existing && nextProgress) await concrete.progress.put(nextProgress);
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (!existing && nextPlayer) await concrete.player.put({ ...nextPlayer, id: "player" });
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (!existing && nextQuest) await concrete.quests.put(nextQuest);
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (nextDaily) await concrete.dailySessions.put(nextDaily);
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const outboxIds: number[] = [];
      if (owner) {
        const queued: Omit<OutboxRow, "id">[] = [];
        if (!existing) {
          const attemptPayload = attemptOutboxPayload(safe);
          if (!attemptPayload) throw new TypeError("Invalid attempt retry payload");
          queued.push({ kind: "attempt", profileId: owner, payload: attemptPayload, at: safe.at, tries: 0 });
        }
        if (!existing && nextProgress) {
          const payload = progressOutboxPayload(nextProgress);
          if (!payload) throw new TypeError("Invalid progress retry payload");
          queued.push({ kind: "progress", profileId: owner, payload, at: safe.at, tries: 0 });
        }
        if (!existing && nextPlayer) {
          const payload = playerOutboxPayload(nextPlayer);
          if (!payload) throw new TypeError("Invalid player retry payload");
          queued.push({ kind: "player", profileId: owner, payload, at: safe.at, tries: 0 });
        }
        if (!existing && nextQuest) {
          const payload = questOutboxPayload(nextQuest);
          if (!payload) throw new TypeError("Invalid quest retry payload");
          queued.push({ kind: "quest", profileId: owner, payload, at: safe.at, tries: 0 });
        }
        if (nextDaily) queued.push({ kind: "daily-session", profileId: owner, payload: nextDaily, at: mutation.dailyPronunciation?.at ?? safe.at, tries: 0 });
        if (queued.length) outboxIds.push(...await concrete.outbox.bulkAdd(queued, { allKeys: true }) as number[]);
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      }
      if (existing) return { status: "already-committed", outboxIds, dailySession: nextDaily };
      return {
        status: "committed",
        rewards: rewards ?? {
          xpGain: 0, newXp: nextPlayer?.xp ?? 0, leveledUp: false,
          oldLevel: levelForXp(nextPlayer?.xp ?? 0), newLevel: levelForXp(nextPlayer?.xp ?? 0),
          combo: 0, starsEarned: 0, starTotal: nextPlayer?.stars ?? 0,
          streakIncreased: false, currentStreak: nextPlayer?.currentStreak ?? 0,
          freezeUsed: false, freezeEarned: false, dailyGoalMet: false, unlocked: [],
        },
        outboxIds,
        dailySession: nextDaily,
      };
    });
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    return result;
  }

  async checkpointDailyPronunciation(
    bindingToken: PracticePersistenceBinding,
    checkpoint: BoundPronunciationCheckpoint,
  ): Promise<DailySession> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const concrete = binding.database;
    const result = await concrete.transaction(
      "rw",
      [concrete.dailySessions, concrete.settings, concrete.outbox],
      async () => {
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
        const storedSettings = await concrete.settings.get("app");
        const owner = (binding.accountId ?? storedSettings?.profileId)?.trim().toLowerCase() || null;
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
        const current = await concrete.dailySessions.where("day").equals(checkpoint.day).first();
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
        if (!current) throw new Error("Daily pronunciation session is unavailable");
        if (!owner || current.profileId.trim().toLowerCase() !== owner) throw new StalePracticeBindingError();
        const next = applyBoundPronunciationCheckpoint(current, checkpoint);
        await concrete.dailySessions.put(next);
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
        await concrete.outbox.add({ kind: "daily-session", profileId: owner, payload: next, at: checkpoint.at, tries: 0 });
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
        return next;
      },
    );
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    return result;
  }

  async replaceCorruptDailyPronunciation(
    bindingToken: PracticePersistenceBinding,
    input: { day: string; activityId: string; at: number },
  ): Promise<DailySession> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const concrete = binding.database;
    const result = await concrete.transaction("rw", [concrete.dailySessions, concrete.settings, concrete.outbox], async () => {
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const settings = await concrete.settings.get("app");
      const owner = (binding.accountId ?? settings?.profileId)?.trim().toLowerCase() || null;
      const current = await concrete.dailySessions.where("day").equals(input.day).first();
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (!owner || !current || current.profileId.trim().toLowerCase() !== owner) throw new StalePracticeBindingError();
      const activity = current.activities.find((entry) => entry.id === input.activityId);
      if (!activity?.pronunciation) throw new Error("Unknown pronunciation activity");
      const pronunciation = activity.pronunciation;
      const shippedV1 = pronunciation.state === undefined && pronunciation.itemPool === undefined;
      const canonicalPronunciation = shippedV1 ? migrateLegacyDailyPronunciationActivity(pronunciation) : pronunciation;
      if (!canonicalPronunciation || !isAuthoredDailyPronunciationActivity(canonicalPronunciation)) {
        throw new Error("Canonical pronunciation activity is unavailable");
      }
      const expectedHashes = [
        dailyPronunciationContentHash(pronunciation.game, pronunciation.targets, pronunciation.itemPool),
        dailyPronunciationLegacyContentHash(pronunciation.game, pronunciation.targets),
      ];
      if (isDailyPronunciationGameState(pronunciation.state, expectedHashes, dailyPronunciationChoiceIds(pronunciation, pronunciation.state?.targetIndex ?? 0))) return current;
      const unsafe = pronunciation.state as unknown as Record<string, unknown> | undefined;
      const archivedVersion = unsafe?.version === 1 || unsafe?.version === 2 ? unsafe.version : null;
      const archivedHash = typeof unsafe?.contentHash === "string" && /^daily-pronunciation-v[23]:[0-9a-f]{8}$/.test(unsafe.contentHash)
        ? unsafe.contentHash : null;
      const replacement = shippedV1
        ? canonicalPronunciation.state!
        : createDailyPronunciationGameState(canonicalPronunciation.game, canonicalPronunciation.targets, canonicalPronunciation.itemPool);
      const activities = current.activities.map((entry) => entry.id !== input.activityId ? entry : {
        ...entry,
        status: "active" as const,
        completedAt: undefined,
        pronunciation: {
          ...canonicalPronunciation,
          state: replacement,
          ...(unsafe ? { recoveryArchive: [{ at: input.at, version: archivedVersion, contentHash: archivedHash }] } : {}),
        },
      });
      const next: DailySession = {
        ...current,
        version: 2,
        activities,
        currentActivityId: shippedV1 ? current.currentActivityId : input.activityId,
        completedAt: shippedV1 ? current.completedAt : null,
        updatedAt: Math.max(current.updatedAt, input.at),
      };
      await concrete.dailySessions.put(next);
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      await concrete.outbox.add({ kind: "daily-session", profileId: owner, payload: next, at: input.at, tries: 0 });
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      return next;
    });
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    return result;
  }

  async getAttempts(opts: {
    itemId?: string;
    categoryId?: string;
    limit?: number;
    since?: number;
  } = {}): Promise<Attempt[]> {
    // Use the indexes declared in dexie.ts — attempts grow with every rep, and
    // this runs on every practice attempt (the adaptive-ease window), so a
    // full-table scan here got slower for as long as a student kept practicing.
    //
    // The itemId/categoryId indexes narrow to one item/category (small sets), so
    // those are fetched whole, then sorted newest-first and sliced. Only the
    // unfiltered `at`-ordered path — the common `{limit}` call — can safely take
    // the limit at the index, since that index already IS the sort order.
    if (opts.itemId || opts.categoryId) {
      let rows = opts.itemId
        ? await db.attempts.where("itemId").equals(opts.itemId).toArray()
        : await db.attempts.where("categoryId").equals(opts.categoryId!).toArray();
      if (opts.itemId && opts.categoryId) rows = rows.filter((a) => a.categoryId === opts.categoryId);
      if (opts.since) rows = rows.filter((a) => a.at >= opts.since!);
      rows.sort((a, b) => b.at - a.at);
      const selected = opts.limit ? rows.slice(0, opts.limit) : rows;
      return selected.map(sanitizeAttempt).filter((attempt): attempt is Attempt => attempt !== null);
    }

    const coll = opts.since
      ? db.attempts.where("at").aboveOrEqual(opts.since).reverse()
      : db.attempts.orderBy("at").reverse();
    return (await (opts.limit ? coll.limit(opts.limit) : coll).toArray())
      .map(sanitizeAttempt)
      .filter((attempt): attempt is Attempt => attempt !== null);
  }

  async getProgress(itemId: string): Promise<ItemProgress | undefined> {
    return db.progress.get(itemId);
  }

  async getAllProgress(): Promise<ItemProgress[]> {
    return db.progress.toArray();
  }

  async saveProgress(progress: ItemProgress): Promise<void> {
    await db.progress.put(progress);
  }

  async getCustomLessons(): Promise<Lesson[]> {
    return db.customLessons.orderBy("order").toArray();
  }

  async saveCustomLesson(lesson: Lesson): Promise<void> {
    await db.customLessons.put(lesson);
    // pushCustomLesson existed but was never called, so instructor-authored lessons
    // were silently device-only — the same class of gap as conv_items.
    void this.mirror((_profileId, sync) => sync.pushCustomLesson(lesson));
  }

  async deleteCustomLesson(id: string): Promise<void> {
    await db.customLessons.delete(id);
    // Mirror the delete, or the next cloud pull resurrects the lesson.
    void this.mirror((_profileId, sync) => sync.deleteCustomLessonCloud(id));
  }

  async getSettings(): Promise<Settings> {
    const existing = await db.settings.get("app");
    // Merge so fields added in later versions get their defaults.
    if (existing) return { ...DEFAULT_SETTINGS, ...existing };
    await db.settings.put(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Settings): Promise<void> {
    await db.settings.put({ ...settings, id: "app" });
  }

  async saveSettingsForPracticeBinding(bindingToken: PracticePersistenceBinding, settings: Settings): Promise<void> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const payload = binding.accountId ? settingsSyncPayload(binding.accountId, settings) : null;
    if (binding.accountId && (!payload || settings.profileId !== binding.accountId)) throw new StalePracticeBindingError();
    await binding.database.transaction("rw", [binding.database.settings, binding.database.outbox], async () => {
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      await binding.database.settings.put({ ...settings, id: "app" });
      if (payload) {
        await binding.database.outbox.where("kind").equals("settings").and((row) => row.profileId === binding.accountId).delete();
        await binding.database.outbox.add({ kind: "settings", profileId: binding.accountId!, payload, at: Date.now(), tries: 0 });
      }
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    });
  }

  async getPlayerStats(): Promise<PlayerStats> {
    const existing = await db.player.get("player");
    if (existing) return { ...DEFAULT_PLAYER, ...existing };
    await db.player.put(DEFAULT_PLAYER);
    return DEFAULT_PLAYER;
  }

  async savePlayerStats(stats: PlayerStats): Promise<void> {
    await db.player.put({ ...stats, id: "player" });
    // Mirror to the cloud from the one place every star/cosmetic write funnels
    // through (shop, chest, game rounds) — not just lesson practice.
    void (async () => {
      const settings = await this.getSettings();
      if (!settings.profileId) return;
      const { pushPlayer } = await import("@/lib/sync/supabase-sync");
      pushPlayer(settings.profileId, stats);
    })().catch(() => {});
  }

  async getConvItems(): Promise<ConvItem[]> {
    return db.convItems.orderBy("createdAt").toArray();
  }

  async saveConvItem(item: ConvItem): Promise<void> {
    await db.convItems.put(item);
    void this.mirror((profileId, sync) => sync.pushConvItem(profileId, item));
  }

  async getExamAttempts(): Promise<ExamAttempt[]> {
    const rows = await db.examAttempts.toArray();
    return rows.sort((a, b) => b.at - a.at);
  }

  async getExamAttemptsForPracticeBinding(bindingToken: PracticePersistenceBinding): Promise<ExamAttempt[]> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const rows = await binding.database.examAttempts.toArray();
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    return rows.sort((a, b) => b.at - a.at);
  }

  async saveExamAttempt(attempt: Omit<ExamAttempt, "id">): Promise<void> {
    const binding = this.capturePracticeBinding();
    if (!binding) throw new StalePracticeBindingError();
    return this.saveExamAttemptForPracticeBinding(binding, attempt);
  }

  async saveExamAttemptForPracticeBinding(
    bindingToken: PracticePersistenceBinding,
    attempt: Omit<ExamAttempt, "id">,
    promotedOnboarding?: Settings["onboarding"],
    checkpointIdentity?: ExamCheckpointIdentity,
    checkpointCas?: ExamCheckpointCas,
  ): Promise<void> {
    if (!examPromotionIsCanonical(attempt as ExamAttempt, promotedOnboarding)) {
      throw new TypeError(attempt.passed ? "A passed sitting requires its canonical level promotion" : "A failed sitting cannot promote a learner");
    }
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const concrete = binding.database;
    await concrete.transaction("rw", [concrete.settings, concrete.examAttempts, concrete.examCheckpoints, concrete.outbox], async () => {
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const settings = await concrete.settings.get("app");
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const existing = await concrete.examAttempts.where("at").equals(attempt.at).first();
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (existing) {
        const { id: _existingId, ...existingAttempt } = existing;
        if (JSON.stringify(existingAttempt) === JSON.stringify(attempt)) return;
        throw new Error("Conflicting exam sitting identity");
      }
      if (attempt.passed && (!settings?.onboarding || settings.onboarding.level !== attempt.level)) {
        throw new StaleExamLevelError();
      }
      if (checkpointIdentity) {
        const checkpoint = sanitizeExamCheckpoint(await concrete.examCheckpoints.get("active"));
        const owner = binding.accountId ?? settings?.profileId ?? null;
        if (!checkpoint || checkpoint.profileId !== owner || !sameExamCheckpointIdentity(checkpoint, checkpointIdentity)
          || !checkpointCas || checkpoint.sessionId !== checkpointCas.sessionId || checkpoint.sequence !== checkpointCas.sequence) {
          throw new ExamCheckpointConflictError();
        }
      }
      await concrete.examAttempts.add(attempt as ExamAttempt);
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (promotedOnboarding) {
        await concrete.settings.put({ ...(settings ?? DEFAULT_SETTINGS), id: "app", onboarding: promotedOnboarding });
        if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      }
      if (checkpointIdentity) await concrete.examCheckpoints.delete("active");
      if (binding.accountId) {
        if (promotedOnboarding) {
          const cloudAttempt = {
            day: attempt.day, at: attempt.at, level: attempt.level, score: attempt.score,
            passed: attempt.passed, sections: attempt.sections, weakest: attempt.weakest,
          };
          const payload: ExamCompletionPayload = { attempt: cloudAttempt, targetLevel: promotedOnboarding.level };
          const safePayload = examCompletionOutboxPayload(payload);
          if (!safePayload) throw new TypeError("Invalid stage exam completion payload");
          await concrete.outbox.add({ kind: "exam-completion", profileId: binding.accountId, payload: safePayload, at: Date.now(), tries: 0 });
        } else {
          const safeFailure = failedExamOutboxPayload(attempt);
          if (!safeFailure) throw new TypeError("Invalid failed exam payload");
          await concrete.outbox.add({ kind: "exam", profileId: binding.accountId, payload: safeFailure, at: Date.now(), tries: 0 });
        }
      }
    });
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
  }

  async getExamCheckpointForPracticeBinding(
    bindingToken: PracticePersistenceBinding,
    identity: ExamCheckpointIdentity,
  ): Promise<ExamCheckpoint | null> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const stored = await binding.database.examCheckpoints.get("active");
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const checkpoint = sanitizeExamCheckpoint(stored);
    const owner = binding.accountId ?? (await binding.database.settings.get("app"))?.profileId ?? null;
    if (!checkpoint || checkpoint.profileId !== owner || !sameExamCheckpointIdentity(checkpoint, identity)) return null;
    return checkpoint;
  }

  async peekExamCheckpointForPracticeBinding(bindingToken: PracticePersistenceBinding): Promise<ExamCheckpoint | null> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const stored = await binding.database.examCheckpoints.get("active");
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const checkpoint = sanitizeExamCheckpoint(stored);
    const owner = binding.accountId ?? (await binding.database.settings.get("app"))?.profileId ?? null;
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    return checkpoint?.profileId === owner ? checkpoint : null;
  }

  async saveExamCheckpointForPracticeBinding(
    bindingToken: PracticePersistenceBinding,
    value: ExamCheckpoint,
    expected: ExamCheckpointCas | null,
  ): Promise<void> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const checkpoint = sanitizeExamCheckpoint(value);
    const owner = binding.accountId ?? (await binding.database.settings.get("app"))?.profileId ?? null;
    if (!checkpoint || !owner || checkpoint.profileId !== owner) throw new TypeError("Invalid stage exam checkpoint");
    await binding.database.transaction("rw", binding.database.examCheckpoints, async () => {
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const existing = sanitizeExamCheckpoint(await binding.database.examCheckpoints.get("active"));
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (expected === null) {
        if (existing || checkpoint.sequence !== 0) throw new ExamCheckpointConflictError();
      } else if (!existing || existing.sessionId !== expected.sessionId || existing.sequence !== expected.sequence
        || checkpoint.sessionId !== expected.sessionId || checkpoint.sequence !== expected.sequence + 1) {
        throw new ExamCheckpointConflictError();
      }
      await binding.database.examCheckpoints.put(checkpoint);
    });
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
  }

  async clearExamCheckpointForPracticeBinding(bindingToken: PracticePersistenceBinding, expected: ExamCheckpointCas): Promise<void> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    await binding.database.transaction("rw", binding.database.examCheckpoints, async () => {
      const existing = sanitizeExamCheckpoint(await binding.database.examCheckpoints.get("active"));
      if (!existing || existing.sessionId !== expected.sessionId || existing.sequence !== expected.sequence) throw new ExamCheckpointConflictError();
      await binding.database.examCheckpoints.delete("active");
    });
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
  }

  async getCallScores(): Promise<CallScore[]> {
    const rows = await db.callScores.toArray();
    return rows.sort((a, b) => b.at - a.at);
  }

  async saveCallScore(score: Omit<CallScore, "id">): Promise<void> {
    const { player: stored, newlyUnlocked } = await db.transaction("rw", [db.callScores, db.player], async () => {
      await db.callScores.add(score as CallScore);
      const player = { ...DEFAULT_PLAYER, ...((await db.player.get("player")) ?? {}) };
      const nextPlayer = applyPassedCallMilestone(player, score.score, score.at);
      if (nextPlayer !== player) await db.player.put(nextPlayer);
      return { player: nextPlayer, newlyUnlocked: nextPlayer !== player };
    });
    void this.mirror((profileId, sync) => sync.pushCallScore(profileId, score as CallScore));
    if (newlyUnlocked) {
      void this.mirror((profileId, sync) => sync.pushPlayer(profileId, stored));
    }
  }

  async getTalkSessions(): Promise<TalkSession[]> {
    const rows = await db.talkSessions.toArray();
    return rows.sort((a, b) => b.at - a.at);
  }

  async saveTalkSession(session: Omit<TalkSession, "id">): Promise<void> {
    await db.talkSessions.add(session as TalkSession);
    void this.mirror((profileId, sync) => sync.pushTalkSession(profileId, session as TalkSession));
  }

  async getVirtualCalls(limit?: number): Promise<VirtualCallRecord[]> {
    // The `at` index already IS newest-first once reversed, so the limit can be
    // taken at the index (same reasoning as the unfiltered getAttempts path).
    const coll = db.virtualCalls.orderBy("at").reverse();
    return (limit ? coll.limit(limit) : coll).toArray();
  }

  async saveVirtualCall(record: Omit<VirtualCallRecord, "id">): Promise<void> {
    const binding = this.capturePracticeBinding();
    if (!binding) throw new StalePracticeBindingError();
    return this.saveVirtualCallForPracticeBinding(binding, record);
  }

  async saveVirtualCallForPracticeBinding(
    bindingToken: PracticePersistenceBinding,
    record: Omit<VirtualCallRecord, "id">,
  ): Promise<void> {
    const binding = bindingToken as unknown as DbBinding;
    if (!binding?.database || !isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    const concrete = binding.database;
    let stored!: VirtualCallRecord;
    const inserted = await concrete.transaction("rw", [concrete.settings, concrete.virtualCalls], async () => {
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      const settings = await concrete.settings.get("app");
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      stored = applyTranscriptRetention(record, settings?.callTranscriptRetention ?? DEFAULT_SETTINGS.callTranscriptRetention) as VirtualCallRecord;
      const existing = await concrete.virtualCalls.where("at").equals(stored.at).first();
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      if (existing) {
        if (existing.scenarioId === stored.scenarioId && existing.startedAt === stored.startedAt && existing.endedAt === stored.endedAt) return false;
        throw new Error("Conflicting virtual call identity");
      }
      await concrete.virtualCalls.add(stored);
      if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
      return true;
    });
    if (!isDbBindingCurrent(binding)) throw new StalePracticeBindingError();
    if (!inserted) return;
    // Mirror the REPORT to the cloud so it survives an iOS storage eviction —
    // seven quiet days used to take her whole call history with it. The
    // transcript never goes: pushVirtualCall names its columns explicitly and
    // has none for it, which is what /privacidad promises.
    const profileId = binding.accountId;
    if (profileId) {
      void import("../sync/supabase-sync.ts")
        .then((sync) => {
          if (!isDbBindingCurrent(binding)) return;
          // The row keeps the microphone-start owner even if auth changes after
          // the local transaction. RLS will reject a stale A write under B;
          // it can never be relabelled as learner B's report.
          sync.pushVirtualCall(profileId, stored);
        })
        .catch(() => {});
    }
  }

  async deleteVirtualCallTranscripts(): Promise<void> {
    // Strip the field, keep the row: her report — turns, corrections, priorities,
    // pronunciation evidence — is progress she earned, and a privacy control
    // that quietly erased it would be a data-loss bug wearing a delete button.
    await db.transaction("rw", db.virtualCalls, async () => {
      const stripped = (await db.virtualCalls.toArray())
        .filter((call) => call.transcript !== undefined)
        .map(({ transcript: _dropped, ...rest }) => rest as VirtualCallRecord);
      if (stripped.length) await db.virtualCalls.bulkPut(stripped);
    });
  }

  async deleteVirtualCall(id: number): Promise<void> {
    await db.virtualCalls.delete(id);
  }

  /** Fire-and-forget cloud mirror, skipped when there is no profile or no env. */
  private async mirror(
    fn: (profileId: string, sync: typeof import("@/lib/sync/supabase-sync")) => void,
  ): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.profileId) return;
      const sync = await import("@/lib/sync/supabase-sync");
      fn(settings.profileId, sync);
    } catch {
      /* sync is best-effort; the local write already succeeded */
    }
  }

  async getQuests(day: string): Promise<DailyQuestState | undefined> {
    return db.quests.get(day);
  }

  async saveQuests(state: DailyQuestState): Promise<void> {
    await db.quests.put(state);
    void this.mirror((profileId, sync) => sync.pushQuests(profileId, state));
  }

  async getDailySession(day: string): Promise<DailySession | undefined> {
    return db.dailySessions.where("day").equals(day).first();
  }

  async saveDailySession(session: DailySession): Promise<DailySession> {
    const bound = boundAccountId();
    if (bound && session.profileId.trim().toLowerCase() !== bound) {
      throw new Error("Daily session profile does not match the bound account");
    }
    const durable = await db.transaction("rw", db.dailySessions, async () => {
      const existing = await db.dailySessions.where("day").equals(session.day).first();
      const merged = existing ? mergeDailySessions(existing, session) : session;
      await db.dailySessions.put(merged);
      return merged;
    });
    if (bound) {
      void import("../sync/supabase-sync.ts")
        .then((sync) => sync.pushDailySession(bound, durable))
        .catch(() => {});
    }
    return durable;
  }

  async claimDailySessionCompletion(
    input: DailySessionCompletionClaim,
  ): Promise<SessionCompletionResult | null> {
    const bound = boundAccountId();
    const result = await db.transaction(
      "rw",
      [db.dailySessions, db.player],
      async () => {
        const session = await db.dailySessions
          .where("day")
          .equals(input.day)
          .first();
        if (!session) return null;
        if (
          bound &&
          session.profileId.trim().toLowerCase() !== bound
        ) {
          throw new Error(
            "Daily session profile does not match the bound account",
          );
        }

        // This read belongs inside the same write transaction as both puts.
        // A stale hook snapshot can never replace attempt or cosmetic progress
        // that committed before this transaction acquired the store locks.
        const storedPlayer = await db.player.get("player");
        const player = { ...DEFAULT_PLAYER, ...(storedPlayer ?? {}) };
        const completion = applySessionCompletion(
          player,
          session,
          input.today,
        );
        if (
          completion.reward.xp === 0 &&
          completion.reward.stars === 0
        ) {
          return completion;
        }

        await db.player.put({ ...completion.player, id: "player" });
        await db.dailySessions.put(completion.session);
        return completion;
      },
    );

    if (
      result &&
      (result.reward.xp > 0 || result.reward.stars > 0)
    ) {
      void this.mirror((profileId, sync) => {
        void sync.pushPlayer(profileId, result.player);
      });
      if (bound) {
        void import("../sync/supabase-sync.ts")
          .then((sync) =>
            sync.pushDailySession(bound, result.session),
          )
          .catch(() => {});
      }
    }
    return result;
  }

  async getCategoryStats(recentWindow = RECENT_WINDOW): Promise<CategoryStat[]> {
    const [attempts, progress] = await Promise.all([
      db.attempts.toArray(),
      db.progress.toArray(),
    ]);

    const byCat = new Map<string, Attempt[]>();
    for (const raw of attempts) {
      const a = sanitizeAttempt(raw);
      if (!a || a.providerStatus === "technical-skip" || a.providerStatus === "unavailable") continue;
      const list = byCat.get(a.categoryId) ?? [];
      list.push(a);
      byCat.set(a.categoryId, list);
    }

    const progByCat = new Map<string, ItemProgress[]>();
    for (const p of progress) {
      const list = progByCat.get(p.categoryId) ?? [];
      list.push(p);
      progByCat.set(p.categoryId, list);
    }

    const categoryIds = new Set<string>([...byCat.keys(), ...progByCat.keys()]);
    const stats: CategoryStat[] = [];

    for (const categoryId of categoryIds) {
      const list = (byCat.get(categoryId) ?? []).sort((a, b) => a.at - b.at);
      const passes = list.filter((a) => a.passed).length;
      const recent = list.slice(-recentWindow);
      const recentPasses = recent.filter((a) => a.passed).length;
      const prog = progByCat.get(categoryId) ?? [];

      stats.push({
        categoryId,
        attempts: list.length,
        passes,
        accuracy: list.length ? Math.round((passes / list.length) * 100) : 0,
        recentAccuracy: recent.length ? Math.round((recentPasses / recent.length) * 100) : 0,
        practicedItems: prog.length,
        masteredItems: prog.filter((p) => p.box >= 5).length,
        lastPracticedAt: list.length ? list[list.length - 1].at : null,
      });
    }

    return stats;
  }

  async getRecordings(): Promise<PhraseRecording[]> {
    return db.recordings.orderBy("bestAt").reverse().toArray();
  }

  async saveAttemptRecording(itemId: string, blob: Blob, score: number): Promise<void> {
    const now = Date.now();
    const existing = await db.recordings.get(itemId);
    if (!existing) {
      await db.recordings.put({ itemId, firstBlob: blob, firstScore: score, firstAt: now, bestBlob: blob, bestScore: score, bestAt: now });
      return;
    }
    // Keep her very first take forever; replace the best when she tops it.
    if (score >= existing.bestScore) {
      await db.recordings.put({ ...existing, bestBlob: blob, bestScore: score, bestAt: now });
    }
  }

  async reset(): Promise<void> {
    await Promise.all([
      db.attempts.clear(),
      db.progress.clear(),
      db.customLessons.clear(),
      db.settings.clear(),
      db.player.clear(),
      db.convItems.clear(),
      db.quests.clear(),
      db.recordings.clear(),
      // Exam sittings must go too: otherwise a reset device is still blocked by
      // the one-attempt-per-day rule and still claims a band from a sitting that,
      // as far as this profile is concerned, never happened.
      db.examAttempts.clear(),
      db.callScores.clear(),
      db.talkSessions.clear(),
      db.dailySessions.clear(),
      db.virtualCalls.clear(),
      // events was omitted here before — analytics for a wiped profile is
      // meaningless and reset is meant to clear the device.
      db.events.clear(),
    ]);
  }
}
