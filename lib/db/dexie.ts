import Dexie, { type Table } from "dexie";
import type { AnalyticsEvent, Attempt, CallScore, ConvItem, DailyQuestState, ExamAttempt, ItemProgress, Lesson, PhraseRecording, PlayerStats, Settings } from "./types";

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
  events!: Table<AnalyticsEvent, number>;
  examAttempts!: Table<ExamAttempt, number>;
  callScores!: Table<CallScore, number>;

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
    // v5 adds a lightweight analytics event log (engagement signals not already
    // captured by attempts): opens, mode taps, lesson start/abandon. Local-first;
    // best-effort mirrored to the cloud per user.
    this.version(5).stores({
      events: "++id, type, at, day",
    });
    // v6 adds stage-exam attempts. These are what make a CEFR band earned rather
    // than self-reported: one row per sitting, keyed by day so the one-per-day
    // rule has something to check.
    this.version(6).stores({
      examAttempts: "++id, day, at, level",
    });
    // v7 adds completed call-simulator runs, so job-path practice is measurable
    // and can be counted on her report.
    this.version(7).stores({
      callScores: "++id, at, scenarioId",
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
