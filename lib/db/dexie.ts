import Dexie, { type Table } from "dexie";
import type { Attempt, ConvItem, DailyQuestState, ItemProgress, Lesson, PhraseRecording, PlayerStats, Settings } from "./types";

/**
 * Local-first storage via IndexedDB. This is the ONLY file that knows we use
 * Dexie. The repository (see ./repository.ts) is the public surface every
 * component talks to, so swapping in Supabase later means writing a new
 * repository — not touching components.
 */
export class ClaraDB extends Dexie {
  attempts!: Table<Attempt, number>;
  progress!: Table<ItemProgress, string>;
  customLessons!: Table<Lesson, string>;
  settings!: Table<Settings, string>;
  player!: Table<PlayerStats, string>;
  convItems!: Table<ConvItem, string>;
  quests!: Table<DailyQuestState, string>;
  recordings!: Table<PhraseRecording, string>;

  constructor() {
    super("clara");
    this.version(1).stores({
      // Indexes chosen for the queries we actually run: history by item/category,
      // due items for SRS, etc.
      attempts: "++id, itemId, lessonId, categoryId, phoneme, at, passed",
      progress: "itemId, lessonId, categoryId, phoneme, dueAt, box",
      customLessons: "id, order",
      settings: "id",
    });
    // v2 adds the player progression store (XP, streaks, achievements).
    this.version(2).stores({
      player: "id",
    });
    // v3 adds the learning-loop stores: phrases mined from live conversations
    // (they feed the review deck) and per-day quest progress.
    this.version(3).stores({
      convItems: "id, createdAt",
      quests: "day",
    });
    // v4 adds her voice journal: first + best recording per phrase, kept
    // strictly on-device (never synced) so she can hear herself improve.
    this.version(4).stores({
      recordings: "itemId, bestAt",
    });
  }
}

// Guard against multiple instances during Next.js hot-reload.
const globalForDb = globalThis as unknown as { __claraDb?: ClaraDB };

export const db: ClaraDB =
  globalForDb.__claraDb ?? (typeof window !== "undefined" ? new ClaraDB() : (undefined as unknown as ClaraDB));

if (typeof window !== "undefined" && !globalForDb.__claraDb) {
  globalForDb.__claraDb = db;
}
