"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActivityShell } from "@/components/daily-session/activity-shell";
import { activityHref } from "@/components/daily-session/navigation";
import { SessionComplete } from "@/components/daily-session/session-complete";
import { SessionIntro } from "@/components/daily-session/session-intro";
import { TechnicalRecovery } from "@/components/daily-session/technical-recovery";
import { Splash } from "@/components/splash";
import { nextActivity } from "@/lib/daily-session";
import type { DailySessionReward } from "@/lib/daily-session-reward";
import { useDailySession } from "@/lib/hooks/useDailySession";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

export default function TodayPage() {
  return (
    <Suspense fallback={<Splash />}>
      <TodaySessionRunner />
    </Suspense>
  );
}

function TodaySessionRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, ready } = useSettings();
  const {
    session,
    loading,
    start,
    checkpoint,
    checkpointPronunciation,
    claimCompletion,
  } = useDailySession();
  const lang = settings.coachLanguage;
  const handledReturn = useRef<string | null>(null);
  const claimedSession = useRef<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [recoveryActivityId, setRecoveryActivityId] = useState<string | null>(
    null,
  );
  const [reward, setReward] = useState<DailySessionReward | null>(null);

  const completeActivity = useCallback(
    async (activityId: string): Promise<boolean> => {
      setTransitioning(true);
      try {
        await checkpoint(activityId, "completed");
        return true;
      } catch {
        setRecoveryActivityId(activityId);
        return false;
      } finally {
        setTransitioning(false);
      }
    },
    [checkpoint],
  );

  useEffect(() => {
    if (!session) return;
    const activityId = searchParams.get("sessionActivity");
    if (!activityId) return;
    const returnDay = searchParams.get("sessionDay");
    const returnKey = `${returnDay ?? "-"}:${activityId}:${searchParams.get("sessionResult") ?? "completed"}`;
    if (handledReturn.current === returnKey) return;
    handledReturn.current = returnKey;

    // Activity ids repeat across days, so a return that crossed midnight would
    // otherwise credit the identically-named step of today's new session.
    const staleDay = returnDay !== null && returnDay !== session.day;
    if (
      staleDay ||
      !session.activities.some((activity) => activity.id === activityId)
    ) {
      router.replace("/today", { scroll: false });
      return;
    }
    if (searchParams.get("sessionResult") === "technical") {
      void Promise.resolve().then(() => {
        setRecoveryActivityId(activityId);
        router.replace("/today", { scroll: false });
      });
      return;
    }

    void checkpoint(activityId, "completed")
      .then(() => {
        router.replace("/today", { scroll: false });
      })
      .catch(() => {
        setRecoveryActivityId(activityId);
      });
  }, [checkpoint, router, searchParams, session]);

  useEffect(() => {
    if (
      !session?.completedAt ||
      session.rewardClaimed ||
      claimedSession.current === session.id
    ) {
      return;
    }
    claimedSession.current = session.id;
    void claimCompletion()
      .then((result) => {
        if (result) setReward(result.reward);
      })
      .catch(() => {
        claimedSession.current = null;
      });
  }, [claimCompletion, session]);

  if (!ready || loading) return <Splash />;

  // Composition can legitimately yield nothing (no bound account yet, or a
  // storage read that failed). Say so plainly instead of leaving her on a
  // splash screen that never resolves.
  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-6 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("backHome", lang)}
        </Link>
        <section className="mt-6 rounded-3xl border border-hairline bg-card p-5 shadow-sm sm:p-7">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em]">
            {t("todayUnavailableTitle", lang)}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("todayUnavailableBody", lang)}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-5 min-h-12 rounded-2xl bg-foreground px-5 py-3 font-semibold text-background transition-opacity hover:opacity-90"
          >
            {t("todayUnavailableRetry", lang)}
          </button>
        </section>
      </main>
    );
  }

  const current = nextActivity(session);
  const recoveryActivity = recoveryActivityId
    ? session.activities.find(
        (activity) => activity.id === recoveryActivityId,
      ) ?? null
    : null;

  const retry = () => {
    if (!recoveryActivity) return;
    const href = activityHref(recoveryActivity, session.day);
    setRecoveryActivityId(null);
    if (href) {
      router.push(href);
      return;
    }
    void completeActivity(recoveryActivity.id);
  };

  const continueWithListening = async () => {
    if (!recoveryActivity) return;
    setTransitioning(true);
    try {
      await checkpoint(recoveryActivity.id, "technical-skip");
      setRecoveryActivityId(null);
      router.push("/listen?returnTo=%2Ftoday");
    } catch {
      // Checkpoint persistence failed again; stay on the recovery screen so
      // she can retry — nothing was recorded against her.
    } finally {
      setTransitioning(false);
    }
  };

  const begin = async () => {
    setStarting(true);
    try {
      await start();
    } catch {
      const first = nextActivity(session);
      if (first) setRecoveryActivityId(first.id);
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-5 pb-24 pt-6 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("backHome", lang)}
      </Link>

      {transitioning && (
        <p
          className="mt-5 rounded-xl border border-primary/20 bg-primary/[0.05] px-4 py-2.5 text-center text-sm font-medium text-primary"
          role="status"
        >
          {t("todayTransition", lang)}
        </p>
      )}

      {recoveryActivity ? (
        <TechnicalRecovery
          lang={lang}
          busy={transitioning}
          onRetry={retry}
          onContinueListening={() => {
            void continueWithListening();
          }}
        />
      ) : session.completedAt !== null ? (
        <SessionComplete session={session} lang={lang} reward={reward} />
      ) : session.startedAt === null ? (
        <SessionIntro
          session={session}
          lang={lang}
          starting={starting}
          onStart={() => {
            void begin();
          }}
        />
      ) : current ? (
        <ActivityShell
          session={session}
          activity={current}
          lang={lang}
          transitioning={transitioning}
          onComplete={() => {
            void completeActivity(current.id);
          }}
          onPronunciationStateChange={async (state, binding) => {
            await checkpointPronunciation(current.id, state, binding);
          }}
        />
      ) : (
        <SessionComplete session={session} lang={lang} reward={reward} />
      )}
    </main>
  );
}
