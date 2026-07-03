"use client";

import { Flame } from "lucide-react";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { useSettings } from "@/lib/hooks/useSettings";
import { levelProgress } from "@/lib/gamification";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

// At-a-glance progression for the learner: level (with an XP ring), current
// streak, and today's progress toward the daily goal. The hook that makes a
// learner come back tomorrow.

export function PlayerBar() {
  const player = usePlayer();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  if (!player) return null;

  const lp = levelProgress(player.xp);
  const goalPct = settings.dailyGoal > 0 ? Math.min(100, Math.round((player.todayXp / settings.dailyGoal) * 100)) : 0;

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-hairline bg-card px-5 py-4">
      {/* Level + XP ring */}
      <div className="flex items-center gap-3">
        <Ring pct={lp.pct} size={48} stroke={4}>
          <span className="font-display text-lg font-medium tabular-nums leading-none">{lp.level}</span>
        </Ring>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{t("level", lang)} {lp.level}</p>
          <p className="font-mono text-[11px] text-muted-foreground">{lp.toNext} {t("xpToNext", lang)}</p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-5">
        {/* Streak */}
        <div className="flex items-center gap-2">
          <Flame className={cn("size-5", player.currentStreak > 0 ? "text-warn" : "text-muted-foreground/40")} />
          <div className="leading-tight">
            <p className="font-display text-lg font-medium tabular-nums leading-none">{player.currentStreak}</p>
            <p className="text-[11px] text-muted-foreground">{t("dayStreak", lang)}</p>
          </div>
        </div>

        {/* Daily goal */}
        <div className="hidden items-center gap-2 sm:flex">
          <Ring pct={goalPct} size={40} stroke={3.5} tone="success">
            <span className="font-mono text-[10px] font-semibold tabular-nums">{goalPct}%</span>
          </Ring>
          <div className="leading-tight">
            <p className="font-display text-lg font-medium tabular-nums leading-none">{player.todayXp}</p>
            <p className="text-[11px] text-muted-foreground">/ {settings.dailyGoal} {t("today", lang)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Ring({
  pct,
  size,
  stroke,
  tone = "primary",
  children,
}: {
  pct: number;
  size: number;
  stroke: number;
  tone?: "primary" | "success";
  children: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, pct)) / 100) * c;
  const color = tone === "success" ? "var(--success)" : "var(--primary)";
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute">{children}</span>
    </div>
  );
}
