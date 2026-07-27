"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAllAttempts, useAllProgress } from "@/lib/hooks/useData";
import { computeReadiness, TARGET_SCORE, type SubskillKey } from "@/lib/readiness";
import { pathOf } from "@/lib/paths";
import { examEligibility } from "@/lib/exams";
import { levelLessonPool } from "@/lib/onboarding";
import { LESSON_BY_ID } from "@/lib/content/lessons";
import { repo } from "@/lib/db";
import { cn } from "@/lib/utils";
import type { Attempt } from "@/lib/db/types";

// The destination, made legible: one number, where it is heading, and the single
// thing holding her back. Both paths render the same card — only the target's
// framing changes — because the honesty of the number matters more than novelty.

const WEEKS = 8;
const WEEK_MS = 7 * 86_400_000;

const LABELS: Record<SubskillKey, { es: string; en: string }> = {
  intelligibility: { es: "Pronunciación", en: "Pronunciation" },
  fluency: { es: "Fluidez", en: "Fluency" },
  listening: { es: "Comprensión", en: "Comprehension" },
  interaction: { es: "Alcance", en: "Range" },
};

/**
 * Mean attempt score per week across her last WEEKS weeks of practice.
 *
 * Anchored to her most recent attempt rather than to the wall clock: reading the
 * clock during render is impure (it breaks memoisation and would flag under
 * react-hooks/purity), and this is her practice history, not a calendar. Weeks
 * with no practice inherit the previous value so the line reads as a plateau
 * rather than a crash to zero — she did not get worse by resting.
 */
function trajectory(attempts: Attempt[], now: number): number[] {
  const buckets: number[][] = Array.from({ length: WEEKS }, () => []);
  for (const a of attempts) {
    const weeksAgo = Math.floor((now - a.at) / WEEK_MS);
    if (weeksAgo >= 0 && weeksAgo < WEEKS) buckets[WEEKS - 1 - weeksAgo].push(a.score);
  }
  const out: number[] = [];
  let carried = 0;
  for (const b of buckets) {
    if (b.length) carried = Math.round(b.reduce((x, y) => x + y, 0) / b.length);
    out.push(carried);
  }
  return out;
}

export function ReadinessCard() {
  const { settings } = useSettings();
  const attempts = useAllAttempts();
  const progress = useAllProgress();
  const lang = settings.coachLanguage;
  const ob = settings.onboarding;

  // Whether she has ever PASSED a sitting — without this the provisional flag can
  // never clear, so the band would read "Provisional" forever and the report would
  // stay unreachable.
  const [examPassed, setExamPassed] = useState(false);
  useEffect(() => {
    void repo.getExamAttempts().then((rows) => setExamPassed(rows.some((r) => r.passed)));
  }, []);

  const readiness = useMemo(() => {
    if (!attempts || !progress) return null;
    return computeReadiness({
      attempts,
      progress,
      band: ob?.level ?? "A1",
      path: pathOf(ob),
      examPassed,
    });
  }, [attempts, progress, ob, examPassed]);

  const points = useMemo(() => {
    if (!attempts?.length) return [];
    const latest = attempts.reduce((m, a) => (a.at > m ? a.at : m), 0);
    return trajectory(attempts, latest);
  }, [attempts]);

  // The stage gate, shown as progress rather than as a hidden rule: she can see
  // exactly how far she is from being allowed to sit the exam.
  const gate = useMemo(() => {
    if (!progress || !ob) return null;
    const poolItemIds = levelLessonPool(ob.level).flatMap(
      (lessonId) => LESSON_BY_ID.get(lessonId)?.items.map((i) => i.id) ?? [],
    );
    return examEligibility(progress, poolItemIds);
  }, [progress, ob]);

  // Nothing to show until her data has loaded, and nothing worth showing until
  // she has been placed — a score with no band behind it means nothing.
  if (!readiness || !ob) return null;

  const path = pathOf(ob);
  const framing =
    path === "job"
      ? lang === "es"
        ? "para trabajar en inglés"
        : "to work in English"
      : lang === "es"
        ? "conversación fluida"
        : "fluent conversation";

  const blockerLabel = readiness.blocker ? LABELS[readiness.blocker][lang] : null;
  const hasTrend = points.filter((p) => p > 0).length >= 2;

  return (
    <section className="rounded-3xl border border-hairline bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
          {lang === "es" ? "Nivel" : "Level"} {readiness.band}
        </span>
        {readiness.provisional && (
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {lang === "es" ? "Provisional" : "Provisional"}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <span className="font-display text-[3.6rem] font-semibold leading-[0.86] tracking-tight tabular-nums">
          {readiness.score}
        </span>
        <span className="pb-2 text-sm text-muted-foreground">/ 100</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {lang === "es" ? "Meta" : "Target"}: <span className="font-semibold text-foreground">B2 · {TARGET_SCORE}</span>{" "}
        — {framing}
      </p>

      {hasTrend && (
        <svg
          viewBox="0 0 340 84"
          className="mt-4 w-full"
          height="84"
          role="img"
          aria-label={
            lang === "es"
              ? `Tu puntaje pasó de ${points.find((p) => p > 0) ?? 0} a ${points[points.length - 1]} en tus últimas ${WEEKS} semanas de práctica. La meta es ${TARGET_SCORE}.`
              : `Your score moved from ${points.find((p) => p > 0) ?? 0} to ${points[points.length - 1]} across your last ${WEEKS} weeks of practice. The target is ${TARGET_SCORE}.`
          }
        >
          {(() => {
            const x = (i: number) => 6 + (i * 328) / (points.length - 1);
            const y = (v: number) => 78 - (v / 100) * 60;
            const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
            const area = `${line} L${x(points.length - 1).toFixed(1)},84 L6,84 Z`;
            const ty = y(TARGET_SCORE).toFixed(1);
            return (
              <>
                <line x1="0" y1={ty} x2="340" y2={ty} stroke="var(--hairline)" strokeWidth="1" strokeDasharray="3 4" />
                <text x="336" y={Number(ty) - 5} textAnchor="end" className="fill-muted-foreground text-[10px]">
                  B2 · {TARGET_SCORE}
                </text>
                <path d={area} fill="oklch(0.42 0.13 262 / 0.10)" />
                <path d={line} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle
                  cx={x(points.length - 1)}
                  cy={y(points[points.length - 1])}
                  r="4.5"
                  fill="var(--primary)"
                  stroke="var(--card)"
                  strokeWidth="2"
                />
              </>
            );
          })()}
        </svg>
      )}

      <div className="mt-5 grid gap-3">
        {readiness.subskills.map((s) => {
          const isBlocker = s.key === readiness.blocker;
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex flex-wrap items-baseline gap-2">
                  {LABELS[s.key][lang]}
                  {/* Says so when fluency is still the pass-rate proxy: on Web
                      Speech nothing measures it, and claiming otherwise would be
                      the one dishonest number on the card. */}
                  {s.key === "fluency" && !readiness.fluencyMeasured && (
                    <span className="text-[11px] text-muted-foreground">
                      {lang === "es" ? "(estimada)" : "(estimated)"}
                    </span>
                  )}
                  {/* State carries a word, never colour alone. */}
                  {isBlocker && (
                    <span className="rounded-full bg-[oklch(0.66_0.11_70_/_0.16)] px-2 py-0.5 text-[11px] font-semibold text-[oklch(0.42_0.08_60)]">
                      {lang === "es" ? "bloquea B2" : "blocks B2"}
                    </span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">{s.score}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                {/* Scores are magnitude, so every bar is the one accent hue. */}
                <div
                  className={cn("h-full rounded-r bg-primary")}
                  style={{ width: `${Math.max(s.score, 1)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {blockerLabel && (
        <p className="mt-4 text-sm text-muted-foreground">
          {lang === "es"
            ? `Para subir a B2, lo único bajo la meta es tu ${blockerLabel.toLowerCase()}.`
            : `To reach B2, the only thing below target is your ${blockerLabel.toLowerCase()}.`}
        </p>
      )}

      {/* Once she has passed a sitting the band is earned, so the report exists.
          Job path only: a recruiter document is not what the confidence path is for. */}
      {!readiness.provisional && path === "job" && (
        <Link
          href="/report"
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-hairline px-4 py-3 text-sm transition-colors hover:border-primary/50"
        >
          <span>{lang === "es" ? "Tu reporte para reclutadores" : "Your recruiter report"}</span>
          <span className="text-muted-foreground">&rarr;</span>
        </Link>
      )}

      {/* The stage gate. Passing the exam is the only way the band changes, so it
          is shown as visible progress rather than an unexplained lock. */}
      {gate && gate.total > 0 && (
        <div className="mt-5 border-t border-hairline pt-4">
          {gate.eligible ? (
            <Link
              href="/exam"
              className="flex items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/[0.06] px-4 py-3 transition-colors hover:border-primary/70"
            >
              <span className="text-sm">
                <span className="font-semibold text-primary">
                  {lang === "es" ? "Examen disponible" : "Exam available"}
                </span>{" "}
                <span className="text-muted-foreground">
                  {lang === "es" ? "— pásalo y subes de nivel." : "— pass it to move up a level."}
                </span>
              </span>
              <span className="text-muted-foreground">&rarr;</span>
            </Link>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {lang === "es" ? "Para desbloquear el examen" : "To unlock the exam"}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {gate.mastered}/{gate.total}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-r bg-primary/50"
                  style={{ width: `${Math.max(Math.round(gate.ratio * 100), 1)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {lang === "es"
                  ? `Te faltan ${gate.remaining} frases dominadas.`
                  : `${gate.remaining} more phrases to master.`}
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
