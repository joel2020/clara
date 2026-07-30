"use client";

import { Flame, Star, BookOpen, Ear, Settings2, ChevronRight, Sparkles } from "lucide-react";
import { TabBar } from "@/components/system/tab-bar";
import { StatRow } from "@/components/system/stats";
import { PREVIEW_TABS } from "../tabs";

// Prototype: Yo — the one home for identity, progress detail, constancia, Lumi
// and settings. Replaces the Mundo/Dashboard/Profile triplet; one language,
// stats as quiet rows, Lumi framed as her companion (drawn world, not chrome).

export default function PreviewYo() {
  return (
    <div className="pb-24">
      <header className="border-b border-hairline">
        <div className="flag-bar h-[3px] w-full" aria-hidden />
        <div className="page-gutter mx-auto flex h-14 max-w-3xl items-center">
          <span className="font-display text-xl font-semibold tracking-tight">Clara</span>
        </div>
      </header>

      <main className="page-gutter mx-auto max-w-3xl pt-8">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full text-xl font-semibold text-primary" style={{ background: "var(--surface-wash)" }}>
            V
          </span>
          <div>
            <h1 className="type-title">Valentina</h1>
            <p className="type-support">Medellín · Camino: trabajar en inglés</p>
          </div>
        </div>

        {/* One stats card, rows not chip-cards, one language. */}
        <section className="mt-7">
          <p className="type-label">Lo que has construido</p>
          <div className="mt-3 divide-y divide-hairline rounded-3xl border border-hairline bg-card px-5 py-1.5">
            <StatRow icon={BookOpen} label="Frases dominadas" value="15" />
            <StatRow icon={Ear} label="Sonidos en control" value="2 de 13" />
            <StatRow icon={Flame} label="Racha" value="3 días" />
            <StatRow icon={Star} label="Estrellas" value="24" />
          </div>
          <p className="type-support mt-2">
            Tu sonido más flojo esta semana: la <span className="type-data">h</span> de{" "}
            <span lang="en" className="font-medium text-foreground">help</span> —{" "}
            <a href="/preview/exercise" className="font-medium text-primary">practícalo 2 min</a>.
          </p>
        </section>

        {/* Constancia: the month, quietly. */}
        <section className="mt-8">
          <p className="type-label">Tu constancia · julio</p>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }).map((_, i) => (
              <span
                key={i}
                className="aspect-square rounded-md border border-hairline"
                style={i >= 24 && i <= 26 ? { background: "var(--primary)", borderColor: "var(--primary)" } : undefined}
                aria-hidden
              />
            ))}
          </div>
        </section>

        {/* Lumi: the warmth sink, in her own drawn frame — never app chrome. */}
        <section className="mt-8">
          <a href="#" className="flex items-center gap-4 rounded-3xl border border-hairline bg-card p-5 transition-colors hover:bg-muted">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--surface-wash)" }}>
              <Sparkles className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="type-heading block">Lumi y tu colección</span>
              <span className="type-support block">Viste a tu compañera con las estrellas que ganaste hablando</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        </section>

        <section className="mt-4">
          <a href="#" className="flex items-center gap-4 rounded-3xl border border-hairline bg-card p-5 transition-colors hover:bg-muted">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--surface-wash)" }}>
              <Settings2 className="size-5 text-primary" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="type-heading block">Ajustes</span>
              <span className="type-support block">Nombre, idioma, exigencia, notificaciones</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        </section>
      </main>

      <TabBar items={PREVIEW_TABS} activePath="/preview/yo" />
    </div>
  );
}
