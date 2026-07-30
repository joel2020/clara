"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Info, Mic, Sparkles, Volume2 } from "lucide-react";
import Link from "next/link";
import type { VirtualCallScenario } from "@/lib/content/virtual-call-scenarios";
import { t, type CoachLang, type StringKey } from "@/lib/i18n";
import { createRecognition, recognitionErrorKey, type RecognitionHandle } from "@/lib/speech/recognition";
import type { CallReport, ReportCorrection } from "@/lib/virtual-call/report";
import { evaluateRetry, MAX_RECORDING_MS, type CorrectionKind, type RetryOutcome } from "@/lib/virtual-call/session";
import { cn } from "@/lib/utils";
import { formatClock, formatSpokenDuration } from "./format";
import { RetryOutcomeNote } from "./retry-prompt";
import type { CallEntry } from "./use-virtual-call";

// The end-of-call report.
//
// Two rules run through it. First, it leads with what she communicated, because
// a report that opens with mistakes is a report she stops opening. Second, it
// never claims evidence it does not have: when report.pronunciation is absent
// the screen SAYS pronunciation was not measured and why, and never lets an
// empty section read as a perfect score.

const KIND_LABEL: Record<CorrectionKind, StringKey> = {
  grammar: "vcallKindGrammar",
  vocabulary: "vcallKindVocabulary",
  phrasing: "vcallKindPhrasing",
};

export function CallReportView({
  report,
  scenario,
  lang,
  conversation,
  timeUp,
  onReplay,
  onAnother,
  prose,
  humor,
  homeHref,
}: {
  report: CallReport;
  scenario: VirtualCallScenario;
  lang: CoachLang;
  /** The call's lines, when Settings.callTranscriptRetention allows showing them. */
  conversation?: CallEntry[];
  /** The call hit the duration ceiling rather than being ended by hand. */
  timeUp?: boolean;
  /** Speak a sentence again — the "replay a sentence" action. */
  onReplay: (text: string) => void;
  onAnother: () => void;
  /** Model-written encouragement. Null when it never arrived; the computed
   *  report below stands on its own without it. */
  prose?: { summary: string; did_well: string[]; next_activity: string } | null;
  /** An optional Medellin reaction, already vetted by lib/virtual-call/humor. */
  humor?: { text: { es: string; en: string }; slang?: { term: string; meaning: string } } | null;
  homeHref: string;
}) {
  // Prefer Clara's written summary when it arrived; fall back to the locally
  // assembled sentence so a model outage never costs her the report.
  const lead =
    prose?.summary?.trim() ||
    t(report.learnerTurns === 1 ? "vcallReportLeadOne" : "vcallReportLead", lang)
      .replace("{d}", formatSpokenDuration(report.durationMs))
      .replace("{n}", String(report.learnerTurns));

  // The next step follows the evidence: a call that met its criteria earns a
  // harder situation; unfixed corrections earn a second run at this one.
  const nextKey: StringKey = report.priorities.length > 0
    ? report.retriedAcceptedCount > 0
      ? "vcallReportNextRetry"
      : "vcallReportNextSame"
    : report.metCriteria
      ? "vcallReportNextNew"
      : "vcallReportNextSame";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-10 sm:px-6 sm:pt-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {scenario.title[lang]}
      </p>
      <h1 className="mt-3 font-display text-[2rem] font-medium leading-[1.08] tracking-[-0.03em] sm:text-4xl">
        {t("vcallReportTitle", lang)}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{lead}</p>

      {/* An optional Medellin reaction. The selector has already applied the
          learner's humor setting, the once-per-call cap, and the rule that a
          reaction only ever follows success — so if one is here, it belongs. */}
      {humor && (
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">
          {humor.text[lang]}
          {humor.slang && (
            <span className="mt-1 block text-xs text-muted-foreground">
              {humor.slang.term}: {humor.slang.meaning}
            </span>
          )}
        </p>
      )}

      {timeUp && (
        <p className="mt-4 rounded-xl border border-hairline bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
          {t("vcallTimeUp", lang)}
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">{t("vcallReportDuration", lang)}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{formatClock(report.durationMs)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("vcallReportTurns", lang)}</dt>
          <dd className="mt-0.5 font-medium tabular-nums">{report.learnerTurns}</dd>
        </div>
      </dl>

      <Section title={t("vcallReportWentWell", lang)} icon={<Sparkles className="size-4 text-success" aria-hidden />}>
        <ul className="space-y-1.5 text-sm leading-relaxed">
          <li>{t(report.metCriteria ? "vcallReportMet" : "vcallReportNotMet", lang)}</li>
          {report.cleanTurns > 0 && (
            <li>
              {report.cleanTurns === 1
                ? t("vcallReportCleanOne", lang)
                : t("vcallReportClean", lang).replace("{n}", String(report.cleanTurns))}
            </li>
          )}
          {report.retriedCount > 0 && (
            <li>
              {t("vcallReportRetries", lang)
                .replace("{a}", String(report.retriedAcceptedCount))
                .replace("{n}", String(report.retriedCount))}
            </li>
          )}
        </ul>
      </Section>

      <Section title={t("vcallReportPriorities", lang)} icon={<ArrowRight className="size-4 text-warn" aria-hidden />}>
        {report.priorities.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{t("vcallReportNoPriorities", lang)}</p>
        ) : (
          <ol className="space-y-3">
            {report.priorities.map((item, index) => (
              <li key={`${item.corrected}-${index}`} className="min-w-0">
                <CorrectedExample item={item} lang={lang} onReplay={onReplay} index={index + 1} />
              </li>
            ))}
          </ol>
        )}
      </Section>

      {report.corrections.length > report.priorities.length && (
        <Section title={t("vcallReportExamples", lang)}>
          <ul className="space-y-2 text-sm">
            {report.corrections.map((item, index) => (
              <li key={`${item.corrected}-all-${index}`} className="min-w-0 break-words">
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {item.original}
                </span>
                <span aria-hidden> → </span>
                <span className="sr-only"> {t("vcallSay", lang)}: </span>
                <span lang="en" className="font-medium">
                  {item.corrected}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={t("vcallReportVocab", lang)}>
        {report.vocabularyUsed.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{t("vcallReportNoVocab", lang)}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {report.vocabularyUsed.map((phrase) => (
              <li
                key={phrase}
                lang="en"
                className="rounded-full border border-hairline bg-card px-3 py-1.5 text-sm font-medium"
              >
                {phrase}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("vcallReportPron", lang)}>
        {report.pronunciation ? (
          <div className="space-y-2 text-sm">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-medium tabular-nums">
                {report.pronunciation.averageScore}
              </span>
              <span className="text-muted-foreground">
                / 100 · {report.pronunciation.scored} {t("vcallReportPronScored", lang)}
              </span>
            </p>
            {report.pronunciation.worstWords.length > 0 && (
              <p className="text-muted-foreground">
                {t("vcallReportPronWorst", lang)}:{" "}
                <span lang="en" className="font-medium text-foreground">
                  {report.pronunciation.worstWords.join(", ")}
                </span>
              </p>
            )}
          </div>
        ) : (
          // Absent evidence, stated as absent. Never an empty section that could
          // be read as "nothing wrong".
          <p className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="min-w-0">{t("vcallReportPronAbsent", lang)}</span>
          </p>
        )}
      </Section>

      <Section title={t("vcallReportNext", lang)} icon={<ArrowRight className="size-4 text-primary" aria-hidden />}>
        <p className="text-sm leading-relaxed">{t(nextKey, lang)}</p>
      </Section>

      {/* Shown only when her transcript setting allows it. */}
      {conversation && conversation.length > 0 && (
        <Section title={t("vcallReportConversation", lang)}>
          <ol className="space-y-2 text-sm">
            {conversation.map((entry) => (
              <li key={entry.id} className="min-w-0 break-words">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t(entry.kind === "clara" ? "vcallClara" : "vcallYouSaid", lang)}:{" "}
                </span>
                <span lang="en">{entry.text}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onAnother}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          {t("vcallReportAnother", lang)}
          <ArrowRight className="size-4" aria-hidden />
        </button>
        <Link
          href={homeHref}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-hairline px-5 py-3 text-sm font-medium transition-colors hover:border-primary/40"
        >
          {t("backHome", lang)}
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 min-w-0 rounded-2xl border border-hairline bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.14em]">
        {icon}
        {title}
      </h2>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}

/** A corrected sentence she can hear again and say back. */
function CorrectedExample({
  item,
  lang,
  index,
  onReplay,
}: {
  item: ReportCorrection;
  lang: CoachLang;
  index: number;
  onReplay: (text: string) => void;
}) {
  return (
    <div className={cn("rounded-2xl border p-3.5", item.fixedOnRetry ? "border-success/40 bg-success/[0.05]" : "border-hairline bg-secondary/40")}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <span className="tabular-nums">{index}.</span>
        <span className="rounded-full bg-card px-2 py-0.5 tracking-[0.08em]">{t(KIND_LABEL[item.kind], lang)}</span>
        {item.fixedOnRetry && (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3.5" aria-hidden />
            {t("vcallReportFixed", lang)}
          </span>
        )}
      </p>
      <p className="mt-2 break-words text-sm text-muted-foreground line-through decoration-muted-foreground/50">
        {item.original}
      </p>
      <p lang="en" className="mt-1 break-words font-medium">
        {item.corrected}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.explanation}</p>
      <SentencePractice sentence={item.corrected} lang={lang} onReplay={onReplay} />
    </div>
  );
}

/**
 * Hear the corrected sentence again, or say it back.
 *
 * The attempt is judged by evaluateRetry — the same function that judged the
 * retry during the call — so the report cannot hold a softer or harsher bar
 * than the call did.
 */
function SentencePractice({
  sentence,
  lang,
  onReplay,
}: {
  sentence: string;
  lang: CoachLang;
  onReplay: (text: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [outcome, setOutcome] = useState<RetryOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handleRef = useRef<RecognitionHandle | null>(null);

  useEffect(() => () => handleRef.current?.cancel(), []);

  const start = () => {
    setError(null);
    setOutcome(null);
    const handle = createRecognition({ lang: "en-US", target: sentence });
    handleRef.current = handle;
    setRecording(true);
    const cap = setTimeout(() => handle.stop(), MAX_RECORDING_MS);
    handle.result
      .then((result) => {
        clearTimeout(cap);
        handleRef.current = null;
        setRecording(false);
        setOutcome(evaluateRetry(result.transcript.trim(), sentence, Date.now()));
      })
      .catch((e: unknown) => {
        clearTimeout(cap);
        handleRef.current = null;
        setRecording(false);
        if ((e as { code?: string } | null)?.code === "cancelled") return;
        setError(t(recognitionErrorKey(e), lang));
      });
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onReplay(sentence)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline bg-card px-3.5 py-2 text-sm font-medium transition-colors hover:border-primary/40"
        >
          <Volume2 className="size-4" aria-hidden />
          {t("vcallReportHear", lang)}
        </button>
        <button
          type="button"
          onClick={recording ? () => handleRef.current?.stop() : start}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
            recording ? "border-destructive/60 bg-destructive/[0.08] text-destructive" : "border-hairline bg-card hover:border-primary/40",
          )}
        >
          <Mic className="size-4" aria-hidden />
          {recording ? t("vcallStop", lang) : t("vcallReportPractice", lang)}
          <span className="sr-only"> — {sentence}</span>
        </button>
      </div>
      {recording && (
        <p role="status" aria-live="polite" className="text-sm text-destructive">
          {t("vcallRecordingOn", lang)}. {t("vcallListening", lang)}
        </p>
      )}
      {outcome && <RetryOutcomeNote outcome={outcome} lang={lang} />}
      {error && (
        <p role="status" aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
