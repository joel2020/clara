"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle, Clock3, Headphones, ShieldCheck } from "lucide-react";
import type { DailyActivity, DailySession } from "@/lib/daily-session";
import { sessionProgress } from "@/lib/daily-session";
import { t, type CoachLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useSpeechSupport } from "@/lib/hooks/useSpeechSupport";
import { PronunciationGame } from "@/components/practice/pronunciation-game";
import type { DailyPronunciationGameState } from "@/lib/speech/daily-pronunciation-game";
import { activityHref } from "./navigation";
import type { PracticePersistenceBinding } from "@/lib/db/repository";

export function ActivityShell({
  session,
  activity,
  lang,
  transitioning,
  onComplete,
  onPronunciationStateChange,
}: {
  session: DailySession;
  activity: DailyActivity;
  lang: CoachLang;
  transitioning: boolean;
  onComplete: () => void;
  onPronunciationStateChange?: (state: DailyPronunciationGameState, binding: PracticePersistenceBinding) => Promise<void>;
}) {
  const speechSupport = useSpeechSupport();
  const progress = sessionProgress(session);
  const index = session.activities.findIndex((entry) => entry.id === activity.id);
  const remainingMinutes = session.activities
    .filter(
      (entry) =>
        entry.status !== "completed" && entry.status !== "technical-skip",
    )
    .reduce((total, entry) => total + entry.estimatedMinutes, 0);
  const href = activityHref(activity, session.day);

  return (
    <section className="mt-6" aria-labelledby="current-activity-title">
      <div className="rounded-3xl border border-hairline bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold uppercase tracking-[0.14em] text-primary">
            {t("todayStep", lang)} {index + 1} {t("todayStepOf", lang)}{" "}
            {session.activities.length}
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" aria-hidden />
            {t("todaySessionSaved", lang)}
          </span>
        </div>

        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10"
          role="progressbar"
          aria-label={t("todaySessionProgress", lang)}
          aria-valuenow={progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>

        <div className="mt-6 flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            {activity.kind === "listen" ? (
              <Headphones className="size-5" aria-hidden />
            ) : (
              <ArrowRight className="size-5" aria-hidden />
            )}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("todaySessionNow", lang)}
            </p>
            <h1
              id="current-activity-title"
              className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em]"
            >
              {activity.title[lang]}
            </h1>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/55 p-3 text-sm">
          <p>
            <span className="block text-xs text-muted-foreground">
              {t("todaySessionObjective", lang)}
            </span>
            <span className="mt-0.5 block font-medium">
              {session.objective[lang]}
            </span>
          </p>
          <p>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden />
              {t("todaySessionRemaining", lang)}
            </span>
            <span className="mt-0.5 block font-medium">
              ~{remainingMinutes} min
            </span>
          </p>
        </div>

        {activity.pronunciation ? (
          <div className="mt-7 border-t border-hairline pt-7">
            <PronunciationGame
              activity={activity.pronunciation}
              day={session.day}
              activityId={activity.id}
              lessonId={activity.sourceId}
              itemPool={activity.pronunciation.itemPool ?? activity.pronunciation.targets}
              recognitionSupported={speechSupport?.recognition ?? false}
              combo={0}
              onStateChange={onPronunciationStateChange}
              onComplete={() => {}}
            />
          </div>
        ) : href ? (
          <Link
            href={href}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.995]"
          >
            {t("todayOpenActivity", lang)}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onComplete}
            disabled={transitioning}
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.995] disabled:opacity-60"
          >
            {transitioning
              ? t("todaySessionSaving", lang)
              : t("todayFinishReflection", lang)}
            <ArrowRight className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {session.activities.map((entry, entryIndex) => {
          const done = entry.status === "completed";
          const skipped = entry.status === "technical-skip";
          const active = entry.id === activity.id;
          return (
            <li
              key={entry.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
                active
                  ? "border-primary/35 bg-primary/[0.05]"
                  : "border-hairline bg-card",
              )}
            >
              {done ? (
                <Check className="size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle
                  className={cn(
                    "size-3.5 shrink-0",
                    skipped ? "text-muted-foreground/40" : "text-primary/55",
                  )}
                  aria-hidden
                />
              )}
              <span className="truncate">
                {entryIndex + 1}. {entry.title[lang]}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
