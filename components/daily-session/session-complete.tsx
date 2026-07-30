import Link from "next/link";
import { ArrowRight, Check, RefreshCcw, Sparkles, Star, Trophy } from "lucide-react";
import type { DailySession } from "@/lib/daily-session";
import type { DailySessionReward } from "@/lib/daily-session-reward";
import { DAILY_SESSION_REWARD_STARS, DAILY_SESSION_REWARD_XP } from "@/lib/daily-session-reward";
import { t, type CoachLang } from "@/lib/i18n";

export function SessionComplete({
  session,
  lang,
  reward,
}: {
  session: DailySession;
  lang: CoachLang;
  reward: DailySessionReward | null;
}) {
  const completed = session.activities.filter(
    (activity) => activity.status === "completed",
  );
  const practiced =
    completed.length > 0
      ? completed.map((activity) => activity.title[lang]).join(" · ")
      : t("todayCompletionNoPracticeEvidence", lang);
  const recentMistake = completed.find(
    (activity) => activity.reason === "recent-mistake",
  );
  const skipped = session.activities.find(
    (activity) => activity.status === "technical-skip",
  );
  const rewardXp =
    reward?.xp ||
    (session.rewardClaimed ? DAILY_SESSION_REWARD_XP : 0);
  const rewardStars =
    reward?.stars ||
    (session.rewardClaimed ? DAILY_SESSION_REWARD_STARS : 0);

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-primary/25 bg-card p-5 shadow-sm sm:p-8">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t("todayDoneTitle", lang)}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.035em]">
          {session.objective[lang]}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          {t("todayCompletionClara", lang)}
        </p>
      </div>

      <div className="mt-7 grid gap-3">
        <SummaryRow
          icon={Check}
          label={t("todayCompletionPracticed", lang)}
          value={practiced}
        />
        <SummaryRow
          icon={Trophy}
          label={t("todayCompletionImproved", lang)}
          value={t("todayCompletionImprovedNeutral", lang)}
        />
        <SummaryRow
          icon={RefreshCcw}
          label={t("todayCompletionReview", lang)}
          value={
            recentMistake
              ? recentMistake.title[lang]
              : t("todayCompletionNoMistakeEvidence", lang)
          }
        />
      </div>

      <div className="mt-5 rounded-2xl bg-primary/[0.07] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {t("todayCompletionReward", lang)}
        </p>
        {rewardXp > 0 || rewardStars > 0 ? (
          <p className="mt-2 flex items-center gap-4 font-display text-2xl font-semibold">
            <span className="inline-flex items-center gap-1.5">
              <Trophy className="size-5 text-primary" aria-hidden />+{rewardXp} XP
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-5 fill-current text-co-yellow" aria-hidden />+
              {rewardStars}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm font-medium text-muted-foreground" role="status">
            {t("todayCompletionRewardPending", lang)}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {t("todayCompletionRewardOnce", lang)}
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-hairline bg-secondary/45 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t("todayCompletionTomorrow", lang)}
        </p>
        <p className="mt-1.5 font-medium">
          {skipped
            ? `${skipped.title[lang]} — ${t("todayCompletionTryAgain", lang)}`
            : session.objective[lang]}
        </p>
      </div>

      <Link
        href="/"
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 py-3 font-semibold text-background transition-opacity hover:opacity-90 active:scale-[0.995]"
      >
        {t("todayDoneForToday", lang)}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Check;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-hairline bg-secondary/35 p-4">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm font-medium leading-relaxed">{value}</p>
      </div>
    </div>
  );
}
