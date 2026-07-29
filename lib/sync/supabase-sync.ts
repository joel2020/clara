"use client";

import { supabase, syncEnabled } from "../db/supabase.ts";
import type { Attempt, CallScore, ConvItem, DailyQuestState, ExamAttempt, ItemProgress, Lesson, PlayerStats, Settings, TalkSession } from "../db/types.ts";
import type { DailySession } from "../daily-session.ts";

// The cloud-sync layer. The app writes to Dexie first (instant, offline); these
// helpers mirror each profile's data to Supabase in the background and can pull
// it back on another device. Everything is best-effort and env-gated: with no
// Supabase configured, every function is a cheap no-op and the app is unaffected.
//
// A profile is keyed by a short "sync code" (the profile id) — a passwordless
// way for the same student to share progress across devices, and for the
// instructor to look up any student.

export interface Profile {
  id: string;
  name: string;
  coachLanguage: "es" | "en";
}

function ok() {
  return syncEnabled() && supabase() !== null;
}

/**
 * The last sync failure, for diagnosis. Read via `lastSyncFailure()`.
 *
 * Kept because a silent sync is indistinguishable from a working one, and this app
 * promises that a student's progress follows her account.
 */
let lastFailure: { label: string; code?: string; message?: string; at: number } | null = null;

/** The most recent sync failure, or null if every write has succeeded. */
export function lastSyncFailure(): typeof lastFailure {
  return lastFailure;
}

/**
 * Fire-and-forget, but NOT silent.
 *
 * A sync failure must never interrupt the learner mid-practice, so nothing is
 * thrown or shown. But it must not vanish either: supabase-js RESOLVES with
 * `{ error }` rather than rejecting, so the previous `.catch(() => {})` could not
 * have caught a bad column name, an RLS rejection or a constraint violation. Those
 * wrote nothing and reported nothing — the student's data was simply gone.
 *
 * So the resolved value is inspected, and anything wrong is recorded and warned.
 */
function bg(p: PromiseLike<unknown> | undefined, label: string): void {
  void Promise.resolve(p)
    .then((res) => {
      const error = (res as { error?: { message?: string; code?: string } } | null | undefined)?.error;
      if (!error) return;
      lastFailure = { label, code: error.code, message: error.message, at: Date.now() };
      console.warn(`[clara sync] ${label} failed${error.code ? ` (${error.code})` : ""}: ${error.message ?? "unknown"}`);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      lastFailure = { label, message, at: Date.now() };
      console.warn(`[clara sync] ${label} threw: ${message}`);
    });
}

// ── Durable pushes (outbox) ──────────────────────────────────────────────────
//
// Upsert-style state (progress, player, settings) self-heals on the next write,
// but one-shot history rows (attempts, exam sittings, call runs, talk sessions)
// used to exist only locally forever if their single insert failed — an offline
// session or a transient 5xx silently orphaned completed work (audit P1). The
// outbox (lib/sync/outbox.ts) registers itself here; any failed durable push
// hands it the payload for retry. Kept as a registration to avoid an import
// cycle, and so this module stays inert in tests and on the server.

export type DurableKind = "attempt" | "exam" | "call" | "talk" | "daily-session";

let outboxSink: ((kind: DurableKind, profileId: string, payload: unknown) => void) | null = null;

/** Called once by the outbox module; replaces any previous sink. */
export function setOutboxSink(fn: typeof outboxSink): void {
  outboxSink = fn;
}

/** Like bg(), but a failure also queues the payload for durable retry. */
function bgDurable(p: PromiseLike<unknown> | undefined, label: string, kind: DurableKind, profileId: string, payload: unknown): void {
  void Promise.resolve(p)
    .then((res) => {
      const error = (res as { error?: { message?: string; code?: string } } | null | undefined)?.error;
      if (!error) return;
      lastFailure = { label, code: error.code, message: error.message, at: Date.now() };
      console.warn(`[clara sync] ${label} failed${error.code ? ` (${error.code})` : ""}: ${error.message ?? "unknown"} — queued for retry`);
      outboxSink?.(kind, profileId, payload);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      lastFailure = { label, message, at: Date.now() };
      console.warn(`[clara sync] ${label} threw: ${message} — queued for retry`);
      outboxSink?.(kind, profileId, payload);
    });
}

/**
 * Deliver one queued row, idempotently. Exam/call/talk land on their natural
 * unique keys; `attempts` has no unique constraint, so replay checks for the
 * (profile_id, at) pair before inserting — a duplicate practice rep in the
 * mirror would double-count history. Returns true when the cloud definitely
 * has the row (delivered now or already there); false = try again later.
 */
export async function deliverQueued(kind: DurableKind, profileId: string, payload: unknown): Promise<boolean> {
  const sb = supabase();
  if (!ok() || !sb) return false;
  try {
    if (kind === "attempt") {
      const a = payload as Attempt;
      const { data, error: selErr } = await sb.from("attempts").select("at").eq("profile_id", profileId).eq("at", a.at).limit(1);
      if (selErr) return false;
      if (data && data.length > 0) return true; // already mirrored
      const { error } = await sb.from("attempts").insert(attemptRow(profileId, a));
      return !error;
    }
    if (kind === "exam") {
      const { error } = await sb.from("exam_attempts").upsert(examRow(profileId, payload as ExamAttempt), { onConflict: "profile_id,day", ignoreDuplicates: true });
      return !error;
    }
    if (kind === "call") {
      const { error } = await sb.from("call_scores").upsert(callRow(profileId, payload as CallScore), { onConflict: "profile_id,at", ignoreDuplicates: true });
      return !error;
    }
    if (kind === "daily-session") {
      const session = payload as DailySession;
      if (session.profileId !== profileId) return false;
      const { error } = await sb.rpc("merge_daily_session", dailySessionArgs(session));
      return !error;
    }
    const { error } = await sb.from("talk_sessions").upsert(talkRow(profileId, payload as TalkSession), { onConflict: "profile_id,at", ignoreDuplicates: true });
    return !error;
  } catch {
    return false;
  }
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export async function ensureProfile(profile: Profile): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  await sb.from("profiles").upsert(
    {
      id: profile.id,
      name: profile.name,
      coach_language: profile.coachLanguage,
      updated_at: Date.now(),
    },
    { onConflict: "id" },
  );
}

export async function getProfile(id: string): Promise<Profile | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from("profiles").select("id,name,coach_language").eq("id", id).maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, coachLanguage: (data.coach_language as "es" | "en") ?? "es" };
}

export async function listProfiles(): Promise<Profile[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data } = await sb.from("profiles").select("id,name,coach_language").order("created_at", { ascending: true });
  return (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    coachLanguage: (d.coach_language as "es" | "en") ?? "es",
  }));
}

// ── Push (Dexie → cloud), fire-and-forget ────────────────────────────────────

function attemptRow(profileId: string, a: Attempt) {
  return {
    profile_id: profileId,
    item_id: a.itemId,
    lesson_id: a.lessonId,
    category_id: a.categoryId,
    phoneme: a.phoneme,
    target: a.target,
    heard: a.heard,
    score: a.score,
    passed: a.passed,
    heard_partner: a.heardPartner ?? false,
    fluency: a.fluency ?? null,
    at: a.at,
  };
}

export function pushAttempt(profileId: string, a: Attempt): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bgDurable(sb.from("attempts").insert(attemptRow(profileId, a)), "attempts", "attempt", profileId, a);
}

export function pushProgress(profileId: string, p: ItemProgress): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(
    sb.from("progress").upsert(
      {
        profile_id: profileId,
        item_id: p.itemId,
        lesson_id: p.lessonId,
        category_id: p.categoryId,
        phoneme: p.phoneme,
        attempts: p.attempts,
        passes: p.passes,
        box: p.box,
        due_at: p.dueAt,
        last_result: p.lastResult,
        last_score: p.lastScore,
        updated_at: p.updatedAt,
      },
      { onConflict: "profile_id,item_id" },
    ), "progress");
}

export function pushPlayer(profileId: string, s: PlayerStats): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  const base = {
    profile_id: profileId,
    xp: s.xp,
    current_streak: s.currentStreak,
    longest_streak: s.longestStreak,
    last_active_day: s.lastActiveDay,
    today_key: s.todayKey,
    today_xp: s.todayXp,
    total_attempts: s.totalAttempts,
    total_passes: s.totalPasses,
    best_combo: s.bestCombo,
    achievements: s.achievements,
    updated_at: s.updatedAt,
  };
  // The game economy — stars, wardrobe, chest, freezes — is progress too.
  const economy = {
    stars: s.stars ?? 0,
    owned_cosmetics: s.ownedCosmetics ?? [],
    equipped_bg: s.equippedBg ?? "bg-default",
    equipped_accessory: s.equippedAccessory ?? "acc-none",
    equipped_effect: s.equippedEffect ?? "fx-none",
    last_chest_day: s.lastChestDay ?? null,
    streak_freezes: s.streakFreezes ?? 0,
    freeze_used_day: s.freezeUsedDay ?? null,
  };
  // Cascade from richest payload to safest: a cloud schema missing a newer
  // column rejects the whole row, so drop back a tier instead of losing the
  // rest of her progress. (equipped_pet is the newest column.)
  const payloads = [
    { ...base, ...economy, equipped_pet: s.equippedPet ?? "pet-none", equipped_outfit: s.equippedOutfit ?? "outfit-default" },
    { ...base, ...economy, equipped_pet: s.equippedPet ?? "pet-none" },
    { ...base, ...economy },
    base,
  ];
  bg(
    (async () => {
      for (const payload of payloads) {
        const res = await sb.from("player_stats").upsert(payload, { onConflict: "profile_id" });
        if (!res.error) return;
      }
    })(), "player_stats");
}

export function pushSettings(profileId: string, s: Settings): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(
    sb.from("settings").upsert(
      {
        profile_id: profileId,
        daily_goal: s.dailyGoal,
        speech_rate: s.speechRate,
        voice_uri: s.voiceURI ?? null,
        recognition_lang: s.recognitionLang,
        // Persist identity + placement so a fresh device restores them instead
        // of re-running onboarding as if she were brand new.
        student_name: s.studentName ?? null,
        onboarding: s.onboarding ?? null,
        // Preferences that were device-only before: without them a student
        // signing in elsewhere loses her coaching language, her difficulty mode
        // and her sound choice, and the app stops feeling like hers.
        coach_language: s.coachLanguage,
        difficulty: s.difficulty,
        sound_enabled: s.soundEnabled,
        instructor_mode: s.instructorMode,
        updated_at: Date.now(),
      },
      { onConflict: "profile_id" },
    ), "settings");
}

export function pushCustomLesson(lesson: Lesson): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(sb.from("custom_lessons").upsert({ id: lesson.id, data: lesson, order: lesson.order, updated_at: Date.now() }), "custom_lessons");
}

/** Mirror a deliberate delete, or the lesson resurrects on the next pull. */
export function deleteCustomLessonCloud(id: string): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(sb.from("custom_lessons").delete().eq("id", id), "custom_lessons_delete");
}

/**
 * Instructor-authored lessons are shared content: authored on the teacher's
 * device, they must arrive on every student device. This is the read half that
 * pushCustomLesson always needed.
 */
export async function pullCustomLessons(): Promise<Lesson[] | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.from("custom_lessons").select("id,data,order");
  if (!data) return null;
  return data
    .map((r) => r.data as Lesson)
    .filter((l): l is Lesson => Boolean(l && l.id && Array.isArray(l.items)));
}

// ── Pull (cloud → Dexie shapes) for a second device ──────────────────────────

export interface PulledData {
  attempts: Attempt[];
  progress: ItemProgress[];
  player: PlayerStats | null;
}

/** The cloud copy of a profile's synced preferences (null if none saved). */
export interface PulledSettings {
  dailyGoal?: number;
  speechRate?: number;
  voiceURI?: string | null;
  recognitionLang?: string;
  studentName?: string;
  onboarding?: Settings["onboarding"];
  coachLanguage?: Settings["coachLanguage"];
  difficulty?: Settings["difficulty"];
  soundEnabled?: boolean;
  instructorMode?: boolean;
}

export async function pullSettings(profileId: string): Promise<PulledSettings | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb
    .from("settings")
    .select("daily_goal,speech_rate,voice_uri,recognition_lang,student_name,onboarding,coach_language,difficulty,sound_enabled,instructor_mode")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!data) return null;
  return {
    dailyGoal: data.daily_goal ?? undefined,
    speechRate: data.speech_rate ?? undefined,
    voiceURI: data.voice_uri ?? undefined,
    recognitionLang: data.recognition_lang ?? undefined,
    studentName: data.student_name ?? undefined,
    onboarding: (data.onboarding as Settings["onboarding"]) ?? undefined,
    coachLanguage: (data.coach_language as Settings["coachLanguage"]) ?? undefined,
    difficulty: (data.difficulty as Settings["difficulty"]) ?? undefined,
    soundEnabled: data.sound_enabled ?? undefined,
    instructorMode: data.instructor_mode ?? undefined,
  };
}

/**
 * The launch-time refresh payload: player stats + per-item progress only.
 *
 * Deliberately NOT attempts: hydrate runs on every app open, attempts are
 * append-only and grow with every rep, and the hydrate path never used them —
 * so pulling the full history was pure egress that got slower forever. The
 * cold-cache restore (below) is the one place the history is needed.
 */
export async function pullPlayerAndProgress(
  profileId: string,
): Promise<Pick<PulledData, "progress" | "player"> | null> {
  const sb = supabase();
  if (!sb) return null;
  const [progressRes, playerRes] = await Promise.all([
    sb.from("progress").select("*").eq("profile_id", profileId),
    sb.from("player_stats").select("*").eq("profile_id", profileId).maybeSingle(),
  ]);
  return {
    progress: mapProgress(progressRes.data ?? []),
    player: mapPlayer(playerRes.data),
  };
}

export async function pullProfileData(profileId: string): Promise<PulledData | null> {
  const sb = supabase();
  if (!sb) return null;
  const [attemptsRes, progressRes, playerRes] = await Promise.all([
    sb.from("attempts").select("*").eq("profile_id", profileId).order("at", { ascending: true }),
    sb.from("progress").select("*").eq("profile_id", profileId),
    sb.from("player_stats").select("*").eq("profile_id", profileId).maybeSingle(),
  ]);

  const attempts: Attempt[] = (attemptsRes.data ?? []).map((r) => ({
    itemId: r.item_id,
    lessonId: r.lesson_id,
    categoryId: r.category_id,
    phoneme: r.phoneme,
    target: r.target,
    heard: r.heard,
    score: r.score,
    passed: r.passed,
    heardPartner: r.heard_partner,
    at: r.at,
    fluency: r.fluency ?? undefined,
  }));

  return { attempts, progress: mapProgress(progressRes.data ?? []), player: mapPlayer(playerRes.data) };
}

// Row → domain mappers shared by the launch-time and cold-cache pulls, so the
// two paths cannot drift apart column by column. Rows come from the untyped
// supabase client, hence the loose parameter types.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

function mapProgress(rows: Row[]): ItemProgress[] {
  return rows.map((r) => ({
    itemId: r.item_id,
    lessonId: r.lesson_id,
    categoryId: r.category_id,
    phoneme: r.phoneme,
    attempts: r.attempts,
    passes: r.passes,
    box: r.box,
    dueAt: r.due_at,
    lastResult: r.last_result,
    lastScore: r.last_score,
    updatedAt: r.updated_at,
  }));
}

function mapPlayer(pd: Row | null | undefined): PlayerStats | null {
  if (!pd) return null;
  return {
    id: "player",
    xp: pd.xp,
    currentStreak: pd.current_streak,
    longestStreak: pd.longest_streak,
    lastActiveDay: pd.last_active_day,
    todayKey: pd.today_key,
    todayXp: pd.today_xp,
    totalAttempts: pd.total_attempts,
    totalPasses: pd.total_passes,
    bestCombo: pd.best_combo,
    achievements: pd.achievements ?? [],
    stars: pd.stars ?? 0,
    ownedCosmetics: pd.owned_cosmetics ?? [],
    equippedBg: pd.equipped_bg ?? "bg-default",
    equippedAccessory: pd.equipped_accessory ?? "acc-none",
    equippedEffect: pd.equipped_effect ?? "fx-none",
    equippedPet: pd.equipped_pet ?? "pet-none",
    equippedOutfit: pd.equipped_outfit ?? "outfit-default",
    lastChestDay: pd.last_chest_day ?? null,
    streakFreezes: pd.streak_freezes ?? 0,
    freezeUsedDay: pd.freeze_used_day ?? null,
    updatedAt: pd.updated_at,
  };
}

/**
 * Stage-exam sittings and call runs.
 *
 * Both are append-only history rather than mutable state, and both are upserted
 * on their natural key (profile+day for a sitting, profile+at for a call) so a
 * replayed write from a second device cannot duplicate a record. `ignoreDuplicates`
 * keeps the first write authoritative — the sitting she actually sat.
 */
function examRow(profileId: string, e: ExamAttempt) {
  return {
    profile_id: profileId,
    day: e.day,
    at: e.at,
    level: e.level,
    score: e.score,
    passed: e.passed,
    sections: e.sections,
    weakest: e.weakest,
  };
}

export function pushExamAttempt(profileId: string, e: ExamAttempt): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bgDurable(
    sb.from("exam_attempts").upsert(examRow(profileId, e), { onConflict: "profile_id,day", ignoreDuplicates: true }),
    "exam_attempts", "exam", profileId, e);
}

function callRow(profileId: string, c: CallScore) {
  return {
    profile_id: profileId,
    scenario_id: c.scenarioId,
    at: c.at,
    score: c.score,
    checks: c.checks,
  };
}

export function pushCallScore(profileId: string, c: CallScore): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bgDurable(
    sb.from("call_scores").upsert(callRow(profileId, c), { onConflict: "profile_id,at", ignoreDuplicates: true }),
    "call_scores", "call", profileId, c);
}

/** Everything needed to restore her earned band and job-path history on a new device. */
export async function pullExamsAndCalls(
  profileId: string,
): Promise<{ exams: ExamAttempt[]; calls: CallScore[] } | null> {
  const sb = supabase();
  if (!sb) return null;
  const [examRes, callRes] = await Promise.all([
    sb.from("exam_attempts").select("*").eq("profile_id", profileId).order("at", { ascending: false }),
    sb.from("call_scores").select("*").eq("profile_id", profileId).order("at", { ascending: false }),
  ]);
  return {
    exams: (examRes.data ?? []).map((r) => ({
      day: r.day,
      at: Number(r.at),
      level: r.level,
      score: r.score,
      passed: r.passed,
      sections: r.sections ?? {},
      weakest: r.weakest ?? null,
    })),
    calls: (callRes.data ?? []).map((r) => ({
      scenarioId: r.scenario_id,
      at: Number(r.at),
      score: r.score,
      checks: r.checks ?? {},
    })),
  };
}

function talkRow(profileId: string, t: TalkSession) {
  return {
    profile_id: profileId,
    scenario_id: t.scenarioId,
    at: t.at,
    duration_ms: t.durationMs,
    student_turns: t.studentTurns,
    avg_pause_ms: t.avgPauseMs,
    completed: t.completed,
  };
}

export function pushTalkSession(profileId: string, t: TalkSession): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bgDurable(
    sb.from("talk_sessions").upsert(talkRow(profileId, t), { onConflict: "profile_id,at", ignoreDuplicates: true }),
    "talk_sessions", "talk", profileId, t);
}

export async function pullTalkSessions(profileId: string): Promise<TalkSession[] | null> {
  const sb = supabase();
  if (!sb) return null;
  const res = await sb
    .from("talk_sessions")
    .select("*")
    .eq("profile_id", profileId)
    .order("at", { ascending: false });
  return (res.data ?? []).map((r) => ({
    scenarioId: r.scenario_id,
    at: Number(r.at),
    durationMs: Number(r.duration_ms),
    studentTurns: r.student_turns,
    avgPauseMs: r.avg_pause_ms ?? null,
    completed: r.completed,
  }));
}

/**
 * Phrases mined from her live conversations, which feed the review deck as
 * homework. Keyed on (profile, item) so re-saving the same phrase updates rather
 * than duplicating.
 */
export function pushConvItem(profileId: string, c: ConvItem): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(
    sb.from("conv_items").upsert(
      {
        profile_id: profileId,
        item_id: c.id,
        text: c.text,
        meaning: c.meaning ?? null,
        source: c.source ?? null,
        scenario_id: c.scenarioId ?? null,
        created_at_ms: c.createdAt,
      },
      { onConflict: "profile_id,item_id" },
    ), "conv_items");
}

/** Today's quest progress, so it does not reset when she changes device. */
export function pushQuests(profileId: string, q: DailyQuestState): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(
    sb.from("quests").upsert(
      { profile_id: profileId, day: q.day, state: q, updated_at: Date.now() },
      { onConflict: "profile_id,day" },
    ), "quests");
}

function dailySessionArgs(session: DailySession) {
  return {
    p_day: session.day,
    p_version: session.version,
    p_payload: session,
    p_updated_at: session.updatedAt,
  };
}

/**
 * Atomically merge mutable daily state in Postgres; a failed RPC enters the
 * retry outbox. Ownership is derived from auth.uid() inside the function.
 */
export function pushDailySession(profileId: string, session: DailySession): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  if (session.profileId !== profileId) {
    outboxSink?.("daily-session", profileId, session);
    return;
  }
  bgDurable(
    sb.rpc("merge_daily_session", dailySessionArgs(session)),
    "daily_sessions",
    "daily-session",
    profileId,
    session,
  );
}

/** Pull exactly one account-owned day; RLS independently enforces attribution. */
export async function pullDailySession(profileId: string, day: string): Promise<DailySession | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb
    .from("daily_sessions")
    .select("profile_id,day,version,payload,updated_at")
    .eq("profile_id", profileId)
    .eq("day", day)
    .maybeSingle();
  if (!data) return null;
  const payload = data.payload as DailySession;
  if (!payload || payload.profileId !== profileId || payload.day !== day || payload.version !== 1) return null;
  return { ...payload, updatedAt: Math.max(payload.updatedAt, Number(data.updated_at) || 0) };
}

export async function pullConvItemsAndQuests(
  profileId: string,
): Promise<{ convItems: ConvItem[]; quests: DailyQuestState[] } | null> {
  const sb = supabase();
  if (!sb) return null;
  const [ci, q] = await Promise.all([
    sb.from("conv_items").select("*").eq("profile_id", profileId).order("created_at_ms", { ascending: true }),
    sb.from("quests").select("*").eq("profile_id", profileId),
  ]);
  return {
    convItems: (ci.data ?? []).map((r) => ({
      id: r.item_id,
      text: r.text,
      ipa: "",
      mouthHint: "",
      kind: "phrase" as const,
      categoryId: "conversation",
      phoneme: "chunk",
      meaning: r.meaning ?? undefined,
      source: r.source ?? undefined,
      scenarioId: r.scenario_id ?? undefined,
      createdAt: Number(r.created_at_ms),
    })),
    quests: (q.data ?? []).map((r) => r.state as DailyQuestState),
  };
}
