"use client";

import { useEffect, useRef } from "react";
import { Rocket } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// A brief, celebratory level-up card. It auto-dismisses without requiring a
// response, while the explicit close button gives keyboard and touch users control.

export function LevelUpOverlay({ level, onClose }: { level: number; onClose: () => void }) {
  const { settings } = useSettings();
  const name = settings.studentName;
  const es = settings.coachLanguage === "es";
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(() => {
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={closeRef}
        finalFocus={returnFocusRef}
        overlayClassName="bg-foreground/20 backdrop-blur-sm animate-fade-in"
        className="animate-scale-in block max-w-sm rounded-3xl border border-hairline bg-card px-10 py-8 text-center shadow-xl"
      >
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/12 text-primary">
          <Rocket className="size-7" aria-hidden="true" />
        </div>
        <DialogTitle className="mt-4 text-[11px] font-semibold uppercase leading-normal tracking-[0.2em] text-primary">
          ¡Subiste de nivel! · Level up
        </DialogTitle>
        <p className="mt-1 font-display text-5xl font-medium tracking-[-0.03em]">{level}</p>
        <DialogDescription className="mt-2 text-sm text-muted-foreground">{es ? `Cada vez más claro${name ? `, ${name}` : ""}. Sigue así.` : `You\u0027re getting sharper${name ? `, ${name}` : ""}. Keep going.`}</DialogDescription>
        <div className="flag-bar mx-auto mt-5 h-[3px] w-16 rounded-full" aria-hidden />
        <DialogClose
          ref={closeRef}
          className="mt-6 rounded-full border border-hairline px-5 py-2.5 text-sm font-medium outline-none transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {es ? "Cerrar" : "Close"}
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
