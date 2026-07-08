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

/**
 * The data layer's public contract. Every component and hook talks to this
 * interface — never to Dexie directly. To move to Supabase for cross-device
 * sync, implement this same interface against Supabase and swap the singleton in
 * ./index.ts. No component code changes.
 */
export interface DataRepository {
  // --- Attempts (append-only history) ---
  recordAttempt(attempt: Omit<Attempt, "id">): Promise<void>;
  getAttempts(opts?: {
    itemId?: string;
    categoryId?: string;
    limit?: number;
    since?: number;
  }): Promise<Attempt[]>;

  // --- Per-item SRS progress ---
  getProgress(itemId: string): Promise<ItemProgress | undefined>;
  getAllProgress(): Promise<ItemProgress[]>;
  saveProgress(progress: ItemProgress): Promise<void>;

  // --- Instructor-authored custom lessons ---
  getCustomLessons(): Promise<Lesson[]>;
  saveCustomLesson(lesson: Lesson): Promise<void>;
  deleteCustomLesson(id: string): Promise<void>;

  // --- Settings ---
  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  // --- Player progression ---
  getPlayerStats(): Promise<PlayerStats>;
  savePlayerStats(stats: PlayerStats): Promise<void>;

  // --- Phrases mined from live conversations (feed the review deck) ---
  getConvItems(): Promise<ConvItem[]>;
  saveConvItem(item: ConvItem): Promise<void>;

  // --- Daily quests ---
  getQuests(day: string): Promise<DailyQuestState | undefined>;
  saveQuests(state: DailyQuestState): Promise<void>;

  // --- Derived analytics ---
  getCategoryStats(recentWindow?: number): Promise<CategoryStat[]>;

  /** Wipe all learner data (used by a reset action). */
  reset(): Promise<void>;
}

export const DEFAULT_SETTINGS: Settings = {
  id: "app",
  instructorMode: false,
  speechRate: 0.9,
  recognitionLang: "en-US",
  soundEnabled: true,
  dailyGoal: 40,
  studentName: null,
  profileId: null,
  coachLanguage: "es",
};

export const DEFAULT_PLAYER: PlayerStats = {
  id: "player",
  xp: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDay: null,
  todayKey: null,
  todayXp: 0,
  totalAttempts: 0,
  totalPasses: 0,
  bestCombo: 0,
  achievements: [],
  streakFreezes: 0,
  freezeUsedDay: null,
  updatedAt: 0,
};
