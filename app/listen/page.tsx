"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Headphones } from "lucide-react";
import { LESSONS } from "@/lib/content/lessons";
import { ListenRound } from "@/components/practice/listen-round";
import { useSessionReturn } from "@/components/daily-session/use-session-return";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { CharacterIllustration } from "@/components/character";
import { Splash } from "@/components/splash";

// Listening comprehension game: hear it (no text), pick the meaning. Pool = the
// conversation track, whose chunks all carry Spanish meanings.

export default function ListenPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ListenContent />
    </Suspense>
  );
}

function ListenContent() {
  const router = useRouter();
  const { settings, ready } = useSettings();
  const { exitHref, completedHref } = useSessionReturn();
  const lang = settings.coachLanguage;
  const [started, setStarted] = useState(false);

  const pool = useMemo(
    () => LESSONS.filter((l) => l.track === "conversation").flatMap((l) => l.items),
    [],
  );

  if (!ready) return <Splash />;
  if (started) {
    return (
      <ListenRound
        items={pool}
        onExit={() => setStarted(false)}
        onComplete={() => {
          if (completedHref) router.push(completedHref);
          else setStarted(false);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-6 sm:px-6">
      <Link href={exitHref ?? "/"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {exitHref ? t("todayBackToSession", lang) : t("navLessons", lang)}
      </Link>

      <section className="mt-6 flex flex-col items-center text-center animate-fade-up">
        {/* A game's opening screen is a lesson intro: Clara explains what the
            round is before it starts, then gets out of the way. `teaching`'s
            three-quarter sheet is landscape, so this portrait box pins the
            full figure rather than squashing her into a band. */}
        <div className="relative h-40 w-32">
          <CharacterIllustration state="teaching" frame="full" preload />
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("listenTitle", lang)}</h1>
        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-muted-foreground">{t("listenIntro", lang)}</p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <Headphones className="size-4" />
          {t("shadowStart", lang)}
        </button>
      </section>
    </div>
  );
}
