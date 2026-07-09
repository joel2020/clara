"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { Splash } from "@/components/splash";
import { DuetScene } from "@/components/practice/duet-scene";
import { DUETS, type Duet } from "@/lib/content/duets";

// Duet mode: pick a scene, play your role opposite Joel. Scripted conversation
// spoken out loud — the step between imitating and improvising.

export default function DuetPage() {
  const { settings, ready } = useSettings();
  const lang = settings.coachLanguage;
  const [scene, setScene] = useState<Duet | null>(null);

  if (!ready) return <Splash />;
  if (scene) return <DuetScene duet={scene} onExit={() => setScene(null)} />;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-6 sm:px-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("navHome", lang)}
      </Link>

      <section className="mt-5 animate-fade-up">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">{t("duetTitle", lang)}</h1>
        <p className="mt-2 max-w-md text-muted-foreground">{t("duetIntro", lang)}</p>
      </section>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {DUETS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setScene(d)}
            className="group flex items-center gap-4 rounded-2xl border border-hairline bg-card px-5 py-4 text-left transition-colors hover:border-primary/40 active:scale-[0.99]"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl">{d.emoji}</span>
            <div className="flex-1">
              <p className="font-display text-lg font-medium tracking-[-0.01em]">{d.title[lang]}</p>
              <p className="text-sm text-muted-foreground">{d.blurb[lang]}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
