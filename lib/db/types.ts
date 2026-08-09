// Domain types — shared across the whole app and independent of the storage
// backend. When we swap IndexedDB for Supabase later, these types stay the same;
// only the repository implementation changes.

import type { AnalyticsEventType } from "@/lib/analytics-schema";
import type { Level } from "@/lib/placement";
import type { CorrectionMode } from "@/lib/virtual-call/session";
import type { PersistedPronunciationSummary, PersistedReportCorrection } from "@/lib/virtual-call/report";
import type { VisualObjectId, VisualTopicId } from "@/lib/visual-learning/types";
import type { ProviderStatus } from "@/lib/speech/pronunciation-policy";

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
  /** Optional contextual visual object shown alongside this practice item. */
  visualObjectId?: VisualObjectId;
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
  /** Optional contextual visual topic used to enrich this lesson. */
  visualTopicId?: VisualTopicId;
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
  /** Stable id generated once on the client; absent on pre-v12 legacy rows. */
  clientAttemptId?: string;
  itemId: string;
  lessonId: string;
  categoryId: string;
  phoneme: string;
  target: string; // the word/phrase she was aiming for
  /** Local-only recognized speech; intentionally absent after cloud restore. */
  heard?: string;
  score: number; // 0–100 similarity
  passed: boolean;
  /** True when the recognizer heard the minimal-pair partner instead. */
  heardPartner?: boolean;
  /**
   * Azure's measured FluencyScore (0-100) for this attempt, when the acoustic path
   * ran. Absent on Web Speech attempts, which cannot measure fluency at all — so
   * consumers must treat absence as "unknown", never as zero.
   */
  fluency?: number;
  /** Versioned decision policy used for the structured acoustic evidence. */
  policyVersion?: "latam-v1";
  /** Whether the provider returned evidence that is valid for learner grading. */
  providerStatus?: ProviderStatus;
  pronunciationScore?: number;
  accuracyScore?: number;
  completenessScore?: number;
  prosodyScore?: number;
  targetPhonemeScore?: number;
  /** Bounded diagnostic labels only; never raw provider payloads or speech. */
  weakestPhoneme?: string;
  weakestWord?: string;
  attemptOrdinal?: 1 | 2 | 3;
  pronunciationOutcome?: "mastered" | "practiced-not-mastered" | "technical-skip";
  at: number; // epoch ms
}

/**
 * Ephemeral capture evidence supplied to decision code before an attempt is
 * persisted. A technical failure is not learner performance and must never be
 * folded into a weakness signal or written into the historical Attempt record.
 */
export type AttemptEvidence = Pick<Attempt, "itemId" | "passed" | "at"> & {
  evidence: "valid" | "technical-failure";
};

/**
 * One /talk conversation, recorded so the general path's ten-minute milestone can
 * be measured rather than asserted.
 *
 * `avgPauseMs` is captured but not yet used as a gate — see lib/milestone.ts for
 * why. `completed` is false for a session she walked away from.
 */
export interface TalkSession {
  id?: number; // auto-increment (Dexie)
  scenarioId: string;
  at: number; // epoch ms, when it started
  durationMs: number;
  /** How many turns SHE took, not counting Joel's. */
  studentTurns: number;
  /** Mean gap between his line finishing and her speaking, when measurable. */
  avgPauseMs: number | null;
  completed: boolean;
}

/**
 * One completed call in the call simulator, kept so progress on the job path is
 * measurable and can appear on her report. Append-only, like exam sittings.
 */
export interface CallScore {
  id?: number; // auto-increment (Dexie)
  scenarioId: string;
  at: number; // epoch ms
  score: number;
  /** The four QA checks, keyed by QaKey from lib/content/call-scenarios.ts. */
  checks: Record<string, boolean>;
}

/** One line of a Virtual Call conversation, in the order it was spoken. */
export interface VirtualCallLine {
  role: "guide" | "learner";
  /** Clara's spoken line, or what the recognizer transcribed from the learner. */
  text: string;
  at: number; // epoch ms
}

/**
 * One completed Virtual Call, kept so spoken practice is measurable and can
 * appear on her report. Append-only, like exam sittings and call-simulator runs.
 *
 * Everything above `transcript` IS the end-of-call report (built by
 * lib/virtual-call/report.ts from the recorded turns) and is always stored —
 * counts and enum-only correction/pronunciation evidence are not recordings.
 * `transcript` is the only field permitted to carry what she actually said, and it is
 * written ONLY when Settings.callTranscriptRetention is "keep"; the write path
 * drops it otherwise (see applyTranscriptRetention in ./repository.ts).
 *
 * Cloud sync deep-sanitizes the report again and never includes `transcript`.
 */
export interface VirtualCallRecord {
  id?: number; // auto-increment (Dexie)
  scenarioId: string;
  /** The correction mode the call actually ran in ("natural" | "practice"). */
  mode: CorrectionMode;
  /** The CEFR band the call was pitched at. */
  level: Level;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  /** History timestamp (the moment the call ended) — the indexed sort key. */
  at: number;
  durationMs: number;
  learnerTurns: number;
  /** Turns where nothing needed fixing — the "what went well" evidence. */
  cleanTurns: number;
  metCriteria: boolean;
  corrections: PersistedReportCorrection[];
  /** The two or three worth working on, most severe first. */
  priorities: PersistedReportCorrection[];
  vocabularyUsedCount: number;
  /**
   * Bounded free-speech diagnoses plus separate scripted phrase results.
   * Only scripted results are graded; diagnosis must never imply mastery.
   */
  pronunciation?: PersistedPronunciationSummary;
  retriedCount: number;
  retriedAcceptedCount: number;
  /** The conversation itself. Absent unless she opted into keeping it. */
  transcript?: VirtualCallLine[];
}

/**
 * One sitting of a stage exam — the gate between CEFR bands.
 *
 * Stored per attempt (never overwritten) so a band is backed by a record: `day`
 * enforces one sitting per calendar day, and the presence of a passed row at a
 * level is what lets the readiness card stop saying "provisional".
 */
export interface ExamAttempt {
  id?: number; // auto-increment (Dexie)
  /** dayKey of the sitting, e.g. "2026-07-27". */
  day: string;
  at: number; // epoch ms
  /** The level she held going IN. */
  level: string;
  score: number;
  passed: boolean;
  /** Per-section scores, keyed by SectionKey from lib/exams.ts. */
  sections: Record<string, number>;
  /** The weakest section, so a fail stays actionable after the fact. */
  weakest: string | null;
  /**
   * Which grading machinery produced each section's score ("llm", "azure",
   * "mechanical") — the audit trail for a disputed band. Legacy rows may
   * still contain the retired transcript label.
   * Local-only; not mirrored to the cloud schema.
   */
  gradePaths?: Record<string, string>;
}

/**
 * The one resumable stage-exam sitting for this account. It contains only
 * bounded scoring state: never audio, transcripts, or provider payloads.
 */
export interface ExamCheckpoint {
  id: "active";
  version: 1;
  sequence: number;
  sessionId: string;
  profileId: string;
  day: string;
  startedAt: number;
  sourceLevel: string;
  candidateLevel: string;
  seed: string;
  contentVersion: string;
  contentHash: string;
  status: "running" | "pending-advance" | "practice-required";
  sectionIdx: number;
  itemIdx: number;
  scores: Record<string, number[]>;
  gradePaths: Record<string, string[]>;
  speaking: {
    status: "ready" | "retry" | "mastered" | "practice-required";
    learnerMisses: number;
    validAcousticAttempts: number;
  };
  focus?: {
    itemId: string;
    itemText: string;
    feature: string;
    lessonId: string;
    mouthHint: string;
  };
  pendingAdvance?: {
    completedSectionIdx: number;
    completedItemIdx: number;
    nextSectionIdx: number | null;
    nextItemIdx: number | null;
    feedback: string | null;
    delayMs: number;
  };
}

export interface ExamCheckpointCas { sessionId: string; sequence: number }

export interface ExamCheckpointIdentity {
  day: string;
  sourceLevel: string;
  candidateLevel: string;
  seed: string;
  contentVersion: string;
  contentHash: string;
}

export interface ExamCompletionPayload {
  attempt: Omit<ExamAttempt, "id">;
  targetLevel: string;
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

/**
 * A phrase mined from a live `/talk` conversation — either the corrected form of
 * something she said, or a natural phrase from the exchange worth mastering. It
 * IS a PracticeItem (so it flows through the exact same review/scoring pipeline),
 * plus provenance so we can show "from your conversation".
 */
export interface ConvItem extends PracticeItem {
  source: "talk";
  scenarioId: string;
  createdAt: number;
}

/**
 * One day's progress on the three daily missions. Keyed by local day; rolls over
 * automatically. `claimed` guards the one-time completion bonus.
 */
export interface DailyQuestState {
  day: string; // local YYYY-MM-DD
  talk: number; // conversation exchanges today
  review: number; // items reviewed today
  learn: number; // new items practiced today
  claimed: boolean; // completion bonus already awarded
}

export interface Settings {
  /**
   * Voice-capture consent: the notice version accepted and when. Null records
   * a durable withdrawal. Absent = never asked.
   */
  voiceConsent?: { version: number; at: number } | null;
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
  /**
   * How strict pronunciation scoring is. "auto" (default) adapts the pass bar to
   * her recent performance — easier after a rough patch, tighter once she's
   * cruising. "gentle" is a constant beginner-friendly bar; "normal" is the
   * stricter bar for students chasing polish. See lib/adaptive.ts.
   */
  difficulty: "gentle" | "normal" | "auto";
  /**
   * Adaptive-onboarding result: level, goal, commitment, placement subscores.
   * Absent until the learner completes onboarding (which is what gates the flow).
   */
  onboarding?: import("@/lib/onboarding").OnboardingProfile;
  /**
   * How Clara corrects her on a Virtual Call. "natural" (the default when the
   * field is absent) keeps the conversation going and saves the corrections for
   * the end report; "practice" stops on a mistake that matters and asks for the
   * sentence again. See lib/virtual-call/session.ts — they are two different
   * products, not a severity slider.
   *
   * Device-local: the cloud `settings` table has no column for it (see
   * pushSettings in lib/sync/supabase-sync.ts).
   */
  callCorrectionMode?: CorrectionMode;
  /**
   * How playful Clara is on a call. "light" is the default when absent: some
   * warmth, no comedy routine. "off" for a learner who finds jokes distracting,
   * "full" for one who wants them. Device-local.
   */
  humorLevel?: "off" | "light" | "full";
  /**
   * What is kept from a Virtual Call once it ends. Absent = "none", the minimal
   * option, chosen as the default deliberately: the aggregate report is always
   * stored either way, so nothing about her progress depends on keeping a record
   * of her words.
   *   none    — the transcript is never written to storage; it is gone when the
   *             call ends. Only the aggregate report row is saved.
   *   session — the transcript stays in memory for the summary screen right
   *             after the call, then goes; still never written to storage.
   *   keep    — the transcript is saved with the call on THIS device so she can
   *             re-read it later. Removable at any time from Settings.
   * Device-local.
   */
  callTranscriptRetention?: "none" | "session" | "keep";
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
  /** Lifetime completed daily sessions. Missed days never reduce this count. */
  completedDailySessions: number;
  /** Durable earned-content gates, kept as a set of stable milestone ids. */
  unlockedMilestones: string[];
  /** Stars — the game currency. Earned 1–3 per clear answer by how clean it was. */
  stars: number;
  /** Cosmetic ids the learner has bought with stars (free items are always owned). */
  ownedCosmetics: string[];
  /** Currently equipped Lumi background / accessory / ambient effect. */
  equippedBg: string;
  equippedAccessory: string;
  equippedEffect: string;
  /** Her companion pet on Lumi's stage (pet-none = no pet). */
  equippedPet?: string;
  /** The outfit Lumi is wearing (outfit-default = her signature look). */
  equippedOutfit?: string;
  /**
   * The learner's own adult avatar (separate from the guide). All three fields
   * are optional and purely cosmetic: players who predate them resolve to the
   * defaults in lib/avatar.ts defaultLoadout() and lib/store.ts
   * DEFAULT_FOR_SLOT — nothing destructive, nothing that touches assessment.
   */
  avatarBase?: import("@/lib/avatar").AvatarBase;
  /** The avatar's outfit (street-default = the free look). */
  equippedAvatarOutfit?: string;
  /** The avatar's baseball cap (cap-none = bare-headed). */
  equippedCap?: string;
  /** Local day the daily reward chest was last opened (null = never). */
  lastChestDay: string | null;
  /** Streak "freezes" banked — one covers a single missed day so the streak survives. */
  streakFreezes: number;
  /** The day a freeze was last spent, so we don't double-spend within one day. */
  freezeUsedDay: string | null;
  updatedAt: number;
}

/** Rolled-up accuracy for one category, computed for the dashboard. */
/**
 * Her voice journal: the first and best passing recording of a phrase, kept
 * strictly on-device (Blobs never sync) so she can hear herself improve.
 */
export interface PhraseRecording {
  itemId: string;
  firstBlob: Blob;
  firstScore: number;
  firstAt: number;
  bestBlob: Blob;
  bestScore: number;
  bestAt: number;
}

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

/**
 * A lightweight analytics event — engagement signals not already captured by
 * attempts (app opens, mode taps, lesson start/abandon, the daily loop).
 * Privacy-respecting: props carry ids, counts, durations, and enums only, never
 * free text or PII. The type union and the properties each type may carry live
 * in lib/analytics-schema.ts, which is the single source of truth; nothing
 * outside that allowlist is written locally or mirrored to the cloud.
 */
export interface AnalyticsEvent {
  id?: number;
  type: AnalyticsEventType;
  at: number;
  day: string; // "YYYY-MM-DD" local, for daily rollups
  props?: Record<string, string | number | boolean>;
}

/**
 * A one-shot history row whose cloud mirror insert failed, held for durable
 * retry (lib/sync/outbox.ts). `payload` is the domain object exactly as the
 * original push saw it; `profileId` pins attribution so a replay after an
 * account switch can never write under the wrong user (RLS enforces it too).
 */
export interface OutboxRow {
  id?: number;
  /** Kept in step with DurableKind in lib/sync/supabase-sync.ts. Duplicating
   *  the union here rather than importing it keeps this module free of sync
   *  imports; the compiler catches any drift at the enqueue call site. */
  kind: "attempt" | "progress" | "player" | "quest" | "exam" | "exam-completion" | "call" | "talk" | "daily-session" | "virtual-call" | "settings";
  profileId: string;
  payload: unknown;
  /** When the original write happened (ms). */
  at: number;
  /** Replay attempts so far — observability, not a give-up threshold. */
  tries: number;
  lastError?: string;
}
