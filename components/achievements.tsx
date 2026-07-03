"use client";

import {
  Sparkles, Flame, Zap, Target, Medal, CalendarCheck, Trophy, Crown, Star, Rocket, BadgeCheck, Gem, Lock,
  type LucideIcon,
} from "lucide-react";
import { usePlayer } from "@/lib/hooks/usePlayer";
import { ACHIEVEMENTS } from "@/lib/gamification";
import { achievementText } from "@/lib/content/es";
import { useSettings } from "@/lib/hooks/useSettings";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Sparkles, Flame, Zap, Target, Medal, CalendarCheck, Trophy, Crown, Star, Rocket, BadgeCheck, Gem,
};

export function Achievements() {
  const player = usePlayer();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const unlocked = new Set(player?.achievements ?? []);
  const count = unlocked.size;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between border-b border-hairline pb-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em]">{lang === "es" ? "Logros" : "Achievements"}</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {count} / {ACHIEVEMENTS.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const Icon = ICONS[a.icon] ?? Sparkles;
          const got = unlocked.has(a.id);
          const tx = achievementText(a.id, a, lang);
          return (
            <div
              key={a.id}
              className={cn(
                "flex flex-col items-center rounded-2xl border p-4 text-center transition-colors",
                got ? "border-primary/30 bg-primary/[0.04]" : "border-hairline bg-card",
              )}
            >
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-xl",
                  got ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground/50",
                )}
              >
                {got ? <Icon className="size-5" /> : <Lock className="size-4" />}
              </span>
              <p className={cn("mt-2 text-sm font-semibold", !got && "text-muted-foreground")}>{tx.name}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{tx.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
