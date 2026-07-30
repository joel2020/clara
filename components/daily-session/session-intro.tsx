import { Clock3, Flag, PlayCircle, Trophy } from "lucide-react";
import type { DailySession } from "@/lib/daily-session";
import { DAILY_SESSION_REWARD_STARS, DAILY_SESSION_REWARD_XP } from "@/lib/daily-session-reward";
import { t, type CoachLang } from "@/lib/i18n";

export function SessionIntro({
  session,
  lang,
  starting,
  onStart,
}: {
  session: DailySession;
  lang: CoachLang;
  starting: boolean;
  onStart: () => void;
}) {
  const estimatedMinutes = session.activities.reduce(
    (total, activity) => total + activity.estimatedMinutes,
    0,
  );

  return (
    <section
      className="mt-6 overflow-hidden rounded-3xl border border-primary/25 bg-primary/[0.05] p-5 shadow-[0_18px_45px_-32px_color-mix(in_oklab,var(--primary),transparent_25%)] sm:p-7"
      aria-labelledby="session-intro-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Flag className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            {t("todaySessionObjective", lang)}
          </p>
          <h1
            id="session-intro-title"
            className="mt-1 font-display text-3xl font-semibold leading-tight tracking-[-0.03em]"
          >
            {session.objective[lang]}
          </h1>
        </div>
      </div>

      <p className="mt-5 leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">
          {t("todaySessionOutcome", lang)}:{" "}
        </span>
        {session.outcome[lang]}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <IntroDetail
          icon={Clock3}
          label={t("todaySessionTime", lang)}
          value={`~${estimatedMinutes} min`}
        />
        <IntroDetail
          icon={Trophy}
          label={t("todayReward", lang)}
          value={`+${DAILY_SESSION_REWARD_XP} XP · +${DAILY_SESSION_REWARD_STARS} ★`}
        />
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("todaySessionActivities", lang)}
        </p>
        <ol className="mt-2 space-y-2">
          {session.activities.map((activity, index) => (
            <li
              key={activity.id}
              className="flex items-center gap-3 rounded-xl border border-hairline bg-background/75 px-3 py-2.5"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {activity.title[lang]}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {activity.estimatedMinutes} min
              </span>
            </li>
          ))}
        </ol>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="sheen mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-95 active:scale-[0.995] disabled:opacity-60"
      >
        <PlayCircle className="size-5" aria-hidden />
        {starting ? t("todaySessionPreparing", lang) : t("todayStart", lang)}
      </button>
    </section>
  );
}

function IntroDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-background/75 px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
