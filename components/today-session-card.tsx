"use client";

import Link from "next/link";
import { Check, Circle, Clock3, Flag, PlayCircle, Trophy } from "lucide-react";
import { sessionProgress } from "@/lib/daily-session";
import { useDailySession } from "@/lib/hooks/useDailySession";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

// The home-screen decision point. It owns the daily-session read so the rest
// of the dashboard can remain supporting context rather than competing CTAs.
export function TodaySessionCard() {
  const { settings } = useSettings();
  const { session, loading, start } = useDailySession();
  const lang = settings.coachLanguage;
  const progress = session ? sessionProgress(session) : { completed: 0, total: 0, percentage: 0 };
  const minutes = session?.activities.reduce((total, activity) => total + activity.estimatedMinutes, 0) ?? 15;
  const continuing = session?.startedAt !== null && session?.completedAt === null;

  return (
    <section className="animate-fade-up mt-4 rounded-3xl border border-primary/25 bg-primary/[0.06] p-4 shadow-[0_12px_30px_-20px_color-mix(in_oklab,var(--primary),transparent_35%)] sm:mt-5 sm:p-6" aria-labelledby="today-session-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Flag className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {t("todayCard", lang)} <span className="text-primary/70">· {t("todaySessionObjective", lang)}</span>
          </p>
          <h2 id="today-session-title" className="mt-0.5 font-display text-xl font-semibold leading-tight tracking-[-0.02em]">
            {session?.objective[lang] ?? t("todayCardSub", lang)}
          </h2>
        </div>
      </div>

      <p className="mt-3 text-sm leading-snug text-muted-foreground">
        <span className="font-medium text-foreground">{t("todaySessionOutcome", lang)}: </span>
        {session?.outcome[lang] ?? t("todayIntro", lang)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Detail icon={Clock3} label={t("todaySessionTime", lang)} value={`~${minutes} min`} />
        <Detail icon={Trophy} label={t("todayReward", lang)} value={t("todayRewardValue", lang)} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("todaySessionProgress", lang)}</span>
          <span className="font-medium tabular-nums">{progress.completed}/{progress.total || "—"}</span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary/10"
          role="progressbar"
          aria-label={`${t("todaySessionProgress", lang)} ${progress.percentage}%`}
          aria-valuenow={progress.percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.percentage}%` }} />
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{t("todaySessionActivities", lang)}</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs text-foreground/80">
          {(session?.activities ?? []).map((activity) => (
            <span key={activity.id} className="flex min-w-0 items-center gap-1.5 rounded-lg bg-background/70 px-2 py-1.5">
              {activity.status === "completed" ? (
                <Check className="size-3 shrink-0 text-primary" aria-hidden />
              ) : (
                <Circle className="size-3 shrink-0 text-primary/45" aria-hidden />
              )}
              <span className="truncate">{activity.title[lang]}</span>
            </span>
          ))}
          {!session && !loading && (
            <span className="col-span-2 text-xs text-muted-foreground">{t("todayIntro", lang)}</span>
          )}
        </div>
      </div>

      <Link
        href="/today"
        onClick={() => { void start(); }}
        className="sheen mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-95 active:scale-[0.995]"
      >
        <PlayCircle className="size-5" />
        {continuing ? t("todayContinue", lang) : t("todayStart", lang)}
      </Link>
    </section>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-background/70 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Icon className="size-3.5" />{label}</div>
      <p className="mt-0.5 truncate font-semibold">{value}</p>
    </div>
  );
}
