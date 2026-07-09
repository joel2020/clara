"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles, MessageCircle, Check, Star, Flame, Gift, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useAllProgress, useProgressMap, useConvItems, useTodayQuests } from "@/lib/hooks/useData";
import { countDueReview } from "@/lib/review";
import { pickNextLesson, pickScenario } from "@/lib/today";
import { dayKey } from "@/lib/gamification";
import { questDone } from "@/lib/quests";
import { chestAvailable, chestReward } from "@/lib/cosmetics";
import { t } from "@/lib/i18n";
import { Lumi } from "@/components/lumi";
import { SparkleBurst } from "@/components/star-reward";
import { celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { cinematic } from "@/components/cinematic";
import { Splash } from "@/components/splash";

// The guided daily session: warm up → learn → talk, drawn as a little quest
// path that ends in the daily chest. This is the coach's "here's what we're
// doing today" — the app leading a solo learner through a complete, sized
// daily routine instead of leaving her to decide.

// A rotating daily word from the coach — tiny, warm, different each day.
const COACH_MSGS = {
  es: [
    "Hoy hablamos con calma y claro. ¡Tú puedes!",
    "Quince minuticos hoy valen más que una hora el domingo.",
    "Tu boca aprende repitiendo. Vamos paso a paso.",
    "Cada frase de hoy es una que ya no te va a faltar.",
    "Respira, sonríe y dilo a tu manera. ¡Empezamos!",
  ],
  en: [
    "Today we speak calm and clear. You've got this!",
    "Fifteen little minutes today beat an hour on Sunday.",
    "Your mouth learns by repeating. Step by step.",
    "Every phrase today is one you'll never be missing again.",
    "Breathe, smile, and say it your way. Let's go!",
  ],
};

export default function TodayPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const player = usePlayer();
  const progressArr = useAllProgress();
  const progressMap = useProgressMap();
  const convItems = useConvItems();
  const quests = useTodayQuests();

  const dueCount = progressArr && convItems ? countDueReview(progressArr, convItems) : 0;
  const nextLesson = pickNextLesson(progressMap);
  const scenario = pickScenario(dayKey());

  const reviewDone = quests ? questDone(quests, "review") || dueCount === 0 : false;
  const learnDone = quests ? questDone(quests, "learn") : false;
  const talkDone = quests ? questDone(quests, "talk") : false;
  const allDone = reviewDone && learnDone && talkDone;

  useEffect(() => {
    if (allDone) {
      celebrate();
      juice.centerBurst();
      juice.sweep();
      cinematic.play({ title: t("todayDoneTitle", lang), subtitle: t("todayDoneSub", lang) });
    }
  }, [allDone, lang]);

  if (!ready || !quests) return <Splash />;

  const steps = [
    {
      key: "review",
      icon: RotateCcw,
      title: t("todayReview", lang),
      sub: dueCount > 0 ? t("todayReviewSub", lang) : t("todayReviewNone", lang),
      href: "/review",
      done: reviewDone,
      skippable: dueCount === 0,
    },
    {
      key: "learn",
      icon: Sparkles,
      title: t("todayLearn", lang),
      sub: nextLesson.subtitle || nextLesson.title,
      href: `/lesson/${nextLesson.id}`,
      done: learnDone,
      skippable: false,
    },
    {
      key: "talk",
      icon: MessageCircle,
      title: t("todayTalk", lang),
      sub: scenario.title[lang],
      href: "/talk",
      done: talkDone,
      skippable: false,
    },
  ];

  const currentIndex = steps.findIndex((s) => !s.done);
  const chestOpen = chestAvailable(player ?? { lastChestDay: null });

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navLessons", lang)}
      </Link>

      {allDone ? (
        <section className="animate-fade-up mt-6 overflow-hidden rounded-3xl border border-hairline bg-card p-8 text-center">
          <div className="relative mx-auto w-fit">
            <SparkleBurst />
            <Lumi frame="bust" mood="love" className="mx-auto size-28" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.02em]">{t("todayDoneTitle", lang)}</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">{t("todayDoneSub", lang)}</p>
          <div className="mt-5 flex items-center justify-center gap-6">
            <Stat icon={<Flame className="size-4 text-warn" />} value={player?.currentStreak ?? 0} label={t("dayStreak", lang)} />
            <Stat icon={<Star className="size-4 text-co-yellow" style={{ fill: "currentColor" }} />} value={player?.stars ?? 0} label={t("stars", lang)} />
          </div>
        </section>
      ) : (
        <section className="mt-6 animate-fade-up">
          <div className="flex items-center gap-4">
            <div className="relative h-24 w-20 shrink-0">
              <Lumi frame="full" mood="wave" priority />
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("todayTitle", lang)}</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("todayIntro", lang)}</p>
            </div>
          </div>
          {/* Lumi's word of the day — a coach in her corner, not just a checklist */}
          <div className="relative ml-6 mt-3 w-fit rounded-2xl rounded-tl-sm border border-primary/20 bg-primary/[0.05] px-4 py-2.5">
            <p className="text-sm leading-relaxed text-foreground/85">
              {COACH_MSGS[lang][dayKey().split("-").reduce((a, b) => a + Number(b), 0) % COACH_MSGS[lang].length]}
            </p>
          </div>
        </section>
      )}

      {/* The quest path: three stops and a chest at the end */}
      <div className="relative mt-8">
        <div className="map-trail pointer-events-none absolute bottom-12 left-[25px] top-3 w-1.5 rounded-full" aria-hidden />

        <ol className="relative space-y-4">
          {steps.map((step, i) => {
            const isCurrent = i === currentIndex;
            const Icon = step.icon;
            return (
              <li key={step.key} className="relative flex items-center gap-4">
                <span
                  className={cn(
                    "z-10 grid size-[52px] shrink-0 place-items-center rounded-full shadow-sm ring-4",
                    step.done
                      ? "text-white ring-primary/25"
                      : isCurrent
                        ? "star-chip arcade-ring bloom-gold animate-float ring-co-yellow/30"
                        : "bg-muted text-muted-foreground/60 shadow-none ring-transparent",
                  )}
                  style={
                    step.done
                      ? { background: "linear-gradient(145deg, color-mix(in oklch, var(--co-blue) 88%, white), var(--co-blue))" }
                      : undefined
                  }
                >
                  {step.done ? <Check className="size-6" strokeWidth={2.5} /> : <Icon className="size-5" />}
                </span>

                <Link
                  href={step.href}
                  className={cn(
                    "group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-4 transition-all active:scale-[0.99]",
                    step.done
                      ? "border-hairline bg-card opacity-80"
                      : isCurrent
                        ? "border-primary bg-primary/[0.05] shadow-sm"
                        : "border-hairline bg-card hover:border-primary/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("todayStep", lang)} {i + 1}
                    </p>
                    <p className={cn("font-display text-lg font-medium tracking-[-0.01em]", step.done && "text-muted-foreground")}>
                      {step.title}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{step.sub}</p>
                  </div>
                  {isCurrent && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background">
                      {currentIndex > 0 ? t("todayContinue", lang) : t("todayStart", lang)}
                      <ArrowRight className="size-4" />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}

          {/* The chest at the end of the path */}
          <li className="relative flex items-center gap-4">
            <span
              className={cn(
                "z-10 grid size-[52px] shrink-0 place-items-center rounded-full shadow-sm ring-4",
                allDone && chestOpen
                  ? "star-chip bloom-gold animate-float ring-co-yellow/40"
                  : "bg-muted text-muted-foreground/60 shadow-none ring-transparent",
              )}
            >
              {allDone && chestOpen ? <Gift className="size-6" /> : allDone ? <Check className="size-6" /> : <Lock className="size-5" />}
            </span>
            <Link
              href="/shop"
              className={cn(
                "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border p-4 transition-all active:scale-[0.99]",
                allDone && chestOpen
                  ? "border-co-yellow/50 bg-[color-mix(in_oklch,var(--co-yellow)_10%,transparent)] shadow-sm"
                  : "border-dashed border-hairline bg-card opacity-90",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("todayChest", lang)}</p>
                <p className="font-display text-lg font-medium tracking-[-0.01em]">
                  {allDone ? (chestOpen ? t("todayChestReady", lang) : t("todayChestOpened", lang)) : t("todayChestLocked", lang)}
                </p>
              </div>
              {allDone && chestOpen && (
                <span className="star-chip shrink-0 rounded-full px-3 py-1.5 font-display text-sm font-semibold">
                  +{chestReward(player ?? { currentStreak: 0 })} ★
                </span>
              )}
            </Link>
          </li>
        </ol>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="text-left leading-tight">
        <p className="font-display text-xl font-medium tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
