"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw, Sparkles, MessageCircle, Check, Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useAllProgress, useProgressMap, useConvItems, useTodayQuests } from "@/lib/hooks/useData";
import { countDueReview } from "@/lib/review";
import { pickNextLesson, pickScenario } from "@/lib/today";
import { dayKey } from "@/lib/gamification";
import { questDone } from "@/lib/quests";
import { t } from "@/lib/i18n";
import { Lumi } from "@/components/lumi";
import { SparkleBurst } from "@/components/star-reward";
import { celebrate } from "@/lib/fx";
import { juice } from "@/components/juice";
import { Splash } from "@/components/splash";

// The guided daily session: warm up → learn → talk, in order. This is the
// coach's "here's what we're doing today" — the app leading a solo learner
// through a complete, sized daily routine instead of leaving her to decide.

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
    }
  }, [allDone]);

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
            <Lumi frame="bust" mood="cheer" className="mx-auto size-28" />
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
        </section>
      )}

      <ol className="mt-8 space-y-3">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const Icon = step.icon;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={cn(
                  "group flex items-center gap-4 rounded-2xl border p-4 transition-all active:scale-[0.99]",
                  step.done
                    ? "border-hairline bg-card"
                    : isCurrent
                      ? "border-primary bg-primary/[0.05] shadow-sm"
                      : "border-hairline bg-card hover:border-primary/40",
                )}
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-xl",
                    step.done ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
                  )}
                >
                  {step.done ? <Check className="size-5" /> : <Icon className="size-5" />}
                </span>
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
                {step.done && (
                  <span className="shrink-0 text-xs font-semibold text-success">✓</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
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
