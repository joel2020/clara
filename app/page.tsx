"use client";

import Link from "next/link";
import { Zap, CalendarDays, MessageCircle, Store, PlayCircle, Volume2, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { LessonList } from "@/components/lesson-list";
import { ReviewCallout } from "@/components/review-callout";
import { InstructorEntry } from "@/components/instructor-entry";
import { PlayerBar } from "@/components/player-bar";
import { DailyQuests } from "@/components/daily-quests";
import { Lumi } from "@/components/lumi";
import { EffectLayer } from "@/components/lumi-scene";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { getCosmetic } from "@/lib/cosmetics";
import { chestAvailable } from "@/lib/cosmetics";
import { t } from "@/lib/i18n";

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
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6 sm:pt-20">
      <section
        className={cn(
          "animate-fade-up relative overflow-hidden rounded-3xl px-6 pb-0 pt-6 shadow-sm ring-1 ring-black/5 sm:px-8 sm:pt-8",
          !bg?.background && "game-hero",
        )}
        style={bg?.background ? { background: bg.background } : undefined}
      >
        <div className="flag-bar absolute inset-x-0 top-0 z-20 h-[3px]" aria-hidden />
        {effect?.effect && <EffectLayer kind={effect.effect} />}

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

          {/* Lumi waves from the corner, wearing her equipped accessory */}
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

      <Link
        href="/today"
        className="group mt-6 flex items-center gap-4 rounded-3xl bg-foreground px-6 py-5 text-background shadow-sm transition-all hover:opacity-95 active:scale-[0.995]"
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

      <div className="mt-6">
        <PlayerBar />
      </div>

      <div className="mt-4">
        <DailyQuests />
      </div>

      <Link
        href="/talk"
        className="group mt-4 flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/[0.06] px-5 py-5 transition-colors hover:border-primary/60"
      >
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <MessageCircle className="size-6" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-medium tracking-[-0.01em]">{t("talkCard", lang)}</p>
          <p className="text-sm text-muted-foreground">{t("talkCardSub", lang)}</p>
        </div>
      </Link>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReviewCallout />
        <Link
          href="/play"
          className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Zap className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{t("speedRound", lang)}</p>
            <p className="text-sm text-muted-foreground">{t("speedRoundSub", lang)}</p>
          </div>
        </Link>
        <Link
          href="/shop"
          className="group relative flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
        >
          <span className="star-chip grid size-10 shrink-0 place-items-center rounded-xl shadow-sm">
            <Store className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{t("shopCard", lang)}</p>
            <p className="text-sm text-muted-foreground">{t("shopCardSub", lang)}</p>
          </div>
          {chestReady && (
            <span className="absolute right-4 top-3 grid size-5 place-items-center rounded-full bg-co-red text-[10px] font-bold text-white shadow-sm" aria-hidden>
              1
            </span>
          )}
        </Link>
        <Link
          href="/shadow"
          className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Volume2 className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{t("shadowCard", lang)}</p>
            <p className="text-sm text-muted-foreground">{t("shadowCardSub", lang)}</p>
          </div>
        </Link>
        <Link
          href="/map"
          className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MapIcon className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium">{t("mapCard", lang)}</p>
            <p className="text-sm text-muted-foreground">{t("mapCardSub", lang)}</p>
          </div>
        </Link>
        <Link
          href="/plan"
          className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card px-5 py-4 transition-colors hover:border-primary/40 sm:col-span-2"
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

      <section className="mt-14">
        <div className="border-b border-hairline pb-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
            {t("trackConversation", lang)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("trackConversationSub", lang)}</p>
        </div>
        <LessonList track="conversation" />
      </section>

      <section className="mt-14">
        <div className="border-b border-hairline pb-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
            {t("trackSounds", lang)}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("trackSoundsSub", lang)}</p>
        </div>
        <LessonList track="sounds" />
      </section>

      <InstructorEntry />
    </div>
  );
}
