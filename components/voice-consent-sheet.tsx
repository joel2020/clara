"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import { registerConsentPrompt, VOICE_CONSENT_VERSION } from "@/lib/speech/consent";
import { useSettings } from "@/lib/hooks/useSettings";

// The one-time consent moment before the first voice capture. Concise and
// bilingual by design: the full detail lives at /privacidad, linked here.
// Mounted once in the layout; lib/speech/consent.ts opens it on demand.
export function VoiceConsentSheet() {
  const { update } = useSettings();
  const [open, setOpen] = useState(false);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);

  useEffect(() => {
    registerConsentPrompt(
      () =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve;
          setOpen(true);
        }),
    );
    return () => registerConsentPrompt(null);
  }, []);

  const answer = async (accepted: boolean) => {
    if (accepted) {
      // Persist BEFORE resolving so the capture that triggered the sheet sees
      // consent as granted (per account, per device — Settings row).
      await update({ voiceConsent: { version: VOICE_CONSENT_VERSION, at: Date.now() } });
    }
    setOpen(false);
    resolver.current?.(accepted);
    resolver.current = null;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/30 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="vc-title">
      <div className="w-full max-w-md rounded-3xl border border-hairline bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mic className="size-5" />
          </span>
          <h2 id="vc-title" className="font-display text-lg font-semibold">
            Antes de usar tu voz · Before using your voice
          </h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Para escucharte y calificarte, tu voz se graba solo mientras practicas y se envía a
          servicios de voz (Microsoft, ElevenLabs) y el texto de lo que dices a OpenAI. Clara guarda
          lo que entendió y tus puntajes — no guarda tu audio en sus servidores.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          To hear and score you, your voice is recorded only while you practice and sent to speech
          services (Microsoft, ElevenLabs); the text of what you say goes to OpenAI. Clara stores
          transcripts and scores — it does not keep your audio on its servers.
        </p>
        <p className="mt-2 text-xs">
          <Link href="/privacidad" className="text-primary underline-offset-2 hover:underline">
            Cómo cuidamos tus datos · How your data is handled
          </Link>
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => void answer(true)}
            className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Aceptar y hablar · Accept
          </button>
          <button
            type="button"
            onClick={() => void answer(false)}
            className="rounded-full border border-hairline px-5 py-3 text-sm font-medium transition-colors hover:border-foreground/30"
          >
            Ahora no · Not now
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Si dices que no, puedes seguir con todo lo que no usa micrófono. · If you decline, every
          non-microphone activity still works.
        </p>
      </div>
    </div>
  );
}
