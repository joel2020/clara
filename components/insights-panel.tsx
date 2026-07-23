"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { db } from "@/lib/db/dexie";
import { computeInsights } from "@/lib/insights";

// The "are we actually working" panel: shows up / finishing / improving at a
// glance. Reads local attempts + analytics events reactively. On the instructor
// dashboard so Joel can see how a learner is really doing.

export function InsightsPanel() {
  const data = useLiveQuery(async () => {
    if (typeof window === "undefined" || !db) return null;
    const [attempts, events] = await Promise.all([db.attempts.toArray(), db.events.toArray()]);
    return computeInsights(attempts, events);
  }, []);

  if (!data) return null;
  const trendIcon =
    data.scoreTrend === "up" ? <TrendingUp className="size-4 text-success" />
    : data.scoreTrend === "down" ? <TrendingDown className="size-4 text-destructive" />
    : data.scoreTrend === "flat" ? <Minus className="size-4 text-muted-foreground" />
    : null;

  return (
    <section className="mt-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Insights</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={`${data.activeDays30}`} label="Días activos (30)" />
        <Tile value={`${data.passRate}%`} label="Aciertos" />
        <Tile
          value={<span className="inline-flex items-center gap-1.5">{data.recentAvgScore}{trendIcon}</span>}
          label="Puntaje reciente"
        />
        <Tile value={data.completionRate === null ? "—" : `${data.completionRate}%`} label="Lecciones terminadas" />
      </div>

      {data.topModes.length > 0 && (
        <div className="mt-4 rounded-2xl border border-hairline bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Modos más usados</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.topModes.map((m) => (
              <span key={m.mode} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
                {m.mode} · {m.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.attempts === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Aún no hay actividad suficiente — las métricas aparecen al practicar.</p>
      )}
    </section>
  );
}

function Tile({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-card p-4 text-center">
      <div className="font-display text-2xl font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
