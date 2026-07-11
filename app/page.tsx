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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewCallout } from "@/components/review-callout";
import { PlayerBar } from "@/components/player-bar";
import { DailyQuests } from "@/components/daily-quests";
import { LumiDepth } from "@/components/lumi-depth";
import { EffectLayer } from "@/components/lumi-scene";
import { SceneArt } from "@/components/scene-art";
import { InstallNudge } from "@/components/install-nudge";
import { PetSprite } from "@/components/pet-sprite";
import { AmbientStars } from "@/components/juice";
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

  const bg = getCosmetic(player?.equippedBg ?? "bg-default");
  const accessory = getCosmetic(player?.equippedAccessory ?? "acc-none");
  const effect = getCosmetic(player?.equippedEffect ?? "fx-none");
  const chestReady = player ? chestAvailable(player) : false;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-6 sm:px-6 sm:pt-10">
      {/* Hero — Lumi on her equipped stage */}
      <section
        className={cn(
          "animate-fade-up relative overflow-hidden rounded-3xl px-6 pb-0 pt-6 shadow-sm ring-1 ring-black/5 sm:px-8 sm:pt-8",
          !bg?.background && "game-hero",
        )}
        style={bg?.background ? { background: bg.background } : undefined}
      >
        <div className="flag-bar absolute inset-x-0 top-0 z-20 h-[3px]" aria-hidden />
        {bg && <SceneArt bgId={bg.id} />}
        <AmbientStars />
        {effect?.effect && <EffectLayer kind={effect.effect} />}
        {/* Text-protection scrim: keeps the greeting readable over ANY equipped
            background (Galaxy is nearly black). Uses the theme background color
            so it adapts to dark mode too. */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent"
          aria-hidden
        />

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
        className="sheen group mt-5 flex items-center gap-4 rounded-3xl bg-foreground px-6 py-5 text-background shadow-sm transition-all hover:opacity-95 active:scale-[0.995]"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-background/15">
          <PlayCircle className="size-6" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold tracking-[-0.01em]">{t("todayCard", lang)}</p>
          <p className="text-sm text-background/70">{t("todayCardSub", lang)}</p>
        </div>
        <span className="text-background/60 transition-transform group-hover:translate-x-0.5">→</span>
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

      {/* Games & places — compact grid, one tap each */}
      <section className="mt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em]">{t("homeGames", lang)}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Tile href="/talk" icon={MessageCircle} label="navTalk" lang={lang} accent />
          <Tile href="/duet" icon={Drama} label="duetCard" lang={lang} tone="gold" />
          <Tile href="/media" icon={Clapperboard} label="mediaCard" lang={lang} tone="red" />
          <Tile href="/listen" icon={Headphones} label="listenCard" lang={lang} tone="blue" />
          <Tile href="/shadow" icon={Volume2} label="shadowCard" lang={lang} tone="gold" />
          <Tile href="/build" icon={Puzzle} label="buildCard" lang={lang} tone="red" />
          <Tile href="/play" icon={Zap} label="speedRound" lang={lang} tone="gold" />
          <Tile href="/shop" icon={Store} label="shopCard" lang={lang} badge={chestReady} tone="red" />
          <Tile href="/radio" icon={Radio} label="radioCard" lang={lang} tone="blue" />
          <Tile href="/map" icon={MapIcon} label="mapCard" lang={lang} tone="gold" />
          <Tile href="/mundo" icon={Globe} label="mundoNav" lang={lang} tone="red" />
        </div>
      </section>

      {/* Browse links */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
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
  );
}

// Tricolor icon chips — each game tile carries one of the flag's colors so the
// grid reads as one Colombian set instead of a wall of identical blue.
const TILE_CHIP = {
  blue: "bg-primary/10 text-primary",
  gold: "bg-[color-mix(in_oklch,var(--co-yellow)_22%,transparent)] text-[color-mix(in_oklch,var(--co-yellow)_60%,#7a5a10)]",
  red: "bg-[color-mix(in_oklch,var(--co-red)_12%,transparent)] text-co-red",
} as const;

function Tile({
  href,
  icon: Icon,
  label,
  lang,
  accent,
  badge,
  tone = "blue",
}: {
  href: string;
  icon: typeof Zap;
  label: StringKey;
  lang: "es" | "en";
  accent?: boolean;
  badge?: boolean;
  tone?: keyof typeof TILE_CHIP;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center active:scale-[0.98]",
        accent ? "border border-primary/30 bg-primary/[0.06] card-lift hover:border-primary/60" : "rim-tricolor card-lift",
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          accent ? "bg-primary text-primary-foreground" : TILE_CHIP[tone],
        )}
      >
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
