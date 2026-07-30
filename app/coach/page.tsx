"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, CircleAlert, Flame, Mic, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useAccess } from "@/lib/hooks/useAccess";
import { authHeaders } from "@/lib/auth-client";

// The coach cockpit — Joel's view of every student at a glance. Admin-only at
// this layer AND at /api/coach, which returns 403 before it reads anything.
//
// One screen, phone first: who practiced, how her sessions are going, whether
// she is actually speaking, what she is struggling with, what is due, and
// whether anything is broken on our side. Definitions live in
// docs/learning-metrics.md — this file only renders them.

/** An uncaught client error from the last 7 days, newest first. */
interface ClientError {
  at: number;
  source: string;
  message: string;
  path: string;
  frame: string;
}

interface WeakArea {
  area: string;
  misses: number;
  attempts: number;
  dueItems: number;
  missRate: number;
}

interface Student {
  id: string;
  name: string;
  xp: number;
  stars: number;
  streak: number;
  longestStreak: number;
  attempts: number;
  passRate: number;
  lastActiveDay: string | null;
  activeToday: boolean;
  daysSince: number | null;
  level: string | null;
  path: string;
  sessions: { startedDays: number; completedDays: number; completionRate: number | null; practiceMinutes: number };
  speaking: { attempts: number; days: number; participationRate: number | null };
  weakAreas: WeakArea[];
  review: { dueItems: number; due: number; completed: number; completionRate: number | null };
  technical: { failures: number; categories: { category: string; count: number }[] };
  sync: { lagDays: number | null; failures: number };
  warnings: string[];
}

interface Metrics {
  windowDays: number;
  learners: number;
  dailyActiveLearners: number;
  sessionCompletionRate: number | null;
  nextDayReturnRate: number | null;
  sevenDayReturnRate: number | null;
  meaningfulPracticeMinutes: number | null;
  speakingParticipationRate: number | null;
  reviewCompletionRate: number | null;
  technicalFailureRate: number | null;
}

/** Bounded warning codes from the API, in the words Joel would use. */
const WARNINGS: Record<string, string> = {
  "never-practiced": "Nunca ha practicado",
  quiet: "Sin practicar",
  "session-drop": "Deja la sesión a medias",
  "no-speaking": "No está hablando",
  "review-backlog": "Repaso atrasado",
  "sync-lag": "Sincronización pendiente",
  "technical-trouble": "Fallas técnicas",
};

const PATHS: Record<string, string> = { job: "Trabajo", general: "General" };

function lastPractice(s: Student): string {
  if (s.daysSince === null) return "Nunca";
  if (s.daysSince === 0) return "Hoy";
  if (s.daysSince === 1) return "Ayer";
  return `Hace ${s.daysSince} días`;
}

/** Percentages read as "—" when there is nothing to divide by: 0% would be a lie. */
const pct = (value: number | null): string => (value === null ? "—" : `${value}%`);

export default function CoachPage() {
  const { ready } = useAuth();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [errors, setErrors] = useState<ClientError[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { admin } = useAccess();

  useEffect(() => {
    if (!ready || !admin) return;
    void (async () => {
      try {
        const res = await fetch("/api/coach", { headers: await authHeaders() });
        if (!res.ok) {
          setError(res.status === 403 ? "forbidden" : "error");
          return;
        }
        const data = (await res.json()) as { students: Student[]; metrics?: Metrics; errors?: ClientError[] };
        setStudents(data.students);
        setMetrics(data.metrics ?? null);
        setErrors(data.errors ?? []);
      } catch {
        setError("error");
      }
    })();
  }, [ready, admin]);

  if (ready && !admin) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="font-display text-2xl font-medium">Solo para el profe</p>
        <p className="mt-2 text-muted-foreground">This page is for the teacher.</p>
        <Link href="/" className="mt-6 inline-flex rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background">Inicio</Link>
      </div>
    );
  }

  const quiet = students?.filter((s) => s.warnings.length > 0).length ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-6">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Inicio
      </Link>

      <header className="animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Cockpit</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Tus estudiantes</h1>
        {students && metrics && (
          <p className="mt-2 text-sm text-muted-foreground">
            {students.length} en total · {metrics.dailyActiveLearners} activos hoy
            {quiet > 0 ? ` · ${quiet} necesitan atención` : ""}
          </p>
        )}
      </header>

      {metrics && (
        <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Métricas de ${metrics.windowDays} días`}>
          <Tile label="Sesiones completas" value={pct(metrics.sessionCompletionRate)} />
          <Tile label="Habla en sesión" value={pct(metrics.speakingParticipationRate)} />
          <Tile label="Vuelve al día siguiente" value={pct(metrics.nextDayReturnRate)} />
          <Tile
            label="Fallas técnicas"
            value={pct(metrics.technicalFailureRate)}
            warn={(metrics.technicalFailureRate ?? 0) >= 5}
          />
        </section>
      )}

      {error === "forbidden" && <p className="mt-8 text-sm text-destructive">No autorizado.</p>}
      {error === "error" && <p className="mt-8 text-sm text-destructive">No se pudo cargar.</p>}
      {!students && !error && <p className="mt-8 text-sm text-muted-foreground">Cargando…</p>}
      {students?.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Aún no hay estudiantes con actividad. Aparecen aquí cuando practican.</p>
      )}

      <div className="mt-4 space-y-3">
        {students?.map((s) => (
          <article
            key={s.id}
            className={`rounded-2xl border bg-card px-4 py-3.5 ${s.warnings.length > 0 ? "border-warn/40" : "border-hairline"}`}
          >
            {/* 1. Who, and is she practicing — the only line that must survive a 320px screen. */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 font-display text-lg text-primary">
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    {s.activeToday ? (
                      <><CircleCheck className="size-3.5 text-success" /> Practicó hoy</>
                    ) : s.warnings.includes("quiet") || s.warnings.includes("never-practiced") ? (
                      <><CircleAlert className="size-3.5 text-warn" /> {lastPractice(s)}</>
                    ) : (
                      lastPractice(s)
                    )}
                    {s.streak > 0 && (
                      <span className="inline-flex items-center gap-0.5 tabular-nums">
                        <Flame className="size-3.5 text-warn" />
                        {s.streak}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium tabular-nums">
                {s.level ?? "—"} · {PATHS[s.path] ?? "General"}
              </span>
            </div>

            {/* 2. How the practice is going. */}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <Stat
                label="Sesiones"
                value={`${s.sessions.completedDays}/${s.sessions.startedDays}`}
                hint={pct(s.sessions.completionRate)}
              />
              <Stat
                label={<><Mic className="inline size-3" aria-hidden /> Habla</>}
                value={pct(s.speaking.participationRate)}
                hint={`${s.speaking.attempts} intentos`}
              />
              <Stat label="Repaso" value={`${s.review.dueItems}`} hint={s.review.dueItems === 1 ? "pendiente" : "pendientes"} />
            </dl>

            {/* 3. What to work on with her. */}
            {s.weakAreas.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Cuesta:</span>
                {s.weakAreas.map((w) => (
                  <span key={w.area} className="rounded-full bg-warn/10 px-2 py-0.5 font-medium text-warn-foreground">
                    {w.area}
                    <span className="ml-1 font-normal tabular-nums text-muted-foreground">
                      {w.attempts > 0 ? `${w.missRate}%` : `${w.dueItems} por repasar`}
                    </span>
                  </span>
                ))}
              </p>
            )}

            {/* 4. Anything broken on our side. */}
            {s.warnings.length > 0 && (
              <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                {s.warnings.map((code) => (
                  <span key={code} className="inline-flex items-center gap-1 rounded-full border border-warn/40 px-2 py-0.5 text-warn-foreground">
                    {code === "sync-lag" && <RefreshCw className="size-3" aria-hidden />}
                    {WARNINGS[code] ?? code}
                    {code === "sync-lag" && s.sync.lagDays !== null && s.sync.lagDays > 0 ? ` (${s.sync.lagDays}d)` : ""}
                    {code === "technical-trouble" && s.technical.categories[0]
                      ? `: ${s.technical.categories[0].category}`
                      : ""}
                  </span>
                ))}
              </p>
            )}
          </article>
        ))}
      </div>

      {/* Production errors. Deliberately last: it should be empty, and when it is not
          it is the most important thing on the page. */}
      {errors.length > 0 && (
        <section className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-warn-foreground">
            Errores esta semana ({errors.length})
          </p>
          <div className="mt-3 grid gap-2">
            {errors.map((e, i) => (
              <div key={`${e.at}-${i}`} className="rounded-2xl border border-warn/40 bg-card px-4 py-3 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{e.message || "(sin mensaje)"}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {new Date(e.at).toLocaleString("es-CO")}
                  </span>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {e.path}
                  {e.source ? ` · ${e.source}` : ""}
                  {e.frame ? ` · ${e.frame}` : ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-2.5 ${warn ? "border-warn/40 bg-warn/5" : "border-hairline bg-card"}`}>
      <p className="font-display text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: React.ReactNode; value: string; hint: string }) {
  return (
    <div className="rounded-xl bg-muted/50 px-2.5 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">
        {value} <span className="font-normal text-muted-foreground">{hint}</span>
      </dd>
    </div>
  );
}
