import Dexie, { type Table } from "dexie";
import type { Attempt, ItemProgress, Lesson, PlayerStats, Settings } from "./types";

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
  }
}

// Guard against multiple instances during Next.js hot-reload.
const globalForDb = globalThis as unknown as { __claraDb?: ClaraDB };

export const db: ClaraDB =
  globalForDb.__claraDb ?? (typeof window !== "undefined" ? new ClaraDB() : (undefined as unknown as ClaraDB));

if (typeof window !== "undefined" && !globalForDb.__claraDb) {
  globalForDb.__claraDb = db;
}
