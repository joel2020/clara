// Domain types — shared across the whole app and independent of the storage
// backend. When we swap IndexedDB for Supabase later, these types stay the same;
// only the repository implementation changes.

export type ItemKind = "word" | "phrase";

export type LessonKind = "minimal-pairs" | "sound-focus" | "phrase";

/**
 * A broad sound category that the dashboard groups accuracy by. These map 1:1 to
 * the contrast sets Spanish speakers struggle with.
 */
export interface SoundCategory {
  id: string;
  label: string; // e.g. "Short i vs Long ee"
  symbols: string; // e.g. "/ɪ/ vs /iː/"
  blurb: string; // why it's hard for a Spanish speaker, in plain English
}

/**
 * A single thing to practice: a word or a phrase. The atomic unit of the
 * interaction loop and of spaced repetition.
 */
export interface PracticeItem {
  id: string;
  text: string; // what she says, e.g. "sheep"
  ipa: string; // e.g. "/ʃiːp/"
  mouthHint: string; // plain-English mouth-position cue
  kind: ItemKind;
  categoryId: string; // links to SoundCategory (drives the dashboard)
  phoneme: string; // finer-grained target, e.g. "iː" — used inside a category
  /** Groups minimal-pair partners together (e.g. ship & sheep share a pairId). */
  pairId?: string;
  /** Plain-English gloss, helpful for phrases / less common words. */
  note?: string;
  /** Spanish meaning — shown prominently on conversation chunks so a beginner always knows what she's saying. */
  meaning?: string;
}

export interface Lesson {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  kind: LessonKind;
  categoryIds: string[];
  items: PracticeItem[];
  /**
   * Curriculum track: "sounds" (pronunciation contrast sets) or "conversation"
   * (scenario chunks for real-life speaking). Defaults to "sounds".
   */
  track?: "sounds" | "conversation";
  /** The teaching stage shown before any drilling. Built-in lessons have one. */
  intro?: LessonIntro;
  /** Custom lessons authored in Instructor mode are flagged so we can edit them. */
  custom?: boolean;
  order: number;
}

/**
 * The "Learn" stage of a full lesson: a short, warm mini-class shown before the
 * drills — what the sound is, why it trips up Spanish speakers, and how to
 * physically make it, with tappable Joel-voice examples.
 */
export interface LessonIntro {
  /** What this lesson teaches, in one warm sentence. */
  summary: string;
  /** Why it's hard coming from Spanish — the trap, named plainly. */
  whyTricky: string;
  /** 2–4 concrete physical steps to produce the sound(s). */
  how: string[];
  /** Item ids to surface as tappable listening examples. */
  exampleIds: string[];
}

/** One recorded pronunciation attempt. Append-only history. */
export interface Attempt {
  id?: number; // auto-increment (Dexie)
  itemId: string;
  lessonId: string;
  categoryId: string;
  phoneme: string;
  target: string; // the word/phrase she was aiming for
  heard: string; // what SpeechRecognition transcribed
  score: number; // 0–100 similarity
  passed: boolean;
  /** True when the recognizer heard the minimal-pair partner instead. */
  heardPartner?: boolean;
  at: number; // epoch ms
}

/**
 * Per-item learning state for spaced repetition (Leitner boxes). One row per
 * practice item the learner has touched.
 */
export interface ItemProgress {
  itemId: string;
  lessonId: string;
  categoryId: string;
  phoneme: string;
  attempts: number;
  passes: number;
  box: number; // 0..MASTERED_BOX — higher = longer interval
  dueAt: number; // epoch ms — when it should resurface
  lastResult: "pass" | "fail" | null;
  lastScore: number;
  updatedAt: number;
}

export interface Settings {
  id: string; // always "app"
  instructorMode: boolean;
  speechRate: number; // default playback rate for SpeechSynthesis
  voiceURI?: string; // preferred SpeechSynthesis voice
  recognitionLang: string; // e.g. "en-US"
  soundEnabled: boolean; // game sound effects
  dailyGoal: number; // XP target per day
  /** The student's name — set on first launch, personalizes the whole app. */
  studentName: string | null;
  /**
   * Passwordless "sync code" identifying this student across devices. Generated
   * on first launch (or entered to join an existing profile). Null until the
   * student is set up. Drives cloud sync when Supabase is configured.
   */
  profileId: string | null;
  /**
   * Language of the COACHING (instructions, hints, feedback). "es" teaches a
   * beginner in Spanish while the practice content stays English; "en" is for
   * advanced students. Practice targets are always English.
   */
  coachLanguage: "es" | "en";
}

/**
 * Player progression — the "fun layer". One row keyed "player". XP, level
 * (derived), daily streak, today's progress toward the goal, and unlocked
 * achievement ids.
 */
export interface PlayerStats {
  id: string; // always "player"
  xp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: string | null; // local YYYY-MM-DD of last practice
  todayKey: string | null; // local YYYY-MM-DD that todayXp belongs to
  todayXp: number;
  totalAttempts: number;
  totalPasses: number;
  bestCombo: number;
  achievements: string[]; // unlocked achievement ids
  updatedAt: number;
}

/** Rolled-up accuracy for one category, computed for the dashboard. */
export interface CategoryStat {
  categoryId: string;
  attempts: number;
  passes: number;
  accuracy: number; // 0–100
  recentAccuracy: number; // last N attempts
  practicedItems: number;
  masteredItems: number;
  lastPracticedAt: number | null;
}
