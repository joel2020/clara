"use client";

import Link from "next/link";
import { Zap, CalendarDays, MessageCircle, Star } from "lucide-react";
import { LessonList } from "@/components/lesson-list";
import { ReviewCallout } from "@/components/review-callout";
import { InstructorEntry } from "@/components/instructor-entry";
import { PlayerBar } from "@/components/player-bar";
import { DailyQuests } from "@/components/daily-quests";
import { Lumi } from "@/components/lumi";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

export default function HomePage() {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const name = settings.studentName;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:px-6 sm:pt-20">
      <section className="game-hero animate-fade-up relative overflow-hidden rounded-3xl px-6 pb-0 pt-6 shadow-sm ring-1 ring-black/5 sm:px-8 sm:pt-8">
        <div className="flag-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />
        {/* floating stars */}
        <span className="pointer-events-none absolute right-[42%] top-6 text-co-yellow animate-float" aria-hidden style={{ animationDelay: "0.2s" }}>
          <Star className="size-4" style={{ fill: "currentColor" }} strokeWidth={0} />
        </span>
        <span className="pointer-events-none absolute right-[36%] top-20 text-white/80 animate-float" aria-hidden style={{ animationDelay: "0.9s" }}>
          <Star className="size-3" style={{ fill: "currentColor" }} strokeWidth={0} />
        </span>

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

          {/* Lumi waves from the corner */}
          <div className="relative -mr-2 h-44 w-32 shrink-0 sm:h-56 sm:w-44">
            <Lumi frame="full" priority />
          </div>
        </div>
      </section>

      <div className="mt-10">
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
