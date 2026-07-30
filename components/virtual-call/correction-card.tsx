import { ArrowRight, Check, MessageSquareQuote } from "lucide-react";
import { t, type CoachLang, type StringKey } from "@/lib/i18n";
import type { CorrectionKind, TurnCorrection } from "@/lib/virtual-call/session";
import { cn } from "@/lib/utils";

// One correction, rendered inline underneath the turn it belongs to.
//
// Deliberately not a modal or an overlay: a correction that covers the
// conversation makes the learner lose the thread she was mid-way through, and
// she can no longer compare what she said with what Clara said back.

const KIND_LABEL: Record<CorrectionKind, StringKey> = {
  grammar: "vcallKindGrammar",
  vocabulary: "vcallKindVocabulary",
  phrasing: "vcallKindPhrasing",
};

export function CorrectionCard({
  correction,
  lang,
  fixed,
  className,
}: {
  correction: TurnCorrection;
  lang: CoachLang;
  /** She said the fixed sentence back and it was accepted. */
  fixed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-warn/45 bg-warn/[0.06] p-3.5", className)}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <MessageSquareQuote className="size-3.5 text-warn" aria-hidden />
        {t("vcallCorrectionTitle", lang)}
        <span className="rounded-full bg-secondary px-2 py-0.5 tracking-[0.08em]">
          {t(KIND_LABEL[correction.kind], lang)}
        </span>
        {fixed && (
          <span className="inline-flex items-center gap-1 text-success">
            <Check className="size-3.5" aria-hidden />
            {t("vcallReportFixed", lang)}
          </span>
        )}
      </p>

      <div className="mt-2.5 space-y-1.5 text-sm">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs text-muted-foreground">{t("vcallInstead", lang)}</span>
          <span className="min-w-0 break-words text-muted-foreground line-through decoration-muted-foreground/50">
            {correction.original}
          </span>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-foreground">
            <ArrowRight className="size-3.5" aria-hidden />
            {t("vcallSay", lang)}
          </span>
          <span lang="en" className="min-w-0 break-words font-medium">
            {correction.corrected}
          </span>
        </p>
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{correction.explanation}</p>
    </div>
  );
}
