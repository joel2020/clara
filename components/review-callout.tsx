"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAllProgress } from "@/lib/hooks/useData";
import { ITEM_BY_ID } from "@/lib/content/lessons";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

// Surfaces how many words are due to resurface right now (the SRS payoff).
// Hidden until there's actually something due, so the home screen stays calm.

export function ReviewCallout() {
  const progress = useAllProgress();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  if (!progress) return null;

  const now = Date.now();
  const due = progress.filter((p) => p.attempts > 0 && p.dueAt <= now && ITEM_BY_ID.has(p.itemId)).length;

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
