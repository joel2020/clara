"use client";

import Link from "next/link";
import { ArrowLeft, Flame, Star, RefreshCw } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useAuth } from "@/lib/hooks/useAuth";
import { levelForXp } from "@/lib/gamification";
import { GOALS } from "@/lib/onboarding";
import { levelBlurbEs } from "@/lib/onboarding";

// The learner's profile: who they are, their English level, and their momentum.
// Reads the onboarding record + live player stats. A "retake placement" button
// clears the onboarding record so the adaptive check runs again.

export default function ProfilePage() {
  const { settings, update } = useSettings();
  const { required: authOn, user, signOut } = useAuth();
  const player = usePlayer();
  const ob = settings.onboarding;
  const lang = settings.coachLanguage;

  const goalEs = ob ? GOALS.find((g) => g.id === ob.goal)?.es ?? "—" : "—";
  const xpLevel = player ? levelForXp(player.xp) : 1;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-6 sm:px-6 sm:pt-10">
      <Link href="/today" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {lang === "es" ? "Volver" : "Back"}
      </Link>

      <header className="flex items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-2xl text-primary">
          {(settings.studentName ?? "C").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold">{settings.studentName ?? "Clara"}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {ob ? `${ob.city}, ${ob.country}` : "Colombia"}{authOn && user?.email ? ` · ${user.email}` : ""}
          </p>
        </div>
      </header>

      {/* English level */}
      {ob && (
        <section className="mt-6 rounded-3xl border border-hairline bg-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {lang === "es" ? "Tu nivel de inglés" : "Your English level"}
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-display text-4xl font-semibold">{ob.level}</span>
            <span className="text-sm text-muted-foreground">{levelBlurbEs(ob.level).title}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {lang === "es" ? "Meta" : "Goal"}: <span className="text-foreground">{goalEs}</span> ·{" "}
            {lang === "es" ? "Ritmo" : "Pace"}: <span className="text-foreground">{ob.dailyMinutes} min/día</span>
          </p>
        </section>
      )}

      {/* momentum */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        <Stat icon={<Star className="size-4 text-primary" />} value={player?.stars ?? 0} label={lang === "es" ? "Estrellas" : "Stars"} />
        <Stat icon={<Flame className="size-4 text-primary" />} value={player?.currentStreak ?? 0} label={lang === "es" ? "Racha" : "Streak"} />
        <Stat value={`Nv ${xpLevel}`} label={`${player?.xp ?? 0} XP`} />
      </section>

      {/* actions */}
      <section className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => void update({ onboarding: undefined })}
          className="flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-card px-5 py-3.5 text-sm font-medium transition-colors hover:border-primary/40"
        >
          <RefreshCw className="size-4" /> {lang === "es" ? "Volver a hacer la prueba de nivel" : "Retake placement"}
        </button>
        <Link href="/settings" className="rounded-2xl border border-hairline bg-card px-5 py-3.5 text-center text-sm font-medium transition-colors hover:border-foreground/30">
          {lang === "es" ? "Ajustes" : "Settings"}
        </Link>
        {authOn && (
          <button type="button" onClick={() => void signOut()} className="rounded-2xl px-5 py-3 text-sm text-muted-foreground hover:text-foreground">
            {lang === "es" ? "Cerrar sesión" : "Sign out"}
          </button>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon?: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-card p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 font-display text-2xl font-semibold">
        {icon}
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
