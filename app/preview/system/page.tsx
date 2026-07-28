"use client";

import { ArrowRight, Headphones } from "lucide-react";
import { ProgressBar, ProgressRing } from "@/components/system/progress";
import { EarnedStat, EstimatedStat, StatRow } from "@/components/system/stats";
import { EmptyState, ErrorState, OfflineNote, Skeleton } from "@/components/system/states";
import { FeedbackPanel, Stamp } from "@/components/system/feedback";
import { MicButton } from "@/components/system/mic-button";

// The living gallery: tokens, type roles, and every system component in its
// states — including what reduced-motion users get (toggle your OS setting and
// reload; every animated element has a designed end state).

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <p className="type-label">{title}</p>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

export default function PreviewSystem() {
  return (
    <div className="page-gutter mx-auto max-w-xl py-16">
      <p className="type-label">Sistema</p>
      <h1 className="type-display mt-2">Tokens y componentes</h1>

      <Section title="Tipos">
        <p className="type-display">Display — Say it clearly</p>
        <p className="type-title">Title — En el café</p>
        <p className="type-heading">Heading — Paso 2 · Aprende</p>
        <p className="type-body">Body — El primer minuto de toda conversación usa las mismas frases.</p>
        <p className="type-support">Support — ¿En qué le puedo ayudar?</p>
        <p className="type-label">Label — Tu meta</p>
        <p className="type-data">Data — 12/110 · /ɔ/ · 2:30</p>
        <p className="type-data-big">34</p>
      </Section>

      <Section title="Botones (44px+)">
        <button type="button" className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground">
          Primario grande <ArrowRight className="size-5" aria-hidden />
        </button>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="inline-flex h-11 items-center rounded-2xl bg-primary px-6 text-sm font-medium text-primary-foreground">Primario</button>
          <button type="button" className="inline-flex h-11 items-center rounded-2xl border border-hairline bg-card px-6 text-sm font-medium">Secundario</button>
          <button type="button" className="inline-flex h-11 items-center rounded-2xl px-6 text-sm font-medium text-muted-foreground">Fantasma</button>
        </div>
        <MicButton state="idle" label="Tu turno — toca y habla" />
        <MicButton state="listening" label="Grabando" />
      </Section>

      <Section title="Progreso y honestidad">
        <ProgressBar value={34} label="Ejemplo" />
        <div className="flex items-center gap-6">
          <ProgressRing value={2} max={3} label="Paso 2 de 3"><span className="type-data">2/3</span></ProgressRing>
          <div className="flex gap-10">
            <EarnedStat value="15" label="Frases dominadas" />
            <EstimatedStat value="A1" label="Tu nivel" />
          </div>
        </div>
        <div className="divide-y divide-hairline rounded-3xl border border-hairline bg-card px-5 py-1.5">
          <StatRow icon={Headphones} label="Sonidos en control" value="2 de 13" />
        </div>
      </Section>

      <Section title="Feedback">
        <FeedbackPanel
          heard={[
            { text: "I", landed: true },
            { text: "can", landed: true },
            { text: "help", landed: false },
          ]}
          fix={{ focus: "help", tip: "Esa h va suave, con aire. Susúrrala." }}
          onReplay={() => {}}
        />
        <div className="rounded-3xl border border-hairline bg-card p-6 text-center">
          <Stamp>Sesión completa</Stamp>
        </div>
      </Section>

      <Section title="Estados">
        <div className="rounded-3xl border border-hairline bg-card">
          <EmptyState title="Estás al día">Practica una lección para seguir sumando.</EmptyState>
        </div>
        <div className="rounded-3xl border border-hairline bg-card">
          <ErrorState onRetry={() => {}} />
        </div>
        <OfflineNote />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Section>
    </div>
  );
}
