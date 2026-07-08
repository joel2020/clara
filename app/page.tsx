"use client";

import Link from "next/link";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewCallout } from "@/components/review-callout";
import { PlayerBar } from "@/components/player-bar";
import { DailyQuests } from "@/components/daily-quests";
import { Lumi } from "@/components/lumi";
import { EffectLayer } from "@/components/lumi-scene";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { getCosmetic, chestAvailable } from "@/lib/cosmetics";
import { t, type StringKey } from "@/lib/i18n";

// The daily hub. One primary action (Today's session), a compact game HUD, and
// a small games grid — the full curriculum lives on /lessons and the Map, so
// starting today's practice never competes with browsing.

export default function HomePage() {
  const { settings } = useSettings();
  const player = usePlayer();
  const lang = settings.coachLanguage;
  const name = settings.studentName;

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
              {name ? `¡Hola, ${name}!` : "¡Hola!"}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-[1.03] tracking-[-0.03em] sm:text-5xl">
              {t("heroTitleBottom", lang)}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-foreground/70 sm:text-base">{t("heroTagline", lang)}</p>
          </div>

          <div className="relative -mr-2 h-44 w-32 shrink-0 sm:h-56 sm:w-44">
            {accessory?.emoji && (
              <span className="animate-float absolute right-0 top-2 z-10 text-2xl drop-shadow-sm" style={{ animationDelay: "0.4s" }}>
                {accessory.emoji}
              </span>
            )}
            <Lumi frame="full" priority />
          </div>
        </div>
      </section>

      {/* THE action */}
      <Link
        href="/today"
        className="group mt-5 flex items-center gap-4 rounded-3xl bg-foreground px-6 py-5 text-background shadow-sm transition-all hover:opacity-95 active:scale-[0.995]"
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
          <Tile href="/listen" icon={Headphones} label="listenCard" lang={lang} />
          <Tile href="/shadow" icon={Volume2} label="shadowCard" lang={lang} />
          <Tile href="/play" icon={Zap} label="speedRound" lang={lang} />
          <Tile href="/shop" icon={Store} label="shopCard" lang={lang} badge={chestReady} />
          <Tile href="/map" icon={MapIcon} label="mapCard" lang={lang} />
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

function Tile({
  href,
  icon: Icon,
  label,
  lang,
  accent,
  badge,
}: {
  href: string;
  icon: typeof Zap;
  label: StringKey;
  lang: "es" | "en";
  accent?: boolean;
  badge?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-all active:scale-[0.98]",
        accent
          ? "border-primary/30 bg-primary/[0.06] hover:border-primary/60"
          : "border-hairline bg-card hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "grid size-10 place-items-center rounded-xl",
          accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
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
