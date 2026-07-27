"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAllAttempts, useAllProgress } from "@/lib/hooks/useData";
import { repo } from "@/lib/db";
import { Splash } from "@/components/splash";
import { buildReport } from "@/lib/report";
import type { CallScore, ExamAttempt } from "@/lib/db/types";

// The report she sends with a job application.
//
// Print-first: "Descargar PDF" is the browser's own print-to-PDF, which keeps the
// document a real page rather than a screenshot and needs no PDF dependency.
//
// The honesty constraints are the whole point. It shows nothing until she has
// passed an exam, it never claims a band higher than one she demonstrated, and it
// carries an explicit line saying this is a practice assessment and not an official
// certification. A document that oversells her would lose her the interview it was
// meant to win.

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function formatDate(ms: number, lang: "es" | "en"): string {
  const d = new Date(ms);
  if (lang === "es") return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function ReportPage() {
  const { settings, ready } = useSettings();
  const attempts = useAllAttempts();
  const progress = useAllProgress();
  const lang = settings.coachLanguage;

  const [exams, setExams] = useState<ExamAttempt[] | null>(null);
  const [calls, setCalls] = useState<CallScore[] | null>(null);
  useEffect(() => {
    void repo.getExamAttempts().then(setExams);
    void repo.getCallScores().then(setCalls);
  }, []);

  const report = useMemo(() => {
    if (!attempts || !progress || !exams || !calls) return null;
    return buildReport({ attempts, progress, exams, calls, profileId: settings.profileId });
  }, [attempts, progress, exams, calls, settings.profileId]);

  if (!ready || !report) return <Splash />;

  const name = settings.studentName || "—";

  if (!report.ready) {
    return (
      <div className="mx-auto max-w-xl px-5 pb-24 pt-6 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {lang === "es" ? "Inicio" : "Home"}
        </Link>
        <div className="mt-6 rounded-3xl border border-hairline bg-card p-6">
          <h1 className="font-display text-2xl font-semibold">
            {lang === "es" ? "Tu reporte, cuando lo ganes" : "Your report, once you earn it"}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {lang === "es"
              ? "El reporte solo existe después de pasar un examen de nivel. No queremos darte un documento que diga más de lo que ya demostraste — eso te costaría la entrevista."
              : "The report only exists after you pass a stage exam. We will not hand you a document that claims more than you have demonstrated — that would cost you the interview."}
          </p>
          <Link
            href="/exam"
            className="mt-6 block rounded-2xl bg-primary px-5 py-3.5 text-center text-sm font-semibold text-primary-foreground"
          >
            {lang === "es" ? "Ir al examen" : "Go to the exam"}
          </Link>
        </div>
      </div>
    );
  }

  const stats: { label: string; value: string }[] = [
    { label: lang === "es" ? "Puntaje del examen" : "Exam score", value: String(report.examScore) },
    { label: lang === "es" ? "Frases dominadas" : "Phrases mastered", value: String(report.phrasesMastered) },
    { label: lang === "es" ? "Días de práctica" : "Days practised", value: String(report.activeDays) },
    { label: lang === "es" ? "Precisión" : "Accuracy", value: `${report.accuracy}%` },
  ];
  if (report.callsCompleted > 0) {
    stats.push({
      label: lang === "es" ? "Llamadas evaluadas" : "Calls assessed",
      value: `${report.callsCompleted}${report.callAverage !== null ? ` · ${report.callAverage}` : ""}`,
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-6 sm:px-6">
      <div className="print:hidden">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {lang === "es" ? "Inicio" : "Home"}
        </Link>
      </div>

      {/* The document itself. Kept deliberately plain: a recruiter should be able to
          read it in five seconds and it must survive being printed in black ink. */}
      <article className="mt-6 rounded-3xl border border-hairline bg-card p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight">{name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lang === "es" ? "Inglés hablado · evaluación de práctica" : "Spoken English · practice assessment"}
            </p>
          </div>
          <div className="text-right text-xs tabular-nums text-muted-foreground">
            {report.passedAt !== null && <p>{formatDate(report.passedAt, lang)}</p>}
            <p>ID {report.id}</p>
          </div>
        </header>

        <div className="mt-8 flex items-end gap-4">
          <span className="font-display text-6xl font-semibold leading-none text-primary">{report.band}</span>
          <p className="pb-1 text-sm text-muted-foreground">
            {lang === "es"
              ? "Alineado a los descriptores del MCER\npara producción oral."
              : "Aligned to CEFR descriptors\nfor spoken production."}
          </p>
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="border-t border-hairline pt-3">
              <dd className="font-display text-xl font-semibold tabular-nums">{s.value}</dd>
              <dt className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{s.label}</dt>
            </div>
          ))}
        </dl>

        <footer className="mt-10 flex items-end justify-between gap-6 border-t border-hairline pt-4">
          <div>
            <p className="font-display text-lg italic">Joel Carias</p>
            <p className="text-xs text-muted-foreground">{lang === "es" ? "Instructor" : "Instructor"}</p>
          </div>
          <p className="max-w-[24ch] text-right text-[10px] leading-snug text-muted-foreground">
            {lang === "es"
              ? "Evaluación de práctica. No es una certificación oficial ni está afiliada a ningún examen comercial."
              : "Practice assessment. Not an official certification and not affiliated with any commercial test."}
          </p>
        </footer>
      </article>

      <div className="mt-6 grid gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground"
        >
          <Printer className="size-4" /> {lang === "es" ? "Descargar PDF" : "Download PDF"}
        </button>
        <p className="text-center text-xs text-muted-foreground">
          {lang === "es"
            ? "Se abre la impresión de tu teléfono: elige Guardar como PDF."
            : "Opens your device's print dialog: choose Save as PDF."}
        </p>
      </div>
    </div>
  );
}
