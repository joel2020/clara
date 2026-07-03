"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCategoryStats, useAllAttempts } from "@/lib/hooks/useData";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/content/categories";
import { LESSONS } from "@/lib/content/lessons";
import type { Attempt, CategoryStat } from "@/lib/db/types";
import { useSettings } from "@/lib/hooks/useSettings";
import { blurbFor } from "@/lib/content/es";

// The Weak Sounds dashboard: accuracy by sound category, weakest first, with an
// all-time vs recent comparison and a dot trend of the last attempts so progress
// over time is visible.

const lessonForCategory = (categoryId: string) =>
  LESSONS.find((l) => l.categoryIds.includes(categoryId))?.id ?? "";

export function WeakSounds() {
  const stats = useCategoryStats();
  const attempts = useAllAttempts();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;

  if (!stats || !attempts) {
    return <div className="py-16 text-center text-muted-foreground">Loading…</div>;
  }

  const statById = new Map(stats.map((s) => [s.categoryId, s]));
  const trendByCat = groupRecent(attempts, 12);

  const rows = CATEGORIES.map((c) => ({ category: c, stat: statById.get(c.id) })).sort(
    (a, b) => sortKey(a.stat) - sortKey(b.stat),
  );

  const totalAttempts = attempts.length;
  const totalPasses = attempts.filter((a) => a.passed).length;
  const overall = totalAttempts ? Math.round((totalPasses / totalAttempts) * 100) : 0;

  return (
    <div>
      <div className="flex items-stretch divide-x divide-hairline border-y border-hairline">
        <Stat value={totalAttempts} label="attempts" />
        <Stat value={`${overall}%`} label="overall" accent />
        <Stat value={stats.length} label="sounds touched" />
      </div>

      {totalAttempts === 0 ? (
        <EmptyState />
      ) : (
        <ul className="mt-2">
          {rows.map(({ category, stat }) => (
            <CategoryRow
              key={category.id}
              label={category.label}
              symbols={category.symbols}
              blurb={blurbFor(category.id, category.blurb, lang)}
              stat={stat}
              trend={trendByCat.get(category.id) ?? []}
              lessonId={lessonForCategory(category.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex-1 py-6 text-center">
      <div className={cn("font-display text-3xl font-medium tabular-nums", accent && "text-primary")}>{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
    </div>
  );
}

function CategoryRow({
  label,
  symbols,
  blurb,
  stat,
  trend,
  lessonId,
}: {
  label: string;
  symbols: string;
  blurb: string;
  stat?: CategoryStat;
  trend: boolean[];
  lessonId: string;
}) {
  const acc = stat?.recentAccuracy ?? 0;
  const touched = (stat?.attempts ?? 0) > 0;
  const tone = !touched ? "muted" : acc >= 80 ? "good" : acc >= 50 ? "ok" : "weak";

  return (
    <li>
      <Link href={lessonId ? `/lesson/${lessonId}` : "#"} className="group block border-b border-hairline py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h3 className="font-display text-lg font-medium tracking-[-0.01em] transition-colors group-hover:text-primary">
                {label}
              </h3>
              <span className="font-mono text-xs text-muted-foreground">{symbols}</span>
            </div>
            <p className="mt-1 line-clamp-1 max-w-md text-[13px] text-muted-foreground">{blurb}</p>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "font-display text-2xl font-medium tabular-nums",
                tone === "good" && "text-success",
                tone === "ok" && "text-warn",
                tone === "weak" && "text-destructive",
                tone === "muted" && "text-muted-foreground/40",
              )}
            >
              {touched ? `${acc}%` : "—"}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">recent</div>
          </div>
        </div>

        {touched ? (
          <>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-hairline">
                <div
                  className={cn(
                    "h-px transition-all duration-700",
                    tone === "good" && "bg-success",
                    tone === "ok" && "bg-warn",
                    tone === "weak" && "bg-destructive",
                  )}
                  style={{ width: `${Math.max(acc, 2)}%` }}
                />
              </div>
              <TrendDots trend={trend} />
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">
              {stat?.attempts} attempts · {stat?.accuracy}% all-time · {stat?.masteredItems}/{stat?.practicedItems}{" "}
              mastered
            </p>
          </>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground/70 transition-colors group-hover:text-primary">
            Not practiced yet <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </p>
        )}
      </Link>
    </li>
  );
}

function TrendDots({ trend }: { trend: boolean[] }) {
  return (
    <div className="flex items-center gap-1" aria-label="recent attempts">
      {trend.slice(-8).map((pass, i) => (
        <span
          key={i}
          className={cn("size-1.5 rounded-full", pass ? "bg-success" : "bg-destructive/50")}
          title={pass ? "clear" : "missed"}
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <p className="font-display text-2xl font-medium tracking-[-0.01em]">Nothing to show yet</p>
      <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
        Record a few words in any lesson and your accuracy by sound appears here — so you both know exactly what to work
        on.
      </p>
      <Link
        href="/lesson/i-vs-ii"
        className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
      >
        Start the first lesson
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

function sortKey(stat?: CategoryStat): number {
  if (!stat || stat.attempts === 0) return 1000;
  return stat.recentAccuracy;
}

function groupRecent(attempts: Attempt[], perCat: number): Map<string, boolean[]> {
  const map = new Map<string, boolean[]>();
  for (const a of attempts) {
    if (!CATEGORY_BY_ID.has(a.categoryId)) continue;
    const list = map.get(a.categoryId) ?? [];
    list.push(a.passed);
    map.set(a.categoryId, list);
  }
  for (const [k, v] of map) map.set(k, v.slice(-perCat));
  return map;
}
