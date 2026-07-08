import { db } from "./dexie";
import { DEFAULT_PLAYER, DEFAULT_SETTINGS, type DataRepository } from "./repository";
import type {
  Attempt,
  CategoryStat,
  ConvItem,
  DailyQuestState,
  ItemProgress,
  Lesson,
  PlayerStats,
  Settings,
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
    let coll = db.attempts.orderBy("at").reverse();
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
  }

  async getConvItems(): Promise<ConvItem[]> {
    return db.convItems.orderBy("createdAt").toArray();
  }

  async saveConvItem(item: ConvItem): Promise<void> {
    await db.convItems.put(item);
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

  async reset(): Promise<void> {
    await Promise.all([
      db.attempts.clear(),
      db.progress.clear(),
      db.customLessons.clear(),
      db.settings.clear(),
      db.player.clear(),
      db.convItems.clear(),
      db.quests.clear(),
    ]);
  }
}
