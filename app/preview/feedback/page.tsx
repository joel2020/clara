"use client";

import { ArrowRight } from "lucide-react";
import { SessionShell } from "@/components/system/session";
import { FeedbackPanel, Stamp } from "@/components/system/feedback";
import { ProgressBar } from "@/components/system/progress";

// Prototype: (a) the per-attempt feedback anatomy and (b) the session close —
// the delta that matters, the stamp, and tomorrow's promise. No star rain.

export default function PreviewFeedback() {
  return (
    <SessionShell
      title="Práctica · Hablar"
      step={8}
      totalSteps={8}
      onExit={() => history.back()}
      footer={
        <button
          type="button"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Listo por hoy
          <ArrowRight className="size-5" aria-hidden />
        </button>
      }
    >
      <div className="space-y-8 py-2">
        {/* The attempt feedback: honored words, one fix, replay. */}
        <FeedbackPanel
          heard={[
            { text: "How", landed: true },
            { text: "can", landed: true },
            { text: "I", landed: true },
            { text: "help", landed: false },
            { text: "you?", landed: true },
          ]}
          fix={{
            focus: "help",
            tip: "Esa h va suave, con aire — 'jelp' con j paisa suena a otra letra. Susúrrala.",
          }}
          onReplay={() => {}}
        />

        {/* Session close: earned delta, stamped once, phrased toward the goal. */}
        <div className="rounded-3xl border border-hairline bg-card p-6 text-center">
          <Stamp>Sesión completa</Stamp>
          <p className="type-body mt-5">
            <strong>3 frases nuevas dominadas.</strong>
          </p>
          <div className="mx-auto mt-4 max-w-xs">
            <div className="flex items-baseline justify-between">
              <p className="type-label">Nivel entrevista</p>
              <p className="type-data text-muted-foreground">12 → 15</p>
            </div>
            <ProgressBar value={15} max={110} label="Nivel entrevista" className="mt-2" />
          </div>
          <p className="type-support mx-auto mt-5 max-w-[36ch]">
            Mañana: la llamada de Carolina — vas a manejar una cliente molesta. Ya
            tienes las frases para lograrlo.
          </p>
        </div>
      </div>
    </SessionShell>
  );
}
