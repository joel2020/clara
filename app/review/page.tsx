"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PracticeSession } from "@/components/practice/practice-session";
import { useSessionReturn } from "@/components/daily-session/use-session-return";
import { getDueReviewItems } from "@/lib/review";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import type { Lesson } from "@/lib/db/types";
import { Splash } from "@/components/splash";

// A review session pulls every due item across all lessons into one focused
// pass — the spaced-repetition payoff. Built as a synthetic sound-focus lesson.

export default function ReviewPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  const { settings, ready } = useSettings();
  const { exitHref, completedHref } = useSessionReturn();
  const lang = settings.coachLanguage;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getDueReviewItems().then((dueItems) => {
      if (!active) return;
      if (dueItems.length > 0) {
        setLesson({
          id: "review",
          title: t("reviewLessonTitle", lang),
          subtitle: t("reviewLessonSub", lang),
          description: "",
          kind: "sound-focus",
          categoryIds: [],
          items: dueItems,
          order: -1,
        });
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [lang]);

  if (!ready || loading) {
    return <div className="mx-auto max-w-xl px-5 py-24 text-center text-muted-foreground">{t("reviewLoading", lang)}</div>;
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <CheckCircle2 className="mx-auto mb-5 size-10 text-success" />
        <p className="font-display text-3xl font-medium tracking-[-0.02em]">{t("reviewAllDone", lang)}</p>
        <p className="mx-auto mt-3 max-w-sm text-muted-foreground">{t("reviewAllDoneSub", lang)}</p>
        <Link
          href={completedHref ?? "/"}
          className="mt-6 inline-flex items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
        >
          {t("backHome", lang)}
        </Link>
      </div>
    );
  }

  return (
    <PracticeSession
      lesson={lesson}
      exitHref={exitHref ?? "/"}
      completionHref={completedHref}
    />
  );
}
