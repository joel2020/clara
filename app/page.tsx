"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Zap,
  CalendarDays,
  MessageCircle,
  Store,
  PlayCircle,
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
import { LumiDepth } from "@/components/lumi-depth";
import { EffectLayer } from "@/components/lumi-scene";
import { SceneArt } from "@/components/scene-art";
import { SceneVideo } from "@/components/scene-video";
import { InstallNudge } from "@/components/install-nudge";
import { PetSprite } from "@/components/pet-sprite";
import { useSettings } from "@/lib/hooks/useSettings";
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
  const name = settings.studentName;

  // Time-aware greeting, resolved on the client so the prerendered page and her
  // device clock never disagree (avoids a hydration mismatch). Starts null →
  // plain "¡Hola!" for the first paint, then warms up to "Buenas tardes".
  const [greetKey, setGreetKey] = useState<"morning" | "afternoon" | "evening" | null>(null);
  useEffect(() => {
    setGreetKey(timeGreetingKey(new Date().getHours()));
  }, []);
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
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-6 sm:px-6 sm:pt-10">
      {/* Hero — Lumi on her equipped stage */}
      <section
        className={cn(
          "animate-fade-up relative overflow-hidden rounded-3xl px-6 pb-0 pt-6 elev-1 sm:px-8 sm:pt-8",
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
          <div className="max-w-[58%] pb-7">
            <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
              <span className="flag-dots" aria-hidden>
                <i /><i /><i />
              </span>
              {name ? `${greeting}, ${name}` : greeting}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.03] tracking-[-0.03em] sm:text-5xl">
              {t("heroTitleBottom", lang)}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70 sm:text-base">
              {streak > 1 ? t("heroStreakLine", lang).replace("{n}", String(streak)) : t("heroTagline", lang)}
            </p>
          </div>

          <div className="relative -mr-2 h-44 w-32 shrink-0 sm:h-56 sm:w-44">
            {accessory?.emoji && (
              <span className="animate-float absolute right-0 top-2 z-10 text-2xl drop-shadow-sm" style={{ animationDelay: "0.4s" }}>
                {accessory.emoji}
              </span>
            )}
            <LumiDepth priority />
            <PetSprite petId={player?.equippedPet} className="absolute -left-8 bottom-1 z-10 sm:-left-10" />
          </div>
        </div>
      </section>

      <InstallNudge />

      {/* THE action */}
      <Link
        href="/today"
        className="sheen group mt-5 flex items-center gap-4 rounded-3xl bg-primary px-6 py-5 text-primary-foreground elev-1 transition-all hover:opacity-95 active:scale-[0.995]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary-foreground/15">
          <PlayCircle className="size-6" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold tracking-[-0.01em]">{t("todayCard", lang)}</p>
          <p className="text-sm text-primary-foreground/70">{t("todayCardSub", lang)}</p>
        </div>
        <span className="text-primary-foreground/60 transition-transform group-hover:translate-x-0.5">→</span>
      </Link>

      <div className="mt-5">
        <PlayerBar />
      </div>

      <div className="mt-4">
        <DailyQuests />
      </div>

      <div className="mt-4">
        <ReviewCallout />
      </div>

      {/* The one high-value secondary action: talk to Joel — the thing that
          actually builds conversation. Everything else waits behind "explore". */}
      <Link
        href="/talk"
        onClick={() => track("mode_open", { mode: "talk" })}
        className="group mt-4 flex items-center gap-4 rounded-3xl border border-primary/30 bg-primary/[0.06] px-6 py-5 transition-all card-lift hover:border-primary/60"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <MessageCircle className="size-6" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold tracking-[-0.01em]">{t("navTalk", lang)}</p>
          <p className="text-sm text-muted-foreground">
            {lang === "es" ? "Practica una conversación real con Joel." : "Practice a real conversation with Joel."}
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
