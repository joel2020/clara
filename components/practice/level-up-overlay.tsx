"use client";

import { useEffect } from "react";
import { Rocket } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";

// A brief, celebratory level-up card. Auto-dismisses; click anywhere to close.

export function LevelUpOverlay({ level, onClose }: { level: number; onClose: () => void }) {
  const { settings } = useSettings();
  const name = settings.studentName;
  const es = settings.coachLanguage === "es";
  useEffect(() => {
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-label={`Level ${level} reached`}
    >
      <div className="animate-scale-in rounded-3xl border border-hairline bg-card px-10 py-8 text-center shadow-xl">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Rocket className="size-7" />
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
          ¡Subiste de nivel! · Level up
        </p>
        <p className="mt-1 font-display text-5xl font-medium tracking-[-0.03em]">{level}</p>
        <p className="mt-2 text-sm text-muted-foreground">{es ? `Cada vez más claro${name ? `, ${name}` : ""}. Sigue así.` : `You\u0027re getting sharper${name ? `, ${name}` : ""}. Keep going.`}</p>
        <div className="flag-bar mx-auto mt-5 h-[3px] w-16 rounded-full" aria-hidden />
      </div>
    </div>
  );
}
