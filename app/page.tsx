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
  Clapperboard,
  Puzzle,
  Drama,
  Globe,
  Video,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ReviewCallout } from "@/components/review-callout";
import { PlayerBar } from "@/components/player-bar";
import { DailyQuests } from "@/components/daily-quests";
import { LumiDepth } from "@/components/lumi-depth";
import { EffectLayer } from "@/components/lumi-scene";
import { SceneArt } from "@/components/scene-art";
import { AmbientStars } from "@/components/juice";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { getCosmetic, chestAvailable } from "@/lib/cosmetics";
import { t, type StringKey } from "@/lib/i18n";

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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background/80 via-background/40 to-transparent" aria-hidden />

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
            <LumiDepth priority />
          </div>
        </div>
      </section>

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

      <Link
        href="/media"
        className="group relative mt-4 flex min-h-40 overflow-hidden rounded-3xl bg-[#0b2d78] p-5 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.995] sm:min-h-44 sm:p-6"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_22%,rgba(255,211,69,0.42),transparent_20%),radial-gradient(circle_at_88%_75%,rgba(218,42,50,0.32),transparent_25%),linear-gradient(118deg,#06183f_0%,#0b2d78_54%,#1450b4_100%)]" />
        <span className="absolute -right-5 top-2 text-8xl opacity-10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6" aria-hidden>✦</span>
        <div className="relative z-10 flex w-full items-end justify-between gap-4">
          <div className="max-w-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <Sparkles className="size-3.5 text-co-yellow" />
              {lang === "es" ? "10 minutos · sin presión" : "10 minutes · no pressure"}
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-[1.02] tracking-[-0.025em] sm:text-3xl">
              {lang === "es" ? "Mira inglés. Luego dilo." : "Watch English. Then say it."}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              {lang === "es" ? "Videos reales, frases que sirven y música cuando ganas." : "Real videos, useful phrases, and music when you win."}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
              {lang === "es" ? "Ver el reto de hoy" : "Watch today’s challenge"} <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/10 backdrop-blur-sm">
            <Video className="size-5" />
          </span>
        </div>
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

      <section className="mt-8">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em]">{t("homeGames", lang)}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Tile href="/talk" icon={MessageCircle} label="navTalk" lang={lang} accent />
          <Tile href="/duet" icon={Drama} label="duetCard" lang={lang} />
          <Tile href="/media" icon={Clapperboard} label="mediaCard" lang={lang} />
          <Tile href="/listen" icon={Headphones} label="listenCard" lang={lang} />
          <Tile href="/shadow" icon={Volume2} label="shadowCard" lang={lang} />
          <Tile href="/build" icon={Puzzle} label="buildCard" lang={lang} />
          <Tile href="/play" icon={Zap} label="speedRound" lang={lang} />
          <Tile href="/shop" icon={Store} label="shopCard" lang={lang} badge={chestReady} />
          <Tile href="/map" icon={MapIcon} label="mapCard" lang={lang} />
          <Tile href="/mundo" icon={Globe} label="mundoNav" lang={lang} />
        </div>
      </section>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/lessons" className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{t("lessonsHeading", lang)}</p>
            <p className="text-sm text-muted-foreground">{t("lessonsCardSub", lang)}</p>
          </div>
        </Link>
        <Link href="/plan" className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
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
        "group relative flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center active:scale-[0.98]",
        accent ? "border border-primary/30 bg-primary/[0.06] card-lift hover:border-primary/60" : "rim-tricolor card-lift",
      )}
    >
      <span className={cn("grid size-10 place-items-center rounded-xl", accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
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
