import type {
  Attempt,
  CallScore,
  CategoryStat,
  ConvItem,
  DailyQuestState,
  ExamAttempt,
  ExamCheckpoint,
  ExamCheckpointCas,
  ExamCheckpointIdentity,
  ExamCompletionPayload,
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
import type { AttemptRewards } from "../gamification";
import type { BoundPronunciationCheckpoint, DailyPronunciationAttemptMutation } from "../daily-pronunciation-mutation";
import { sanitizePersistedPronunciationSummary } from "../virtual-call/report.ts";
import { levelUp } from "../placement.ts";
import { PASS_SCORE } from "../exams.ts";

const PROVIDER_STATUSES = new Set(["valid", "technical-skip", "unavailable"]);
const PRONUNCIATION_OUTCOMES = new Set(["mastered", "practiced-not-mastered", "technical-skip"]);
const PRONUNCIATION_SCORE_FIELDS = [
  "pronunciationScore",
  "accuracyScore",
  "completenessScore",
  "prosodyScore",
  "targetPhonemeScore",
] as const satisfies readonly (keyof Attempt)[];

type UnknownRecord = Record<string, unknown>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_ID_PATTERN = /^[a-z0-9][a-z0-9:._/-]*$/i;
const MIN_ATTEMPT_AT = Date.UTC(2000, 0, 1);
const MAX_ATTEMPT_AT = Date.UTC(2100, 0, 1);

function record(value: unknown): UnknownRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value as UnknownRecord : null;
}

function own(source: UnknownRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function boundedScore(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

function boundedLabel(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const label = value.trim();
  return label.length > 0 && label.length <= maxLength ? label : undefined;
}

function requiredText(source: UnknownRecord, key: string, maxLength: number): string | null {
  const value = own(source, key);
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= maxLength ? text : null;
}

function requiredId(source: UnknownRecord, key: string): string | null {
  const value = requiredText(source, key, 128);
  return value && SAFE_ID_PATTERN.test(value) ? value : null;
}

function optionalScore(source: UnknownRecord, key: keyof Attempt): number | undefined {
  return boundedScore(own(source, key));
}

/**
 * Reconstruct bounded stored/restored evidence from its scalar allowlist.
 * UUID-less rows are accepted here only for pre-v12 local/cloud compatibility;
 * every new write must pass sanitizeNewAttempt below.
 */
export function sanitizeAttempt(value: unknown): Attempt | null {
  const source = record(value);
  if (!source) return null;
  const itemId = requiredId(source, "itemId");
  const lessonId = requiredId(source, "lessonId");
  const categoryId = requiredId(source, "categoryId");
  const phoneme = requiredText(source, "phoneme", 64);
  const target = requiredText(source, "target", 512);
  const score = boundedScore(own(source, "score"));
  const passed = own(source, "passed");
  const at = own(source, "at");
  if (
    !itemId || !lessonId || !categoryId || !phoneme || !target
    || score === undefined || typeof passed !== "boolean"
    || typeof at !== "number" || !Number.isSafeInteger(at)
    || at < MIN_ATTEMPT_AT || at > MAX_ATTEMPT_AT
  ) return null;

  const providerStatus = own(source, "providerStatus");
  const pronunciationOutcome = own(source, "pronunciationOutcome");
  if (
    providerStatus === "technical-skip" || providerStatus === "unavailable"
    || pronunciationOutcome === "technical-skip"
  ) return null;
  if (pronunciationOutcome === "mastered" && !passed) return null;
  if (pronunciationOutcome === "practiced-not-mastered" && passed) return null;

  const safe: Attempt = {
    itemId, lessonId, categoryId, phoneme, target, score, passed, at,
  };

  const id = own(source, "id");
  if (typeof id === "number" && Number.isSafeInteger(id) && id > 0) safe.id = id;
  const clientAttemptId = own(source, "clientAttemptId");
  if (clientAttemptId !== undefined && (typeof clientAttemptId !== "string" || !UUID_PATTERN.test(clientAttemptId))) {
    return null;
  }
  if (typeof clientAttemptId === "string") {
    safe.clientAttemptId = clientAttemptId.toLowerCase();
  }
  const heard = boundedLabel(own(source, "heard"), 512);
  if (heard !== undefined) safe.heard = heard;
  const heardPartner = own(source, "heardPartner");
  if (typeof heardPartner === "boolean") safe.heardPartner = heardPartner;
  const fluency = optionalScore(source, "fluency");
  if (fluency !== undefined) safe.fluency = fluency;
  if (own(source, "policyVersion") === "latam-v1") safe.policyVersion = "latam-v1";
  if (PROVIDER_STATUSES.has(providerStatus as string)) {
    safe.providerStatus = providerStatus as Attempt["providerStatus"];
  }
  const attemptOrdinal = own(source, "attemptOrdinal");
  if (attemptOrdinal === 1 || attemptOrdinal === 2 || attemptOrdinal === 3) {
    safe.attemptOrdinal = attemptOrdinal;
  }
  if (PRONUNCIATION_OUTCOMES.has(pronunciationOutcome as string)) {
    safe.pronunciationOutcome = pronunciationOutcome as Attempt["pronunciationOutcome"];
  }

  for (const field of PRONUNCIATION_SCORE_FIELDS) {
    const measured = optionalScore(source, field);
    if (measured !== undefined) safe[field] = measured;
  }
  const weakestPhoneme = boundedLabel(own(source, "weakestPhoneme"), 64);
  const weakestWord = boundedLabel(own(source, "weakestWord"), 128);
  if (weakestPhoneme !== undefined) safe.weakestPhoneme = weakestPhoneme;
  if (weakestWord !== undefined) safe.weakestWord = weakestWord;

  return safe;
}

/** New writes require stable UUID identity; UUID-less rows are read-only legacy. */
export function sanitizeNewAttempt(value: unknown): Attempt | null {
  const attempt = sanitizeAttempt(value);
  return attempt?.clientAttemptId ? attempt : null;
}

function outboxPayload(attempt: Attempt | null): Record<string, unknown> | null {
  if (!attempt) return null;
  const safe: Record<string, unknown> = { ...attempt };
  delete safe.id;
  delete safe.heard;
  return safe;
}

/** Safe payload for a newly queued attempt; UUID identity is mandatory. */
export function attemptOutboxPayload(value: unknown): Record<string, unknown> | null {
  return outboxPayload(sanitizeNewAttempt(value));
}

/** Scrub a genuine historical retry while retaining UUID-less compatibility. */
export function legacyAttemptOutboxPayload(value: unknown): Record<string, unknown> | null {
  return outboxPayload(sanitizeAttempt(value));
}

const EXAM_SECTIONS = new Set(["readAloud", "repeat", "build", "shortAnswer", "retell", "openResponse"]);
const EXAM_LEVELS = new Set(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);
const ONBOARDING_SYNC_KEYS = new Set(["name", "country", "city", "goal", "dailyMinutes", "selfLevel", "level", "subscores", "path", "completedAt"]);
const ONBOARDING_GOALS = new Set(["travel", "social", "work", "moving", "dating", "fluency"]);
const ONBOARDING_SELF_LEVELS = new Set(["zero", "basics", "understandMore", "converse"]);
const ONBOARDING_SUBSCORES = ["listening", "vocabulary", "grammar", "reading", "speaking"] as const;

export interface SettingsSyncPayload {
  profile: { id: string; name: string; coachLanguage: "es" | "en" };
  settings: {
    profileId: string; dailyGoal: number; speechRate: number; voiceURI: string | null; recognitionLang: string;
    studentName: string | null; onboarding: Settings["onboarding"] | null; coachLanguage: "es" | "en";
    difficulty: Settings["difficulty"]; soundEnabled: boolean; instructorMode: boolean;
    voiceConsent: NonNullable<Settings["voiceConsent"]> | null;
  };
}

function exactKeys(source: UnknownRecord, allowed: ReadonlySet<string>, required: readonly string[] = []): boolean {
  const keys = Object.keys(source);
  return keys.every((key) => allowed.has(key)) && required.every((key) => Object.hasOwn(source, key));
}

export function sanitizeOnboardingForSync(value: unknown): Settings["onboarding"] | null | undefined {
  if (value === null) return null;
  const source = record(value);
  const required = ["name", "country", "city", "goal", "dailyMinutes", "selfLevel", "level", "completedAt"];
  if (!source || !exactKeys(source, ONBOARDING_SYNC_KEYS, required)) return undefined;
  const name = boundedLabel(own(source, "name"), 120);
  const country = boundedLabel(own(source, "country"), 80);
  const city = boundedLabel(own(source, "city"), 80);
  const goal = own(source, "goal");
  const dailyMinutes = own(source, "dailyMinutes");
  const selfLevel = own(source, "selfLevel");
  const level = own(source, "level");
  const completedAt = own(source, "completedAt");
  const path = own(source, "path");
  if (!name || !country || !city || !ONBOARDING_GOALS.has(goal as string)
    || ![10, 20, 30].includes(dailyMinutes as number) || !ONBOARDING_SELF_LEVELS.has(selfLevel as string)
    || !EXAM_LEVELS.has(level as string) || typeof completedAt !== "number" || !Number.isSafeInteger(completedAt)
    || completedAt < 0 || completedAt > MAX_ATTEMPT_AT
    || (path !== undefined && path !== "general" && path !== "job")) return undefined;
  let subscores: Record<string, number> | undefined;
  const rawSubscores = own(source, "subscores");
  if (rawSubscores !== undefined) {
    const scores = record(rawSubscores);
    const allowedScores = new Set<string>(ONBOARDING_SUBSCORES);
    if (!scores || !exactKeys(scores, allowedScores, ONBOARDING_SUBSCORES)) return undefined;
    subscores = {};
    for (const key of ONBOARDING_SUBSCORES) {
      const score = own(scores, key);
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 5) return undefined;
      subscores[key] = score;
    }
  }
  return {
    name, country, city, goal: goal as NonNullable<Settings["onboarding"]>["goal"],
    dailyMinutes: dailyMinutes as NonNullable<Settings["onboarding"]>["dailyMinutes"],
    selfLevel: selfLevel as NonNullable<Settings["onboarding"]>["selfLevel"],
    level: level as NonNullable<Settings["onboarding"]>["level"], completedAt,
    ...(subscores ? { subscores } : {}),
    ...(path ? { path: path as NonNullable<Settings["onboarding"]>["path"] } : {}),
  };
}

export function sanitizeVoiceConsentForSync(value: unknown): NonNullable<Settings["voiceConsent"]> | null | undefined {
  if (value === null) return null;
  const consent = record(value);
  if (!consent || Object.keys(consent).sort().join(",") !== "at,version") return undefined;
  const version = own(consent, "version");
  const at = own(consent, "at");
  if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 || version > 100
    || typeof at !== "number" || !Number.isSafeInteger(at) || at < 0 || at > MAX_ATTEMPT_AT) return undefined;
  return { version, at };
}

export function sanitizeSettingsSyncPayload(value: unknown): SettingsSyncPayload | null {
  const root = record(value);
  const profile = record(root ? own(root, "profile") : null);
  const settings = record(root ? own(root, "settings") : null);
  if (!root || !profile || !settings || Object.keys(root).sort().join(",") !== "profile,settings"
    || Object.keys(profile).sort().join(",") !== "coachLanguage,id,name"
    || Object.keys(settings).sort().join(",") !== "coachLanguage,dailyGoal,difficulty,instructorMode,onboarding,profileId,recognitionLang,soundEnabled,speechRate,studentName,voiceConsent,voiceURI") return null;
  const id = boundedLabel(own(profile, "id"), 128);
  const name = boundedLabel(own(profile, "name"), 120);
  const coachLanguage = own(profile, "coachLanguage");
  const profileId = boundedLabel(own(settings, "profileId"), 128);
  const dailyGoal = own(settings, "dailyGoal");
  const speechRate = own(settings, "speechRate");
  const voiceURI = own(settings, "voiceURI");
  const recognitionLang = boundedLabel(own(settings, "recognitionLang"), 32);
  const studentName = own(settings, "studentName");
  const onboarding = sanitizeOnboardingForSync(own(settings, "onboarding"));
  const settingsCoach = own(settings, "coachLanguage");
  const difficulty = own(settings, "difficulty");
  const soundEnabled = own(settings, "soundEnabled");
  const instructorMode = own(settings, "instructorMode");
  const voiceConsent = sanitizeVoiceConsentForSync(own(settings, "voiceConsent"));
  if (!id || !name || id !== profileId || (coachLanguage !== "es" && coachLanguage !== "en") || settingsCoach !== coachLanguage
    || !Number.isInteger(dailyGoal) || (dailyGoal as number) < 1 || (dailyGoal as number) > 240
    || typeof speechRate !== "number" || !Number.isFinite(speechRate) || speechRate < 0.5 || speechRate > 2
    || (voiceURI !== null && boundedLabel(voiceURI, 512) === undefined) || !recognitionLang
    || (studentName !== null && boundedLabel(studentName, 120) === undefined) || onboarding === undefined || voiceConsent === undefined
    || !["gentle", "normal", "auto"].includes(difficulty as string)
    || typeof soundEnabled !== "boolean" || typeof instructorMode !== "boolean") return null;
  return {
    profile: { id, name, coachLanguage },
    settings: {
      profileId, dailyGoal: dailyGoal as number, speechRate, voiceURI: voiceURI as string | null, recognitionLang,
      studentName: studentName as string | null, onboarding, coachLanguage: settingsCoach as "es" | "en", difficulty: difficulty as Settings["difficulty"],
      soundEnabled, instructorMode, voiceConsent,
    },
  };
}

export function settingsSyncPayload(profileId: string, settings: Settings): SettingsSyncPayload | null {
  return sanitizeSettingsSyncPayload({
    profile: { id: profileId, name: settings.studentName?.trim() || "Clara", coachLanguage: settings.coachLanguage },
    settings: {
      profileId, dailyGoal: settings.dailyGoal, speechRate: settings.speechRate, voiceURI: settings.voiceURI?.trim() || null,
      recognitionLang: settings.recognitionLang, studentName: settings.studentName?.trim() || null, onboarding: settings.onboarding ?? null,
      coachLanguage: settings.coachLanguage, difficulty: settings.difficulty, soundEnabled: settings.soundEnabled,
      instructorMode: settings.instructorMode, voiceConsent: settings.voiceConsent ?? null,
    },
  });
}

/** A passed sitting and its level change are one domain event. */
export function examPromotionIsCanonical(
  attempt: Pick<ExamAttempt, "level" | "passed" | "score">,
  promotedOnboarding?: Settings["onboarding"],
): boolean {
  if (attempt.passed !== (attempt.score >= PASS_SCORE)) return false;
  if (!attempt.passed) return promotedOnboarding === undefined;
  if (!promotedOnboarding || !EXAM_LEVELS.has(attempt.level)) return false;
  return promotedOnboarding.level === levelUp(attempt.level as import("../placement.ts").Level);
}

/** The legacy exam channel is failure-only; every pass uses exam-completion. */
export function failedExamOutboxPayload(value: unknown): Omit<ExamAttempt, "id"> | null {
  const raw = record(value);
  if (!raw || own(raw, "passed") !== false) return null;
  const day = safeDay(own(raw, "day"));
  const at = safeNonNegativeInteger(own(raw, "at"));
  const level = own(raw, "level");
  const score = boundedScore(own(raw, "score"));
  const rawSections = record(own(raw, "sections"));
  const weakest = own(raw, "weakest");
  if (!day || at === null || !EXAM_LEVELS.has(level as string) || score === undefined || score >= PASS_SCORE || !rawSections
    || Object.keys(rawSections).length > EXAM_SECTIONS.size
    || (weakest !== null && !EXAM_SECTIONS.has(weakest as string))) return null;
  const sections: Record<string, number> = {};
  for (const [key, sectionValue] of Object.entries(rawSections)) {
    const sectionScore = boundedScore(sectionValue);
    if (!EXAM_SECTIONS.has(key) || sectionScore === undefined) return null;
    sections[key] = sectionScore;
  }
  return { day, at, level: level as string, score, passed: false, sections, weakest: weakest as string | null };
}

/** Strict allowlist for the one combined exam + optional promotion retry. */
export function examCompletionOutboxPayload(value: unknown): ExamCompletionPayload | null {
  const source = record(value);
  const rawAttempt = record(source ? own(source, "attempt") : null);
  if (!source || !rawAttempt || Object.keys(source).sort().join(",") !== "attempt,targetLevel"
    || Object.keys(rawAttempt).sort().join(",") !== "at,day,level,passed,score,sections,weakest") return null;
  const day = safeDay(own(rawAttempt, "day"));
  const at = safeNonNegativeInteger(own(rawAttempt, "at"));
  const level = own(rawAttempt, "level");
  const score = boundedScore(own(rawAttempt, "score"));
  const passed = own(rawAttempt, "passed");
  const rawSections = record(own(rawAttempt, "sections"));
  const weakest = own(rawAttempt, "weakest");
  if (!day || at === null || !EXAM_LEVELS.has(level as string) || score === undefined || passed !== true || score < PASS_SCORE
    || !rawSections || (weakest !== null && !EXAM_SECTIONS.has(weakest as string))) return null;
  const sections: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawSections)) {
    const sectionScore = boundedScore(value);
    if (!EXAM_SECTIONS.has(key) || sectionScore === undefined) return null;
    sections[key] = sectionScore;
  }
  if (Object.keys(sections).length !== EXAM_SECTIONS.size) return null;
  const attempt: Omit<ExamAttempt, "id"> = {
    day, at, level: level as string, score, passed, sections,
    weakest: weakest as string | null,
  };
  const targetLevel = own(source, "targetLevel");
  if (typeof targetLevel !== "string" || targetLevel !== levelUp(level as import("../placement.ts").Level)) return null;
  return { attempt, targetLevel };
}

function safeNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function safeDay(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function safeStringList(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 256) return null;
  const strings = value.filter((entry): entry is string =>
    typeof entry === "string" && entry.length > 0 && entry.length <= 128 && SAFE_ID_PATTERN.test(entry));
  return strings.length === value.length ? strings : null;
}

/** Strict, scalar-only allowlist for a durable progress state replay. */
export function progressOutboxPayload(value: unknown): ItemProgress | null {
  const source = record(value);
  if (!source) return null;
  const itemId = requiredId(source, "itemId");
  const lessonId = requiredId(source, "lessonId");
  const categoryId = requiredId(source, "categoryId");
  const phoneme = requiredText(source, "phoneme", 64);
  const attempts = safeNonNegativeInteger(own(source, "attempts"));
  const passes = safeNonNegativeInteger(own(source, "passes"));
  const box = safeNonNegativeInteger(own(source, "box"));
  const dueAt = safeNonNegativeInteger(own(source, "dueAt"));
  const updatedAt = safeNonNegativeInteger(own(source, "updatedAt"));
  const lastScore = boundedScore(own(source, "lastScore"));
  const lastResult = own(source, "lastResult");
  if (!itemId || !lessonId || !categoryId || !phoneme || attempts === null || passes === null
    || passes > attempts || box === null || box > 6 || dueAt === null || updatedAt === null
    || lastScore === undefined || !["pass", "fail", null].includes(lastResult as never)) return null;
  return { itemId, lessonId, categoryId, phoneme, attempts, passes, box, dueAt,
    lastResult: lastResult as ItemProgress["lastResult"], lastScore, updatedAt };
}

/** Strict allowlist for durable player state; no caller-controlled ownership. */
export function playerOutboxPayload(value: unknown): PlayerStats | null {
  const source = record(value);
  if (!source || own(source, "id") !== "player") return null;
  const integerKeys = ["xp", "currentStreak", "longestStreak", "todayXp", "totalAttempts",
    "totalPasses", "bestCombo", "stars", "streakFreezes", "updatedAt"] as const;
  const integers = Object.fromEntries(integerKeys.map((key) => [key, safeNonNegativeInteger(own(source, key))]));
  if (Object.values(integers).some((entry) => entry === null)) return null;
  const achievements = safeStringList(own(source, "achievements"));
  const ownedCosmetics = safeStringList(own(source, "ownedCosmetics"));
  const optionalDay = (key: string) => own(source, key) === null ? null : safeDay(own(source, key));
  const lastActiveDay = optionalDay("lastActiveDay");
  const todayKey = optionalDay("todayKey");
  const lastChestDay = optionalDay("lastChestDay");
  const freezeUsedDay = optionalDay("freezeUsedDay");
  const cosmetic = (key: string, fallback: string) => boundedLabel(own(source, key), 128) ?? fallback;
  if (!achievements || !ownedCosmetics || (own(source, "lastActiveDay") !== null && !lastActiveDay)
    || (own(source, "todayKey") !== null && !todayKey)
    || (own(source, "lastChestDay") !== null && !lastChestDay)
    || (own(source, "freezeUsedDay") !== null && !freezeUsedDay)) return null;
  return {
    id: "player",
    xp: integers.xp!, currentStreak: integers.currentStreak!, longestStreak: integers.longestStreak!,
    lastActiveDay, todayKey, todayXp: integers.todayXp!, totalAttempts: integers.totalAttempts!,
    totalPasses: integers.totalPasses!, bestCombo: integers.bestCombo!, achievements,
    stars: integers.stars!, ownedCosmetics,
    equippedBg: cosmetic("equippedBg", "bg-default"),
    equippedAccessory: cosmetic("equippedAccessory", "acc-none"),
    equippedEffect: cosmetic("equippedEffect", "fx-none"),
    equippedPet: cosmetic("equippedPet", "pet-none"),
    equippedOutfit: cosmetic("equippedOutfit", "outfit-default"),
    lastChestDay, streakFreezes: integers.streakFreezes!, freezeUsedDay,
    updatedAt: integers.updatedAt!,
  };
}

/** Strict allowlist for one local-day quest state replay. */
export function questOutboxPayload(value: unknown): DailyQuestState | null {
  const source = record(value);
  if (!source) return null;
  const day = safeDay(own(source, "day"));
  const talk = safeNonNegativeInteger(own(source, "talk"));
  const review = safeNonNegativeInteger(own(source, "review"));
  const learn = safeNonNegativeInteger(own(source, "learn"));
  const claimed = own(source, "claimed");
  return day && talk !== null && review !== null && learn !== null && typeof claimed === "boolean"
    ? { day, talk, review, learn, claimed }
    : null;
}

/**
 * Deterministic identity for every cloud-synced Attempt field. Local row id and
 * recognized speech are intentionally excluded. Null is the missing marker, so
 * measured 0 and explicit false remain distinct from absent legacy evidence.
 */
export function canonicalAttemptIdentity(value: unknown): string | null {
  const attempt = sanitizeAttempt(value);
  if (!attempt) return null;
  return JSON.stringify([
    attempt.clientAttemptId ?? null,
    attempt.itemId,
    attempt.lessonId,
    attempt.categoryId,
    attempt.phoneme,
    attempt.target,
    attempt.score,
    attempt.passed,
    attempt.heardPartner ?? null,
    attempt.at,
    attempt.fluency ?? null,
    attempt.policyVersion ?? null,
    attempt.providerStatus ?? null,
    attempt.pronunciationScore ?? null,
    attempt.accuracyScore ?? null,
    attempt.completenessScore ?? null,
    attempt.prosodyScore ?? null,
    attempt.targetPhonemeScore ?? null,
    attempt.weakestPhoneme ?? null,
    attempt.weakestWord ?? null,
    attempt.attemptOrdinal ?? null,
    attempt.pronunciationOutcome ?? null,
  ]);
}

/** Return only remote rows that are absent locally, with cloud ids stripped. */
export function mergeAttemptHistory(local: readonly unknown[], remote: readonly unknown[]): Omit<Attempt, "id">[] {
  const locals = local.map(sanitizeAttempt).filter((attempt): attempt is Attempt => attempt !== null);
  const clientIds = new Set(locals.flatMap((attempt) => attempt.clientAttemptId ? [attempt.clientAttemptId] : []));
  const legacyKeys = new Set(
    locals
      .filter((attempt) => !attempt.clientAttemptId)
      .map(canonicalAttemptIdentity)
      .filter((identity): identity is string => identity !== null),
  );
  const merged: Omit<Attempt, "id">[] = [];
  for (const value of remote) {
    const attempt = sanitizeAttempt(value);
    if (!attempt) continue;
    delete attempt.id;
    if (attempt.clientAttemptId) {
      if (clientIds.has(attempt.clientAttemptId)) continue;
      clientIds.add(attempt.clientAttemptId);
    } else {
      const key = canonicalAttemptIdentity(attempt);
      if (!key) continue;
      if (legacyKeys.has(key)) continue;
      legacyKeys.add(key);
    }
    merged.push(attempt);
  }
  return merged;
}

export interface DailySessionCompletionClaim {
  day: string;
  /** Current local day at claim time; may differ after a midnight rollover. */
  today: string;
}

/** One pronunciation mutation, committed as a single idempotent local unit. */
export interface PracticeAttemptMutation {
  attempt: Omit<Attempt, "id">;
  /** Inputs used to derive SRS from the transaction-fresh progress row. */
  progress?: { passed: boolean; score: number; dueInMs?: number };
  /** Inputs used to derive rewards from the transaction-fresh player row. */
  reward?: {
    passed: boolean;
    combo: number;
    score: number;
    xpAward?: number;
    masteryStars?: number;
  };
  /** Count this terminal attempt as learn/review using transaction-fresh SRS. */
  quest?: boolean;
  /** Atomically union this UUID event into the captured account's daily row. */
  dailyPronunciation?: DailyPronunciationAttemptMutation;
}

export type PracticeAttemptCommitResult =
  | { status: "committed"; rewards: AttemptRewards; outboxIds: number[]; dailySession?: DailySession }
  | { status: "already-committed"; outboxIds: number[]; dailySession?: DailySession };

declare const practiceBindingBrand: unique symbol;
/** Opaque handle to one concrete account-scoped local database generation. */
export type PracticePersistenceBinding = { readonly [practiceBindingBrand]: true };

export class StalePracticeBindingError extends Error {
  readonly code = "account-changed";

  constructor() {
    super("The learner account changed before pronunciation progress could be saved");
    this.name = "StalePracticeBindingError";
  }
}

export class StaleExamLevelError extends Error {
  readonly code = "stage-level-changed";

  constructor() {
    super("The learner level changed before the stage exam could be saved");
    this.name = "StaleExamLevelError";
  }
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
  capturePracticeBinding(): PracticePersistenceBinding | null;
  /** Read history only from the concrete learner scope captured before speech. */
  getAttemptsForPracticeBinding(
    binding: PracticePersistenceBinding,
    opts?: { itemId?: string; categoryId?: string; limit?: number; since?: number },
  ): Promise<Attempt[]>;
  /** Atomically append one attempt and its dependent progress/reward state. */
  commitPracticeAttempt(binding: PracticePersistenceBinding, mutation: PracticeAttemptMutation): Promise<PracticeAttemptCommitResult>;
  checkpointDailyPronunciation(binding: PracticePersistenceBinding, checkpoint: BoundPronunciationCheckpoint): Promise<DailySession>;
  replaceCorruptDailyPronunciation(binding: PracticePersistenceBinding, input: { day: string; activityId: string; at: number }): Promise<DailySession>;
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
  saveSettingsForPracticeBinding(binding: PracticePersistenceBinding, settings: Settings): Promise<void>;

  // --- Player progression ---
  getPlayerStats(): Promise<PlayerStats>;
  savePlayerStats(stats: PlayerStats): Promise<void>;

  // --- Phrases mined from live conversations (feed the review deck) ---
  getConvItems(): Promise<ConvItem[]>;
  saveConvItem(item: ConvItem): Promise<void>;

  // --- Daily quests ---
  /** Stage-exam sittings, newest first. Append-only: a band must stay auditable. */
  getExamAttempts(): Promise<ExamAttempt[]>;
  getExamAttemptsForPracticeBinding(binding: PracticePersistenceBinding): Promise<ExamAttempt[]>;
  /** Completed call-simulator runs, newest first. Append-only. */
  getCallScores(): Promise<CallScore[]>;
  /** /talk sessions, newest first — the milestone's evidence. */
  getTalkSessions(): Promise<TalkSession[]>;
  saveTalkSession(session: Omit<TalkSession, "id">): Promise<void>;
  saveCallScore(score: Omit<CallScore, "id">): Promise<void>;
  saveExamAttempt(attempt: Omit<ExamAttempt, "id">): Promise<void>;
  /** Save exactly once against the learner captured before the sitting began. */
  saveExamAttemptForPracticeBinding(
    binding: PracticePersistenceBinding,
    attempt: Omit<ExamAttempt, "id">,
    promotedOnboarding?: Settings["onboarding"],
    checkpointIdentity?: ExamCheckpointIdentity,
    checkpointCas?: ExamCheckpointCas,
  ): Promise<void>;
  getExamCheckpointForPracticeBinding(binding: PracticePersistenceBinding, identity: ExamCheckpointIdentity): Promise<ExamCheckpoint | null>;
  /** Read the active owner-bound sitting without deleting or relabelling it. */
  peekExamCheckpointForPracticeBinding(binding: PracticePersistenceBinding): Promise<ExamCheckpoint | null>;
  saveExamCheckpointForPracticeBinding(binding: PracticePersistenceBinding, checkpoint: ExamCheckpoint, expected: ExamCheckpointCas | null): Promise<void>;
  clearExamCheckpointForPracticeBinding(binding: PracticePersistenceBinding, expected: ExamCheckpointCas): Promise<void>;

  // --- Virtual Call (spoken practice conversation with Clara) ---
  /** Completed Virtual Calls, newest first. Append-only. */
  getVirtualCalls(limit?: number): Promise<VirtualCallRecord[]>;
  /**
   * Store one finished call. The transcript is dropped unless she opted into
   * keeping it (Settings.callTranscriptRetention) — the report is always kept.
   */
  saveVirtualCall(record: Omit<VirtualCallRecord, "id">): Promise<void>;
  /** Save against the concrete learner captured before microphone recording. */
  saveVirtualCallForPracticeBinding(binding: PracticePersistenceBinding, record: Omit<VirtualCallRecord, "id">): Promise<void>;
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
  const safe = sanitizeVirtualCallRecord(record, retention);
  if (!safe) throw new TypeError("Invalid virtual call persistence record");
  return safe;
}

const CALL_CORRECTION_KINDS = new Set(["grammar", "vocabulary", "phrasing", "pronunciation"]);
const CALL_LEVELS = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);

/** Deep allowlist for the only Virtual Call shape permitted to cross a durable boundary. */
export function sanitizeVirtualCallRecord(
  value: unknown,
  retention: Settings["callTranscriptRetention"] = "none",
): Omit<VirtualCallRecord, "id"> | null {
  const source = record(value);
  if (!source) return null;
  const scenarioId = boundedLabel(own(source, "scenarioId"), 80);
  const mode = own(source, "mode");
  const level = own(source, "level");
  if (!scenarioId || !SAFE_ID_PATTERN.test(scenarioId) || (mode !== "natural" && mode !== "practice") || !CALL_LEVELS.has(String(level))) return null;
  const integer = (key: string, max = Number.MAX_SAFE_INTEGER): number | null => {
    const raw = own(source, key);
    return typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 && raw <= max ? raw : null;
  };
  const startedAt = integer("startedAt");
  const endedAt = integer("endedAt");
  const at = integer("at");
  const durationMs = integer("durationMs", 30 * 60_000);
  const learnerTurns = integer("learnerTurns", 100);
  const cleanTurns = integer("cleanTurns", 100);
  const retriedCount = integer("retriedCount", 100);
  const retriedAcceptedCount = integer("retriedAcceptedCount", 100);
  if ([startedAt, endedAt, at, durationMs, learnerTurns, cleanTurns, retriedCount, retriedAcceptedCount].some((item) => item === null)) return null;
  const safeCorrections = (input: unknown, max: number) => (Array.isArray(input) ? input : [])
    .slice(0, max)
    .flatMap((candidate) => {
      const item = record(candidate);
      const kind = item ? own(item, "kind") : null;
      return item && CALL_CORRECTION_KINDS.has(String(kind))
        ? [{ kind: kind as VirtualCallRecord["corrections"][number]["kind"], fixedOnRetry: own(item, "fixedOnRetry") === true }]
        : [];
    });
  const rawVocabularyCount = own(source, "vocabularyUsedCount");
  const vocabularyUsedCount = typeof rawVocabularyCount === "number"
    ? Math.min(20, Math.max(0, Math.trunc(rawVocabularyCount)))
    : Math.min(20, Array.isArray(own(source, "vocabularyUsed")) ? (own(source, "vocabularyUsed") as unknown[]).length : 0);
  const pronunciation = sanitizePersistedPronunciationSummary(own(source, "pronunciation"));
  const rawTranscript = own(source, "transcript");
  const transcript = retention === "keep" && Array.isArray(rawTranscript)
    ? rawTranscript.slice(0, 100).flatMap((candidate) => {
        const line = record(candidate);
        const role = line ? own(line, "role") : null;
        const text = line ? own(line, "text") : null;
        const lineAt = line ? own(line, "at") : null;
        return (role === "guide" || role === "learner") && typeof text === "string" && text.length <= 2_000 && typeof lineAt === "number" && Number.isSafeInteger(lineAt)
          ? [{ role: role as "guide" | "learner", text, at: lineAt }]
          : [];
      })
    : undefined;
  return {
    scenarioId,
    mode,
    level: level as VirtualCallRecord["level"],
    startedAt: startedAt!,
    endedAt: endedAt!,
    at: at!,
    durationMs: durationMs!,
    learnerTurns: learnerTurns!,
    cleanTurns: cleanTurns!,
    metCriteria: own(source, "metCriteria") === true,
    corrections: safeCorrections(own(source, "corrections"), 24),
    priorities: safeCorrections(own(source, "priorities"), 3),
    vocabularyUsedCount,
    ...(pronunciation ? { pronunciation } : {}),
    retriedCount: retriedCount!,
    retriedAcceptedCount: retriedAcceptedCount!,
    ...(transcript ? { transcript } : {}),
  };
}

/** Text-free retry payload for cloud sync; local transcript opt-in never crosses. */
export function virtualCallOutboxPayload(value: unknown): VirtualCallRecord | null {
  return sanitizeVirtualCallRecord(value, "none") as VirtualCallRecord | null;
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
