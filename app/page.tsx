"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  Zap,
  CalendarDays,
  MessageCircle,
  PhoneCall,
  Store,
  Volume2,
  Map as MapIcon,
  Headphones,
  BookOpen,
  Clapperboard,
  Puzzle,
  Drama,
  Globe,
  Radio,
  ChevronDown,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { ReviewCallout } from "@/components/review-callout";
import { PlayerBar } from "@/components/player-bar";
import { DailyQuests } from "@/components/daily-quests";
import { CharacterIllustration } from "@/components/character";
import { EffectLayer } from "@/components/lumi-scene";
import { SceneArt } from "@/components/scene-art";
import { SceneVideo } from "@/components/scene-video";
import { InstallNudge } from "@/components/install-nudge";
import { PetSprite } from "@/components/pet-sprite";
import { useSettings } from "@/lib/hooks/useSettings";
import { pathOf } from "@/lib/paths";
import { ReadinessCard } from "@/components/readiness-card";
import { TodaySessionCard } from "@/components/today-session-card";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { getCosmetic, chestAvailable } from "@/lib/cosmetics";
import { timeGreetingKey } from "@/lib/greeting";
import { t, type StringKey } from "@/lib/i18n";

// The daily hub. One primary action (Today's session), a compact game HUD, and
// a small games grid — the full curriculum lives on /lessons and the Map, so
// starting today's practice never competes with browsing.

export default function HomePage() {
  const { settings } = useSettings();
  const player = usePlayer();
  const lang = settings.coachLanguage;
  const path = pathOf(settings.onboarding);
  const name = settings.studentName;

  // Time-aware greeting, resolved on the client so the prerendered page and her
  // device clock never disagree (avoids a hydration mismatch). Starts null →
  // plain "¡Hola!" for the first paint, then warms up to "Buenas tardes".
  const greetKey = useSyncExternalStore(
    () => () => {},
    () => timeGreetingKey(new Date().getHours()),
    () => null,
  );
  const greeting = greetKey
    ? t(greetKey === "morning" ? "greetMorning" : greetKey === "afternoon" ? "greetAfternoon" : "greetEvening", lang)
    : "¡Hola!";
  const streak = player?.currentStreak ?? 0;
  const [showMore, setShowMore] = useState(false);

  const bg = getCosmetic(player?.equippedBg ?? "bg-default");
  // Only show a scene background when she has purchased + equipped one. The
  // default is a calm, premium gradient — no always-on video, no confetti.
  const hasCosmeticBg = !!(
    player?.equippedBg &&
    player.equippedBg !== "bg-default" &&
    (bg?.video || bg?.background)
  );
  const accessory = getCosmetic(player?.equippedAccessory ?? "acc-none");
  const effect = getCosmetic(player?.equippedEffect ?? "fx-none");
  const chestReady = player ? chestAvailable(player) : false;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:px-6 sm:pt-10">
      {/* Hero — Lumi on her equipped stage */}
      <section
        className={cn(
          "animate-fade-up relative overflow-hidden rounded-3xl px-5 pb-0 pt-5 elev-1 sm:px-8 sm:pt-8",
          !hasCosmeticBg && "hero-calm",
        )}
        style={hasCosmeticBg && bg?.background ? { background: bg.background } : undefined}
      >
        <div className="flag-bar absolute inset-x-0 top-0 z-20 h-[3px]" aria-hidden />
        {/* A purchased cinematic loop or SVG scene — only when equipped. The
            default hero is the calm gradient above, not an always-on video. */}
        {hasCosmeticBg &&
          (bg?.video ? (
            <SceneVideo base={bg.video} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <SceneArt bgId={bg.id} />
          ))}
        {effect?.effect && <EffectLayer kind={effect.effect} />}
        {/* Text-protection scrim: only needed over a busy equipped scene so the
            greeting stays readable (e.g. the near-black Galaxy background). */}
        {hasCosmeticBg && (
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent"
            aria-hidden
          />
        )}

        <div className="relative z-10 flex items-end justify-between gap-3">
          <div className="max-w-[64%] pb-5">
            <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
              <span className="flag-dots" aria-hidden>
                <i /><i /><i />
              </span>
              {name ? `${greeting}, ${name}` : greeting}
            </p>
            <h1 lang="en" className="mt-2 font-display text-2xl font-semibold leading-[1.03] tracking-[-0.03em] sm:mt-3 sm:text-5xl">
              {t("heroTitleBottom", lang)}
            </h1>
            <p className="mt-2 text-sm leading-snug text-foreground/70 sm:mt-3 sm:leading-relaxed sm:text-base">
              {streak > 1 ? t("heroStreakLine", lang).replace("{n}", String(streak)) : t("heroTagline", lang)}
            </p>
          </div>

          <div className="relative -mr-2 h-32 w-24 shrink-0 sm:h-56 sm:w-44">
            {/* Soft ground contact shadow so Lumi stands on the hero rather than
                floating pasted over it. */}
            <span
              className="pointer-events-none absolute bottom-1 left-1/2 h-2.5 w-[58%] -translate-x-1/2 rounded-[100%] bg-black/20 blur-[6px]"
              aria-hidden
            />
            {accessory?.emoji && (
              <span
                className="animate-float absolute right-0 top-2 z-10 grid size-9 place-items-center rounded-full bg-white/60 text-xl ring-1 ring-black/5 backdrop-blur-sm drop-shadow-sm"
                style={{ animationDelay: "0.4s" }}
              >
                {accessory.emoji}
              </span>
            )}
            {/* Keep Lumi crisp and single-layered. The former WebGL depth
                shader displaced different parts of the flat illustration and
                visibly duplicated her face and body on production devices. */}
            <CharacterIllustration mode="full" mood="wave" priority className="lumi-3d" />
            <PetSprite petId={player?.equippedPet} className="absolute -left-8 bottom-1 z-10 sm:-left-10" />
          </div>
        </div>
      </section>

      <TodaySessionCard />

      {/* The destination: one number, its trend, and the single blocker. This is
          the spine of the app — everything below is how she moves it. */}
      <div className="mt-5">
        <ReadinessCard />
      </div>

      <div className="mt-4">
        <ReviewCallout />
      </div>

      <div className="mt-4">
        <DailyQuests />
      </div>

      <div className="mt-4">
        <PlayerBar />
      </div>

      <InstallNudge />

      {/* The one high-value secondary action: talk to Joel — the thing that
          actually builds conversation. On the job path it is framed as a call,
          because that is the moment she is training for. */}
      <Link
        href={path === "job" ? "/call" : "/talk"}
        onClick={() => track("mode_open", { mode: path === "job" ? "call" : "talk" })}
        className="group mt-4 flex items-center gap-4 rounded-3xl border border-primary/30 bg-primary/[0.06] px-6 py-5 transition-all card-lift hover:border-primary/60"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          {path === "job" ? <PhoneCall className="size-6" /> : <MessageCircle className="size-6" />}
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold tracking-[-0.01em]">
            {path === "job" ? (lang === "es" ? "Llamada" : "Call") : t("navTalk", lang)}
          </p>
          <p className="text-sm text-muted-foreground">
            {path === "job"
              ? lang === "es"
                ? "Atiende a un cliente en inglés, con Joel."
                : "Handle a customer in English, with Joel."
              : lang === "es"
                ? "Practica una conversación real con Joel."
                : "Practice a real conversation with Joel."}
          </p>
        </div>
        <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
      </Link>

      {/* Everything else, tucked away so the daily path stays clear */}
      <section className="mt-8">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-card px-5 py-4 text-left transition-colors hover:border-primary/40"
        >
          <span className="font-display text-sm font-semibold uppercase tracking-[0.16em]">{t("homeExplore", lang)}</span>
          <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", showMore && "rotate-180")} />
        </button>

        {showMore && (
          <div className="animate-fade-up">
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Tile href="/duet" icon={Drama} label="duetCard" lang={lang} />
              <Tile href="/media" icon={Clapperboard} label="mediaCard" lang={lang} />
              <Tile href="/listen" icon={Headphones} label="listenCard" lang={lang} />
              <Tile href="/shadow" icon={Volume2} label="shadowCard" lang={lang} />
              <Tile href="/build" icon={Puzzle} label="buildCard" lang={lang} />
              <Tile href="/play" icon={Zap} label="speedRound" lang={lang} />
              <Tile href="/shop" icon={Store} label="shopCard" lang={lang} badge={chestReady} />
              <Tile href="/radio" icon={Radio} label="radioCard" lang={lang} />
              <Tile href="/map" icon={MapIcon} label="mapCard" lang={lang} />
              <Tile href="/mundo" icon={Globe} label="mundoNav" lang={lang} />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/lessons"
                className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="size-5" />
                </span>
                <div className="flex-1">
                  <p className="font-medium">{t("lessonsHeading", lang)}</p>
                  <p className="text-sm text-muted-foreground">{t("lessonsCardSub", lang)}</p>
                </div>
              </Link>
              <Link
                href="/plan"
                className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <CalendarDays className="size-5" />
                </span>
                <div className="flex-1">
                  <p className="font-medium">{t("planCard", lang)}</p>
                  <p className="text-sm text-muted-foreground">{t("planCardSub", lang)}</p>
                </div>
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// One calm tile treatment across the whole grid — a single restrained accent
// (the primary blue) instead of a rotating tricolor set, so the grid reads as
// one deliberate family. Red is reserved for the functional "new" badge only.
function Tile({
  href,
  icon: Icon,
  label,
  lang,
  badge,
}: {
  href: string;
  icon: typeof Zap;
  label: StringKey;
  lang: "es" | "en";
  badge?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-center gap-2 rounded-2xl border border-hairline bg-card px-3 py-4 text-center card-lift hover:border-primary/40 active:scale-[0.98]"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <span className="text-xs font-medium leading-tight">{t(label, lang)}</span>
      {badge && (
        <span className="absolute right-2.5 top-2.5 grid size-4 place-items-center rounded-full bg-co-red text-[9px] font-bold text-white shadow-sm" aria-hidden>
          1
        </span>
      )}
    </Link>
  );
}
