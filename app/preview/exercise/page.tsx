"use client";

import { Volume2 } from "lucide-react";
import { SessionShell } from "@/components/system/session";
import { MicButton } from "@/components/system/mic-button";

// Prototype: the shared exercise shell — one practice engine, six modes. This
// shows a speaking rep (the hero mode): prompt zone top, phrase center at
// reading size, mic pinned to the thumb. The "1/8" counter lives in the spine,
// not floating in space.

export default function PreviewExercise() {
  return (
    <SessionShell
      title="Práctica · Hablar"
      step={3}
      totalSteps={8}
      onExit={() => history.back()}
      footer={<MicButton state="idle" label="Tu turno — toca y habla" />}
    >
      <div className="flex min-h-full flex-col items-center justify-center py-6 text-center">
        <p className="type-label">Di la frase</p>

        {/* The phrase is the hero: big, sturdy serif, listen affordance beside it. */}
        <p className="type-display mt-6 max-w-[16ch]" lang="en">
          How can I help you?
        </p>
        <p className="type-support mt-3">¿En qué le puedo ayudar?</p>

        <button
          type="button"
          className="mt-8 inline-flex h-12 items-center gap-2 rounded-full border border-hairline bg-card px-5 text-sm font-medium transition-colors hover:border-foreground/30"
        >
          <Volume2 className="size-4" aria-hidden />
          Escuchar a Joel
        </button>

        {/* Focus hint: the one sound this rep is watching. */}
        <p className="type-support mt-10 max-w-[34ch]">
          Ojo con la <span className="type-data">h</span> de{" "}
          <span lang="en" className="font-medium text-foreground">help</span>: suave,
          como un suspiro — nunca como la j de{" "}
          <span className="font-medium text-foreground">jefe</span>.
        </p>
      </div>
    </SessionShell>
  );
}
