"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Star, Zap, CircleCheck, CircleAlert } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { isAdmin } from "@/lib/allowlist";
import { authHeaders } from "@/lib/auth-client";

// The coach cockpit — Joel's view of every student at a glance. Admin-only.
// One screen: who practiced today, streaks, accuracy, and who's gone quiet.

/** An uncaught client error from the last 7 days, newest first. */
interface ClientError {
  at: number;
  source: string;
  message: string;
  path: string;
  frame: string;
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
}

function daysAgo(day: string | null): number | null {
  if (!day) return null;
  const then = new Date(day + "T00:00:00").getTime();
  return Math.floor((Date.now() - then) / 86_400_000);
}

export default function CoachPage() {
  const { user, ready, required } = useAuth();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [errors, setErrors] = useState<ClientError[]>([]);
  const [error, setError] = useState<string | null>(null);

  const admin = !required || isAdmin(user?.email);

  useEffect(() => {
    if (!ready || !admin) return;
    void (async () => {
      try {
        const res = await fetch("/api/coach", { headers: await authHeaders() });
        if (!res.ok) {
          setError(res.status === 403 ? "forbidden" : "error");
          return;
        }
        const data = (await res.json()) as { students: Student[]; errors?: ClientError[] };
        setStudents(data.students);
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

  const activeCount = students?.filter((s) => s.activeToday).length ?? 0;
  const quiet = students?.filter((s) => (daysAgo(s.lastActiveDay) ?? 99) >= 3) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-6">
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Inicio
      </Link>

      <header className="animate-fade-up">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Cockpit</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">Tus estudiantes</h1>
        {students && (
          <p className="mt-2 text-sm text-muted-foreground">
            {students.length} en total · {activeCount} activos hoy{quiet.length > 0 ? ` · ${quiet.length} sin practicar (3+ días)` : ""}
          </p>
        )}
      </header>

      {error === "forbidden" && <p className="mt-8 text-sm text-destructive">No autorizado.</p>}
      {!students && !error && <p className="mt-8 text-sm text-muted-foreground">Cargando…</p>}
      {students?.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Aún no hay estudiantes con actividad. Aparecen aquí cuando practican.</p>
      )}

      <div className="mt-6 space-y-3">
        {students?.map((s) => {
          const ago = daysAgo(s.lastActiveDay);
          const isQuiet = (ago ?? 99) >= 3;
          return (
            <div
              key={s.id}
              className={cnRow(isQuiet)}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 font-display text-lg text-primary">
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {s.activeToday ? (
                      <><CircleCheck className="size-3.5 text-success" /> Practicó hoy</>
                    ) : isQuiet ? (
                      <><CircleAlert className="size-3.5 text-warn" /> {ago === null ? "Nunca" : `Hace ${ago} días`}</>
                    ) : (
                      <>{ago === 0 ? "Hoy" : ago === 1 ? "Ayer" : `Hace ${ago} días`}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-sm">
                <Metric icon={<Flame className="size-4 text-warn" />} value={s.streak} />
                <Metric icon={<Star className="size-4 text-co-yellow" style={{ fill: "currentColor" }} />} value={s.stars} />
                <Metric icon={<Zap className="size-4 text-primary" />} value={`Nv ${Math.max(1, Math.floor(s.xp / 100) + 1)}`} />
                <span className="hidden w-14 text-right text-muted-foreground sm:inline">{s.passRate}%</span>
              </div>
            </div>
          );
        })}
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

function cnRow(quiet: boolean): string {
  return `flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3.5 ${quiet ? "border-warn/40" : "border-hairline"}`;
}

function Metric({ icon, value }: { icon: React.ReactNode; value: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium tabular-nums">
      {icon}
      {value}
    </span>
  );
}
