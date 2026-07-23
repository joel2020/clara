import type { Attempt, AnalyticsEvent } from "@/lib/db/types";

// Local "YYYY-MM-DD" (device-local) — kept inline so this module has no runtime
// deps and stays trivially testable.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Turns raw attempts + events into the handful of numbers that actually tell us
// whether the app is working: is she showing up, is she finishing, is she
// getting better. Pure functions so they're unit-testable and can run on either
// local or cloud-pulled data.

export interface Insights {
  activeDays30: number; // distinct days with activity in the last 30
  attempts: number;
  passRate: number; // 0..100
  recentAvgScore: number; // mean score of the last 20 attempts
  scoreTrend: "up" | "flat" | "down" | "na"; // recent vs earlier
  completionRate: number | null; // lesson_complete / lesson_start, null if no starts
  topModes: { mode: string; count: number }[];
  lastActiveAt: number | null;
}

const DAY = 86_400_000;

export function computeInsights(attempts: Attempt[], events: AnalyticsEvent[], now = Date.now()): Insights {
  // active days: any attempt or app_open, distinct calendar days in last 30
  const cutoff = now - 30 * DAY;
  const days = new Set<string>();
  for (const a of attempts) if (a.at >= cutoff) days.add(dayKey(new Date(a.at)));
  for (const e of events) if (e.at >= cutoff && (e.type === "app_open" || e.type === "lesson_complete")) days.add(e.day);

  const passes = attempts.reduce((n, a) => n + (a.passed ? 1 : 0), 0);
  const passRate = attempts.length ? Math.round((passes / attempts.length) * 100) : 0;

  const sorted = [...attempts].sort((a, b) => a.at - b.at);
  const recent = sorted.slice(-20);
  const recentAvgScore = recent.length ? Math.round(recent.reduce((n, a) => n + a.score, 0) / recent.length) : 0;

  // trend: mean score of the most recent 20 vs the 20 before that
  const prior = sorted.slice(-40, -20);
  let scoreTrend: Insights["scoreTrend"] = "na";
  if (recent.length >= 8 && prior.length >= 8) {
    const priorAvg = prior.reduce((n, a) => n + a.score, 0) / prior.length;
    const delta = recentAvgScore - priorAvg;
    scoreTrend = delta > 3 ? "up" : delta < -3 ? "down" : "flat";
  }

  const starts = events.filter((e) => e.type === "lesson_start").length;
  const completes = events.filter((e) => e.type === "lesson_complete").length;
  const completionRate = starts ? Math.min(100, Math.round((completes / starts) * 100)) : null;

  const modeCounts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "mode_open") continue;
    const mode = String(e.props?.mode ?? "?");
    modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1);
  }
  const topModes = [...modeCounts.entries()]
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const lastActiveAt = Math.max(
    attempts.reduce((m, a) => Math.max(m, a.at), 0),
    events.reduce((m, e) => Math.max(m, e.at), 0),
  ) || null;

  return { activeDays30: days.size, attempts: attempts.length, passRate, recentAvgScore, scoreTrend, completionRate, topModes, lastActiveAt };
}
