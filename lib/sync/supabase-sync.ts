"use client";

import { supabase, syncEnabled } from "@/lib/db/supabase";
import type { Attempt, ItemProgress, PlayerStats, Settings, Lesson } from "@/lib/db/types";

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

/** Fire-and-forget: never let a sync failure surface to the learner. */
function bg(p: PromiseLike<unknown> | undefined): void {
  void Promise.resolve(p).catch(() => {});
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

export function pushAttempt(profileId: string, a: Attempt): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(
    sb.from("attempts").insert({
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
      at: a.at,
    }),
  );
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
    ),
  );
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
  bg(
    (async () => {
      const full = await sb.from("player_stats").upsert({ ...base, ...economy }, { onConflict: "profile_id" });
      // Older cloud schemas lack the economy columns (PostgREST rejects the
      // whole row) — fall back to the base fields so core progress still syncs.
      if (full.error) await sb.from("player_stats").upsert(base, { onConflict: "profile_id" });
    })(),
  );
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
        updated_at: Date.now(),
      },
      { onConflict: "profile_id" },
    ),
  );
}

export function pushCustomLesson(lesson: Lesson): void {
  const sb = supabase();
  if (!ok() || !sb) return;
  bg(sb.from("custom_lessons").upsert({ id: lesson.id, data: lesson, order: lesson.order, updated_at: Date.now() }));
}

// ── Pull (cloud → Dexie shapes) for a second device ──────────────────────────

export interface PulledData {
  attempts: Attempt[];
  progress: ItemProgress[];
  player: PlayerStats | null;
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
  }));

  const progress: ItemProgress[] = (progressRes.data ?? []).map((r) => ({
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

  const pd = playerRes.data;
  const player: PlayerStats | null = pd
    ? {
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
        lastChestDay: pd.last_chest_day ?? null,
        streakFreezes: pd.streak_freezes ?? 0,
        freezeUsedDay: pd.freeze_used_day ?? null,
        updatedAt: pd.updated_at,
      }
    : null;

  return { attempts, progress, player };
}
