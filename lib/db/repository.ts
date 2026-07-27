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
  /** Stage-exam sittings, newest first. Append-only: a band must stay auditable. */
  getExamAttempts(): Promise<ExamAttempt[]>;
  /** Completed call-simulator runs, newest first. Append-only. */
  getCallScores(): Promise<CallScore[]>;
  /** /talk sessions, newest first — the milestone's evidence. */
  getTalkSessions(): Promise<TalkSession[]>;
  saveTalkSession(session: Omit<TalkSession, "id">): Promise<void>;
  saveCallScore(score: Omit<CallScore, "id">): Promise<void>;
  saveExamAttempt(attempt: Omit<ExamAttempt, "id">): Promise<void>;

  getQuests(day: string): Promise<DailyQuestState | undefined>;
  saveQuests(state: DailyQuestState): Promise<void>;

  // --- Voice journal (on-device only; never synced) ---
  getRecordings(): Promise<PhraseRecording[]>;
  saveAttemptRecording(itemId: string, blob: Blob, score: number): Promise<void>;

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
  // Adaptive by default: the pass bar meets her where she is (lib/adaptive.ts).
  difficulty: "auto",
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
  stars: 0,
  ownedCosmetics: [],
  equippedBg: "bg-default",
  equippedAccessory: "acc-none",
  equippedEffect: "fx-none",
  equippedPet: "pet-none",
  lastChestDay: null,
  streakFreezes: 0,
  freezeUsedDay: null,
  updatedAt: 0,
};
