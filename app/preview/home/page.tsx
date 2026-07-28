"use client";

import Image from "next/image";
import { ArrowRight, Flame, Check } from "lucide-react";
import { TabBar } from "@/components/system/tab-bar";
import { ProgressBar } from "@/components/system/progress";
import { PREVIEW_TABS } from "../tabs";

// Prototype: the merged Hoy (home = today). One promise, one button, human
// presence, and progress phrased toward the job goal. Static data — day 3 of a
// learner on the job track — so the earned/estimated distinction is visible.

export default function PreviewHome() {
  return (
    <div className="pb-24">
      {/* Header: wordmark + flag signature, nothing else. */}
      <header className="border-b border-hairline bg-background/70 backdrop-blur-xl">
        <div className="flag-bar h-[3px] w-full" aria-hidden />
        <div className="page-gutter mx-auto flex h-14 max-w-3xl items-center">
          <span className="font-display text-xl font-semibold tracking-tight">Clara</span>
          <span className="ml-2 hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            Inglés para trabajar
          </span>
        </div>
      </header>

      <main className="page-gutter mx-auto max-w-3xl">
        {/* The greeting + today's promise. The whole screen argues for one tap. */}
        <section className="pt-8">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="type-label flex items-center gap-2">
                <span className="flag-dots" aria-hidden><i /><i /><i /></span>
                Día 3 · martes
              </p>
              <h1 className="type-display mt-3">
                Buenos días,
                <br />
                Valentina.
              </h1>
              <p className="type-body mt-4 max-w-[38ch]">
                Hoy: <strong>5 frases para atender una llamada</strong> — el saludo
                que decide el tono. <span className="text-muted-foreground">~12 min.</span>
              </p>
            </div>
            {/* Joel is the human face of the promise — photo, not mascot. */}
            <div className="relative mt-2 hidden shrink-0 sm:block">
              <Image
                src="/character/joel-avatar-poster.jpg"
                alt="Joel, tu profe"
                width={84}
                height={84}
                className="size-21 rounded-3xl object-cover"
                style={{ width: 84, height: 84 }}
              />
              <span className="flag-bar absolute inset-x-3 -bottom-[3px] h-[3px] rounded-full" aria-hidden />
            </div>
          </div>

          <a
            href="/preview/lesson"
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Empezar la sesión
            <ArrowRight className="size-5" aria-hidden />
          </a>

          {/* Yesterday's win + streak: quiet, earned, one line each. */}
          <div className="mt-5 flex flex-col gap-2">
            <p className="type-support flex items-center gap-2">
              <Check className="size-4 text-success" strokeWidth={2.5} aria-hidden />
              Ayer dominaste <span className="font-medium text-foreground" lang="en">&ldquo;How can I help you?&rdquo;</span>
            </p>
            <p className="type-support flex items-center gap-2">
              <Flame className="size-4 text-warn" strokeWidth={2} aria-hidden />
              Racha de 2 días — hoy la vuelves 3.
            </p>
          </div>
        </section>

        {/* One progress statement, phrased toward the goal. No zero walls: bars
            exist because there is data. */}
        <section className="mt-10">
          <p className="type-label">Tu meta</p>
          <div className="mt-3 rounded-3xl border border-hairline bg-card p-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="type-heading">Nivel entrevista</p>
              <p className="type-data text-muted-foreground">12 de 110 frases</p>
            </div>
            <ProgressBar value={12} max={110} label="Progreso hacia nivel entrevista" className="mt-3" />
            <p className="type-support mt-3">
              A este ritmo, tu primera llamada simulada completa está a ~2 semanas.
            </p>
          </div>
        </section>

        {/* One secondary door — speaking practice is never more than a tap away. */}
        <section className="mt-6">
          <a
            href="/preview/talk"
            className="flex items-center gap-4 rounded-3xl border border-hairline bg-card p-5 transition-colors hover:bg-muted"
          >
            <Image
              src="/character/joel-avatar-poster.jpg"
              alt=""
              width={44}
              height={44}
              className="rounded-full object-cover"
              style={{ width: 44, height: 44 }}
            />
            <span className="min-w-0 flex-1">
              <span className="type-heading block">¿Cinco minutos más?</span>
              <span className="type-support block">Conversa con Joel — hoy: en el café.</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        </section>
      </main>

      <TabBar items={PREVIEW_TABS} activePath="/preview/home" />
    </div>
  );
}
