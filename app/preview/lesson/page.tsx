"use client";

import Image from "next/image";
import { Volume2, ArrowRight } from "lucide-react";
import { SessionShell } from "@/components/system/session";

// Prototype: the lesson introduction. The teaching moment gets Joel's voice
// (play affordance), a job-context line, and the phrases preview — no more
// silent text card floating in dead space.

export default function PreviewLesson() {
  return (
    <SessionShell title="Saludos · La llamada" step={1} totalSteps={4} onExit={() => history.back()}
      footer={
        <button
          type="button"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Siguiente
          <ArrowRight className="size-5" aria-hidden />
        </button>
      }
    >
      <div className="flex min-h-full flex-col">
        <p className="type-label">La idea · 1 de 4</p>
        <h1 className="type-display mt-3" style={{ fontSize: "clamp(1.5rem, 6vw, 2rem)" }}>
          El primer minuto de toda llamada usa las mismas frases.
        </h1>
        <p className="type-body mt-4 text-muted-foreground">
          Hazlas automáticas y nunca te congelarás en el hola. En un BPO, el saludo
          decide el tono de toda la llamada.
        </p>

        {/* Joel reads the idea aloud — the audio-first product teaches with audio. */}
        <button
          type="button"
          className="mt-6 flex items-center gap-4 rounded-3xl border border-hairline bg-card p-4 text-left transition-colors hover:bg-muted"
        >
          <span className="relative shrink-0">
            <Image
              src="/character/joel-avatar-poster.jpg"
              alt=""
              width={48}
              height={48}
              className="rounded-full object-cover"
              style={{ width: 48, height: 48 }}
            />
            <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <Volume2 className="size-3.5" aria-hidden />
            </span>
          </span>
          <span className="min-w-0">
            <span className="type-heading block">Escucha a Joel</span>
            <span className="type-support block">Por qué esto importa — 0:20</span>
          </span>
        </button>

        {/* What she's about to be able to say: the payoff, visible up front. */}
        <div className="mt-8">
          <p className="type-label">Hoy vas a poder decir</p>
          <ul className="mt-3 space-y-2">
            {["Thank you for calling. How can I help you?", "Good morning! This is Valentina.", "Could I have your name, please?"].map((p) => (
              <li key={p} className="flex items-center gap-3 rounded-2xl border border-hairline bg-card px-4 py-3">
                <span className="type-body font-medium" lang="en">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SessionShell>
  );
}
