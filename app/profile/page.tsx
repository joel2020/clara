"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Flame, Star, RefreshCw, Shirt } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useAuth } from "@/lib/hooks/useAuth";
import { levelForXp } from "@/lib/gamification";
import { GOALS } from "@/lib/onboarding";
import { levelBlurbEs } from "@/lib/onboarding";
import { pathOf } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { CharacterIllustration } from "@/components/character";
import { getCosmetic } from "@/lib/cosmetics";

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
  const equippedLook = getCosmetic(player?.equippedOutfit)?.name[lang]
    ?? (lang === "es" ? "Clásico" : "Classic");

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

      <Link
        href="/shop"
        className="group mt-6 grid min-h-28 grid-cols-[5.5rem_1fr_auto] items-center gap-4 overflow-hidden rounded-3xl border border-primary/25 bg-primary/[0.05] p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <CharacterIllustration mode="bust" mood="wave" className="size-20" priority />
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            <Shirt className="size-3.5" aria-hidden />
            Lumi City Remix
          </span>
          <h2 className="mt-1 font-display text-xl font-semibold">
            {lang === "es" ? "El clóset de Lumi" : "Lumi’s Closet"}
          </h2>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {equippedLook} · {player?.stars ?? 0} ★
          </p>
        </div>
        <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden />
      </Link>

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

      {/* learning path — changeable, and switching never touches her progress */}
      {ob && (
        <section className="mt-4 rounded-3xl border border-hairline bg-card p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {lang === "es" ? "Tu camino" : "Your path"}
          </p>
          <div className="mt-3 grid gap-3">
            {(
              [
                {
                  id: "job" as const,
                  title: lang === "es" ? "Para trabajar" : "To work",
                  blurb:
                    lang === "es"
                      ? "Inglés para soporte y servicio al cliente. Meta: nivel B2 comprobado."
                      : "English for support and customer service. Target: B2, evidenced.",
                },
                {
                  id: "general" as const,
                  title: lang === "es" ? "Para hablar con confianza" : "To speak with confidence",
                  blurb:
                    lang === "es"
                      ? "Conversar sin bloquearte. Meta: una charla de 10 minutos sin trabarte."
                      : "Converse without freezing. Target: a 10-minute chat without stalling.",
                },
              ] as const
            ).map((p) => {
              const active = pathOf(ob) === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => void update({ onboarding: { ...ob, path: p.id } })}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
                    active ? "border-primary bg-primary/[0.06]" : "border-hairline hover:border-foreground/30",
                  )}
                >
                  <span className={cn("font-display text-lg", active && "text-primary")}>{p.title}</span>
                  <span className="mt-1 block text-sm leading-snug text-muted-foreground">{p.blurb}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {lang === "es"
              ? "Cambiar de camino no borra nada: tus estrellas, tu racha y tus frases se quedan."
              : "Switching paths erases nothing: your stars, streak and phrases stay."}
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
