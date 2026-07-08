"use client";

import { Check, MessageCircle, RotateCcw, Sparkles, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTodayQuests } from "@/lib/hooks/useData";
import { useSettings } from "@/lib/hooks/useSettings";
import { QUESTS, questTarget, allQuestsDone, type QuestKind } from "@/lib/quests";
import { t, type StringKey } from "@/lib/i18n";

// Three tiny daily missions. Consistency is the biggest driver of getting to
// conversational, so this card exists to make "do a little today" concrete and
// satisfying — one conversation, a few reviews, a few new words.

const META: Record<QuestKind, { label: StringKey; icon: typeof MessageCircle }> = {
  talk: { label: "questTalk", icon: MessageCircle },
  review: { label: "questReview", icon: RotateCcw },
  learn: { label: "questLearn", icon: Sparkles },
};

export function DailyQuests() {
  const quests = useTodayQuests();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  if (!quests) return null;

  const done = allQuestsDone(quests);

  return (
    <section className="rounded-2xl border border-hairline bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em]">{t("questsTitle", lang)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("questsSub", lang)}</p>
        </div>
        {done && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
            <PartyPopper className="size-3.5" />
            {t("questsAllDone", lang)}
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {QUESTS.map((q) => {
          const meta = META[q.kind];
          const Icon = meta.icon;
          const count = quests[q.kind];
          const target = questTarget(q.kind);
          const complete = count >= target;
          const pct = Math.min(100, Math.round((count / target) * 100));
          return (
            <li key={q.kind} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                  complete ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
                )}
              >
                {complete ? <Check className="size-4" /> : <Icon className="size-4" />}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn("text-sm font-medium", complete && "text-muted-foreground line-through")}>
                    {t(meta.label, lang)}
                  </p>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {Math.min(count, target)}/{target}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hairline">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", complete ? "bg-success" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
