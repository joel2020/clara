import { boundAccountId, db } from "./dexie.ts";
import { applyTranscriptRetention, DEFAULT_PLAYER, DEFAULT_SETTINGS, type DataRepository } from "./repository.ts";
import type { DailySession } from "../daily-session";
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
  ItemProgress,
  Lesson,
  PhraseRecording,
  PlayerStats,
  Settings,
  TalkSession,
  VirtualCallRecord,
} from "./types";

const RECENT_WINDOW = 20; // attempts per category counted as "recent"

/**
 * IndexedDB-backed implementation of DataRepository (via Dexie). This is the
 * local-first default. A SupabaseRepository implementing the same interface can
 * replace it without touching any component.
 */
export class DexieRepository implements DataRepository {
  async recordAttempt(attempt: Omit<Attempt, "id">): Promise<void> {
    await db.attempts.add(attempt as Attempt);
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
      return opts.limit ? rows.slice(0, opts.limit) : rows;
    }

    const coll = opts.since
      ? db.attempts.where("at").aboveOrEqual(opts.since).reverse()
      : db.attempts.orderBy("at").reverse();
    return (opts.limit ? coll.limit(opts.limit) : coll).toArray();
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

  async saveExamAttempt(attempt: Omit<ExamAttempt, "id">): Promise<void> {
    // Append-only: sittings are never overwritten, so a band stays auditable.
    await db.examAttempts.add(attempt as ExamAttempt);
    // Mirrored to the cloud so an earned band survives a device change — the whole
    // point of an exam is that it is not device-local trivia.
    void this.mirror((profileId, sync) => sync.pushExamAttempt(profileId, attempt as ExamAttempt));
  }

  async getCallScores(): Promise<CallScore[]> {
    const rows = await db.callScores.toArray();
    return rows.sort((a, b) => b.at - a.at);
  }

  async saveCallScore(score: Omit<CallScore, "id">): Promise<void> {
    await db.callScores.add(score as CallScore);
    void this.mirror((profileId, sync) => sync.pushCallScore(profileId, score as CallScore));
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
    // The retention setting is read asynchronously, so the account binding is
    // re-checked before the write: an account switch in between would land this
    // call in the WRONG learner's database (the failure saveDailySession guards
    // against, arriving here through the awaited read rather than a stale hook).
    const bound = boundAccountId();
    const { callTranscriptRetention } = await this.getSettings();
    if (boundAccountId() !== bound) {
      throw new Error("Account changed while saving the virtual call");
    }
    // Append-only, and no cloud mirror: there is no virtual_calls table, so a
    // kept transcript stays in this account's local database.
    await db.virtualCalls.add(
      applyTranscriptRetention(record, callTranscriptRetention) as VirtualCallRecord,
    );
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
    for (const a of attempts) {
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
