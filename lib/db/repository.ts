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
import type { DailySession } from "../daily-session";
import type { SessionCompletionResult } from "../daily-session-reward";

export interface DailySessionCompletionClaim {
  day: string;
  /** Current local day at claim time; may differ after a midnight rollover. */
  today: string;
}

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

  // --- Virtual Call (spoken practice conversation with Clara) ---
  /** Completed Virtual Calls, newest first. Append-only. */
  getVirtualCalls(limit?: number): Promise<VirtualCallRecord[]>;
  /**
   * Store one finished call. The transcript is dropped unless she opted into
   * keeping it (Settings.callTranscriptRetention) — the report is always kept.
   */
  saveVirtualCall(record: Omit<VirtualCallRecord, "id">): Promise<void>;
  /**
   * Clear the stored transcript on every call, keeping every report row. This
   * is the privacy control, not a reset: deleting her recordings must never
   * delete the progress she earned making them.
   */
  deleteVirtualCallTranscripts(): Promise<void>;
  /** Remove one call outright (report included), by row id. */
  deleteVirtualCall(id: number): Promise<void>;

  getQuests(day: string): Promise<DailyQuestState | undefined>;
  saveQuests(state: DailyQuestState): Promise<void>;

  // --- Resumable daily classroom loop ---
  getDailySession(day: string): Promise<DailySession | undefined>;
  saveDailySession(session: DailySession): Promise<DailySession>;
  claimDailySessionCompletion(
    input: DailySessionCompletionClaim,
  ): Promise<SessionCompletionResult | null>;

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
  // Virtual Call defaults. getSettings() merges these over a stored row, so a
  // learner who set up her profile before these fields existed resolves to the
  // same values as a new one — no migration, nothing silently switched on.
  callCorrectionMode: "natural",
  humorLevel: "light",
  // Minimal retention by default: the conversation is not written down unless
  // she asks for it. The aggregate report is stored either way.
  callTranscriptRetention: "none",
};

/**
 * Enforce the transcript-retention choice at the point of writing, not at the
 * point of building the record. The caller assembling a finished call should
 * not have to remember the privacy rule for it to hold, and a bug there must
 * not be able to persist her words against her setting.
 */
export function applyTranscriptRetention(
  record: Omit<VirtualCallRecord, "id">,
  retention: Settings["callTranscriptRetention"],
): Omit<VirtualCallRecord, "id"> {
  if (retention === "keep") return record;
  const { transcript: _dropped, ...rest } = record;
  return rest;
}

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
