"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Puzzle } from "lucide-react";
import { LESSONS } from "@/lib/content/lessons";
import { BuildRound } from "@/components/practice/build-round";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { CharacterIllustration } from "@/components/character";
import { Splash } from "@/components/splash";

// Sentence-builder game: hear it, then build it word by word. Pool = the
// conversation track (real chunks with Spanish meanings).

export default function BuildPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const [started, setStarted] = useState(false);

  const pool = useMemo(
    () => LESSONS.filter((l) => l.track === "conversation").flatMap((l) => l.items),
    [],
  );

  if (!ready) return <Splash />;
  if (started) return <BuildRound items={pool} onExit={() => setStarted(false)} />;

  return (
    <div className="mx-auto max-w-xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      <section className="mt-6 flex flex-col items-center text-center animate-fade-up">
        {/* A game's opening screen is a lesson intro: Clara explains what the
            round is before it starts, then gets out of the way. Three-quarter
            is the manifest's preferred framing for `teaching`. */}
        <div className="relative h-40 w-32">
          <CharacterIllustration state="teaching" frame="threeQuarter" preload />
        </div>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("buildTitle", lang)}</h1>
        <p className="mx-auto mt-3 max-w-sm leading-relaxed text-muted-foreground">{t("buildIntro", lang)}</p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <Puzzle className="size-4" />
          {t("shadowStart", lang)}
        </button>
      </section>
    </div>
  );
}
