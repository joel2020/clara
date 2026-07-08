"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAllProgress, useConvItems } from "@/lib/hooks/useData";
import { countDueReview } from "@/lib/review";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

// Surfaces how many words are due to resurface right now (the SRS payoff) —
// including phrases mined from live conversations. Hidden until there's actually
// something due, so the home screen stays calm.

export function ReviewCallout() {
  const progress = useAllProgress();
  const convItems = useConvItems();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  if (!progress || !convItems) return null;

  const due = countDueReview(progress, convItems);

  if (due === 0) return null;

  return (
    <Link
      href="/review"
      className="group flex items-center gap-4 rounded-2xl border border-primary/25 bg-primary/[0.04] px-5 py-4 transition-colors hover:bg-primary/[0.07] animate-fade-up"
    >
      <span className="font-mono text-2xl font-medium tabular-nums text-primary">{due}</span>
      <div className="flex-1">
        <p className="font-medium">{due === 1 ? t("reviewTitleOne", lang) : t("reviewTitleMany", lang)}</p>
        <p className="text-sm text-muted-foreground">{t("reviewSub", lang)}</p>
      </div>
      <ArrowRight className="size-4 text-primary transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
