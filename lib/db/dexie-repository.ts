import { db } from "./dexie";
import { DEFAULT_PLAYER, DEFAULT_SETTINGS, type DataRepository } from "./repository";
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
    const coll = db.attempts.orderBy("at").reverse();
    const rows = await coll.toArray();
    let filtered = rows;
    if (opts.itemId) filtered = filtered.filter((a) => a.itemId === opts.itemId);
    if (opts.categoryId) filtered = filtered.filter((a) => a.categoryId === opts.categoryId);
    if (opts.since) filtered = filtered.filter((a) => a.at >= opts.since!);
    if (opts.limit) filtered = filtered.slice(0, opts.limit);
    return filtered;
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
  }

  async deleteCustomLesson(id: string): Promise<void> {
    await db.customLessons.delete(id);
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
      // events was omitted here before — analytics for a wiped profile is
      // meaningless and reset is meant to clear the device.
      db.events.clear(),
    ]);
  }
}
