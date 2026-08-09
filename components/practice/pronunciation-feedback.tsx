"use client";

import { AlertTriangle, ArrowRight, Check, Gauge, RefreshCw, Volume1, Volume2, Wrench } from "lucide-react";
import { Lumi } from "@/components/lumi";
import { cn } from "@/lib/utils";
import { pronunciationCue, t, type CoachLang } from "@/lib/i18n";
import type { AssessmentResult } from "@/lib/speech/azure-response";
import type { PronunciationDiagnosis } from "@/lib/speech/pronunciation-diagnosis";
import type { PronunciationVerdict } from "@/lib/speech/pronunciation-policy";
import type { PronunciationSessionTransition } from "@/lib/speech/pronunciation-session";

export interface PronunciationFeedbackProps {
  target: string;
  heard: string;
  verdict: PronunciationVerdict;
  diagnosis: PronunciationDiagnosis | null;
  contrast?: { target: string; likelySubstitution: string };
  transition: PronunciationSessionTransition;
  currentScore?: number;
  scores?: AssessmentResult;
  lang: CoachLang;
  onListen: (rate: 0.65 | 1) => void;
  onRetry: () => void;
  onContinue: () => void;
  onTranscriptPractice?: () => void;
  onTechnicalSkip?: () => void;
  saveFailed?: boolean;
  saveFailure?: "storage" | "account-changed";
  onRetrySave?: () => void;
  onAccountChanged?: () => void;
}

const buttonFocus = "min-h-11 min-w-11 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function resultLabel(
  verdict: PronunciationVerdict,
  transition: PronunciationSessionTransition,
  lang: CoachLang,
): { text: string; icon: typeof Check; tone: string } {
  if (verdict.outcome === "mastered") return { text: t("pronClear", lang), icon: Check, tone: "text-success" };
  if (transition.state.status === "practiced-not-mastered") return { text: t("pronAlmost", lang), icon: Gauge, tone: "text-foreground" };
  return { text: t("pronTryAgain", lang), icon: RefreshCw, tone: "text-primary" };
}

export function PronunciationFeedback(props: PronunciationFeedbackProps) {
  if (props.saveFailed || props.saveFailure) return <SaveRecoveryFeedback {...props} />;
  const technical = props.verdict.outcome === "technical-skip" || props.verdict.outcome === "diagnostic";
  if (technical) return <TechnicalFeedback {...props} />;

  const label = resultLabel(props.verdict, props.transition, props.lang);
  const Icon = label.icon;
  const stage = props.transition.coachingStage;
  const scoreChange = props.currentScore !== undefined && props.transition.state.firstValidScore !== undefined
    ? props.currentScore - props.transition.state.firstValidScore
    : null;
  const progressKey = scoreChange === null
    ? null
    : scoreChange > 1
      ? "pronProgressImproved"
      : scoreChange < -1
        ? "pronProgressDeclined"
        : "pronProgressSame";
  const terminal = props.transition.canContinue;
  const contrast = props.diagnosis?.contrast ?? props.contrast;

  return (
    <section
      data-testid="pronunciation-feedback-layout"
      className="grid w-full max-w-3xl gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start"
      aria-labelledby="pronunciation-result"
    >
      <div data-testid="lumi-lane" className="relative flex justify-center sm:sticky sm:top-5 sm:block" aria-hidden="true">
        <Lumi frame="bust" mood={props.verdict.outcome === "mastered" ? "cheer" : "encourage"} className="size-24 shrink-0 [&_img]:z-10 sm:size-32" />
      </div>

      <div data-testid="target-lane" className="min-w-0 rounded-3xl border border-hairline bg-card p-5 shadow-[0_18px_44px_-30px_rgba(18,58,147,0.28)] sm:p-7">
        <div role="status" aria-live="polite" aria-atomic="true">
          <h2 id="pronunciation-result" className={cn("inline-flex items-center gap-2 font-display text-2xl font-semibold", label.tone)}>
            <Icon className="size-6" aria-hidden="true" />
            {label.text}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("pronHeard", props.lang)}: <strong lang="en" className="font-semibold text-foreground">“{props.heard || "—"}”</strong>
          </p>
        </div>

        <div className="mt-4 border-y border-hairline py-4">
          <p lang="en" className="font-display text-3xl font-medium leading-tight tracking-[-0.02em]">{props.target}</p>
        </div>

        <div {...(props.diagnosis ? { "data-testid": "pronunciation-correction" } : {})} className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{t(props.diagnosis ? "pronOneFix" : "pronMouthCue", props.lang)}</p>
            <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
              <span className="font-mono text-sm font-semibold text-foreground">{props.diagnosis?.target ?? props.target}</span>
              <span
                data-testid="sound-path"
                aria-hidden="true"
                className="relative h-px overflow-visible bg-primary/25 after:absolute after:right-0 after:top-1/2 after:size-2 after:-translate-y-1/2 after:rounded-full after:bg-primary motion-safe:after:animate-pulse motion-reduce:after:animate-none"
              />
            </div>
            <div className="mt-3 flex gap-3 rounded-2xl bg-primary/[0.06] p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
                <ArrowRight className="size-4" />
              </span>
              <p lang="es" className="text-sm leading-relaxed text-foreground">
                {props.diagnosis ? pronunciationCue(props.diagnosis.cueKey, "es") : t("pronClearCue", "es")}
              </p>
            </div>
            {stage >= 2 && contrast && (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{t("pronContrast", props.lang)}:</span>{" "}
                <span className="font-mono">{contrast.target}</span>{" → "}
                <span className="font-mono">{contrast.likelySubstitution}</span>
              </p>
            )}
          </div>

        {stage >= 3 && (
          <div className="mt-4 rounded-2xl border border-warn/25 bg-warn/[0.06] p-4 text-sm">
            {progressKey && <p className="font-semibold text-foreground">{t(progressKey, props.lang)}</p>}
            <p className="mt-1 text-foreground">
              <span className="font-semibold">{t("pronMiniChallenge", props.lang)}:</span>{" "}
              {contrast ? t("pronChallengeContrast", props.lang) : t("pronChallengeRhythm", props.lang)}
            </p>
          </div>
        )}

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => props.onListen(0.65)} className={cn(buttonFocus, "inline-flex items-center justify-center gap-2 border border-hairline px-4 text-sm font-medium transition-colors hover:border-primary/40")}>
            <Volume1 className="size-4" aria-hidden="true" /> {t("pronListenSlow", props.lang)}
          </button>
          <button type="button" onClick={() => props.onListen(1)} className={cn(buttonFocus, "inline-flex items-center justify-center gap-2 border border-hairline px-4 text-sm font-medium transition-colors hover:border-primary/40")}>
            <Volume2 className="size-4" aria-hidden="true" /> {t("pronListenNormal", props.lang)}
          </button>
          {!terminal && (
            <button type="button" onClick={props.onRetry} className={cn(buttonFocus, "inline-flex items-center justify-center gap-2 border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.06]")}>
              <RefreshCw className="size-4" aria-hidden="true" /> {t("pronRetry", props.lang)}
            </button>
          )}
          {terminal && (
            <button type="button" onClick={props.onContinue} className={cn(buttonFocus, "inline-flex items-center justify-center gap-2 bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90")}>
              {t("pronContinue", props.lang)} <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        {props.scores && (
          <details className="mt-5 border-t border-hairline pt-4 text-sm text-muted-foreground">
            <summary className="min-h-11 cursor-pointer rounded-lg py-2 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring">{t("pronScoreDetails", props.lang)}</summary>
            <div className="grid gap-1 pt-2 font-mono text-xs tabular-nums">
              {props.scores.pronunciationScore !== undefined && <span>{t("pronScorePronunciation", props.lang)} {Math.round(props.scores.pronunciationScore)}</span>}
              {props.scores.accuracyScore !== undefined && <span>{t("pronScoreAccuracy", props.lang)} {Math.round(props.scores.accuracyScore)}</span>}
              {props.scores.completenessScore !== undefined && <span>{t("pronScoreCompleteness", props.lang)} {Math.round(props.scores.completenessScore)}</span>}
              {props.scores.prosodyScore !== undefined && <span>{t("pronScoreProsody", props.lang)} {Math.round(props.scores.prosodyScore)}</span>}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function SaveRecoveryFeedback(props: PronunciationFeedbackProps) {
  const accountChanged = props.saveFailure === "account-changed";
  return (
    <section data-testid="pronunciation-feedback-layout" className="grid w-full max-w-3xl gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start" aria-labelledby="pronunciation-save-error">
      <div data-testid="lumi-lane" className="flex justify-center" aria-hidden="true">
        <Lumi frame="bust" mood="encourage" className="size-24 shrink-0 [&_img]:z-10 sm:size-32" />
      </div>
      <div data-testid="target-lane" role="alert" className="rounded-3xl border border-warn/30 bg-card p-5 sm:p-7">
        <h2 id="pronunciation-save-error" className="inline-flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
          <AlertTriangle className="size-6 text-warn-foreground" aria-hidden="true" /> {t(accountChanged ? "pronAccountChangedTitle" : "pronSaveFailedTitle", props.lang)}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(accountChanged ? "pronAccountChangedBody" : "pronSaveFailedBody", props.lang)}</p>
        <div className="mt-4 rounded-2xl bg-muted/50 px-4 py-3 text-sm">
          <span className="text-muted-foreground">{t("pronHeard", props.lang)}: </span>
          <strong lang="en" className="font-semibold text-foreground">“{props.heard || "—"}”</strong>
        </div>
        {!accountChanged && (
          <button type="button" onClick={props.onRetrySave} className={cn(buttonFocus, "mt-5 inline-flex w-full items-center justify-center gap-2 bg-foreground px-4 text-sm font-semibold text-background")}>
            <RefreshCw className="size-4" aria-hidden="true" /> {t("pronRetrySave", props.lang)}
          </button>
        )}
        {accountChanged && (
          <button type="button" onClick={props.onAccountChanged ?? props.onContinue} className={cn(buttonFocus, "mt-5 inline-flex w-full items-center justify-center gap-2 bg-foreground px-4 text-sm font-semibold text-background")}>
            {t("pronAccountChangedAction", props.lang)} <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}

function TechnicalFeedback(props: PronunciationFeedbackProps) {
  return (
    <section data-testid="pronunciation-feedback-layout" className="grid w-full max-w-3xl gap-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
      <div data-testid="lumi-lane" className="flex justify-center" aria-hidden="true">
        <Lumi frame="bust" mood="think" className="size-24 shrink-0 [&_img]:z-10 sm:size-32" />
      </div>
      <div data-testid="target-lane" role="status" aria-live="polite" aria-atomic="true" className="rounded-3xl border border-hairline bg-card p-5 sm:p-7">
        <h2 className="inline-flex items-center gap-2 font-display text-2xl font-semibold text-foreground">
          <Wrench className="size-6" aria-hidden="true" /> {t("pronTechnicalTitle", props.lang)}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("pronTechnicalBody", props.lang)}</p>
        <div className="mt-5 grid gap-2">
          <button type="button" onClick={props.onRetry} className={cn(buttonFocus, "inline-flex items-center justify-center gap-2 bg-foreground px-4 text-sm font-semibold text-background")}>
            <RefreshCw className="size-4" aria-hidden="true" /> {t("pronRetryScoring", props.lang)}
          </button>
          {props.onTranscriptPractice && (
            <button type="button" onClick={props.onTranscriptPractice} className={cn(buttonFocus, "border border-hairline px-4 text-sm font-medium")}>
              {t("pronPracticeUngraded", props.lang)}
            </button>
          )}
          {props.onTechnicalSkip && (
            <button type="button" onClick={props.onTechnicalSkip} className={cn(buttonFocus, "px-4 text-sm font-medium text-muted-foreground underline underline-offset-4")}>
              {t("pronTechnicalSkip", props.lang)}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
