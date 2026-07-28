"use client";

import { Check, Lock, Phone, FileText, Mic } from "lucide-react";
import { TabBar } from "@/components/system/tab-bar";
import { ProgressBar } from "@/components/system/progress";
import { EarnedStat, EstimatedStat } from "@/components/system/stats";
import { PREVIEW_TABS } from "../tabs";
import { cn } from "@/lib/utils";

// Prototype: Camino — the ladder phrased as outcomes ("Nivel entrevista", not
// "B2 · 80"), the job track as stations, and honest earned/estimated numbers.
// Locked things say why and what unlocks them.

const UNITS = [
  { title: "Saludos y presentaciones", state: "done" as const },
  { title: "La llamada: el saludo", state: "done" as const },
  { title: "Entender al cliente", state: "current" as const, progress: 3, total: 10 },
  { title: "No puedo hacer eso, pero…", state: "locked" as const },
  { title: "Deletrear sin errores", state: "locked" as const },
];

export default function PreviewProgress() {
  return (
    <div className="pb-24">
      <header className="border-b border-hairline">
        <div className="flag-bar h-[3px] w-full" aria-hidden />
        <div className="page-gutter mx-auto flex h-14 max-w-3xl items-center">
          <span className="font-display text-xl font-semibold tracking-tight">Clara</span>
        </div>
      </header>

      <main className="page-gutter mx-auto max-w-3xl pt-8">
        <p className="type-label">Camino</p>
        <h1 className="type-display mt-3">Tu camino al trabajo</h1>

        {/* The honest pair: what's earned vs what's estimated. */}
        <div className="mt-6 flex gap-10 rounded-3xl border border-hairline bg-card p-5">
          <EarnedStat value="15" label="Frases dominadas" detail="Comprobadas hablando" />
          <EstimatedStat value="A1" label="Tu nivel" />
        </div>
        <p className="type-support mt-2">
          Tu nivel es estimado hasta tu primer examen — ahí lo vuelves tuyo.
        </p>

        {/* The unit ladder: states are explicit, locks explain themselves. */}
        <section className="mt-9">
          <p className="type-label">Unidades · Trabajo</p>
          <ol className="mt-3 space-y-2.5">
            {UNITS.map((u) => (
              <li
                key={u.title}
                className={cn(
                  "rounded-3xl border p-4",
                  u.state === "current"
                    ? "border-primary/40 bg-card"
                    : "border-hairline bg-card",
                  u.state === "locked" && "opacity-70",
                )}
                style={u.state === "current" ? { background: "var(--surface-wash)" } : undefined}
              >
                <div className="flex items-center gap-3.5">
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full",
                      u.state === "done" && "bg-success text-white",
                      u.state === "current" && "bg-primary text-primary-foreground",
                      u.state === "locked" && "border border-hairline text-muted-foreground",
                    )}
                  >
                    {u.state === "done" ? (
                      <Check className="size-4.5" strokeWidth={2.5} aria-hidden />
                    ) : u.state === "current" ? (
                      <Mic className="size-4.5" aria-hidden />
                    ) : (
                      <Lock className="size-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="type-heading">{u.title}</p>
                    {u.state === "current" && (
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar value={u.progress!} max={u.total!} label={u.title} className="flex-1" />
                        <span className="type-data text-muted-foreground">
                          {u.progress}/{u.total}
                        </span>
                      </div>
                    )}
                    {u.state === "locked" && (
                      <p className="type-support mt-0.5">Se abre al dominar la unidad anterior</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* The job track's stations: the product's spine, presented as one path. */}
        <section className="mt-9">
          <p className="type-label">Tu meta: trabajar en inglés</p>
          <div className="mt-3 divide-y divide-hairline overflow-hidden rounded-3xl border border-hairline bg-card">
            <div className="flex items-center gap-4 p-4">
              <Phone className="size-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="type-heading">La llamada simulada</p>
                <p className="type-support">Practica con clientes de verdad — molestos incluidos</p>
              </div>
              <span className="type-data text-muted-foreground">2/5</span>
            </div>
            <div className="flex items-center gap-4 p-4 opacity-70">
              <Mic className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="type-heading">El examen de nivel</p>
                <p className="type-support">Se abre a las 88 frases — te faltan 73</p>
              </div>
              <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
            <div className="flex items-center gap-4 p-4 opacity-70">
              <FileText className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="type-heading">Tu reporte para reclutadores</p>
                <p className="type-support">Solo existe cuando lo ganas — así vale</p>
              </div>
              <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
          </div>
        </section>
      </main>

      <TabBar items={PREVIEW_TABS} activePath="/preview/progress" />
    </div>
  );
}
