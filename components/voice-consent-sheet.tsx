"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic } from "lucide-react";
import { registerConsentPrompt, VOICE_CONSENT_VERSION } from "@/lib/speech/consent";
import { useSettings } from "@/lib/hooks/useSettings";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// The one-time consent moment before the first voice capture. Concise and
// bilingual by design: the full detail lives at /privacidad, linked here.
// Mounted once in the layout; lib/speech/consent.ts opens it on demand.
export function VoiceConsentSheet() {
  const { saveVoiceConsent } = useSettings();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const accepting = useRef(false);
  const declineRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    registerConsentPrompt(
      () =>
        new Promise<boolean>((resolve) => {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          resolver.current = resolve;
          setSaveError(false);
          setOpen(true);
        }),
    );
    return () => registerConsentPrompt(null);
  }, []);

  const settle = (accepted: boolean) => {
    const resolve = resolver.current;
    if (!resolve) return;
    resolver.current = null;
    setOpen(false);
    resolve(accepted);
  };

  const answer = async (accepted: boolean) => {
    if (!resolver.current || accepting.current) return;
    if (!accepted) {
      settle(false);
      return;
    }

    // The ref closes the same-event race before React can paint the disabled
    // state. Persistence must win or fail before any dismissal can settle.
    accepting.current = true;
    setSaving(true);
    setSaveError(false);
    try {
      // Persist BEFORE resolving so the capture that triggered the sheet sees
      // consent as granted (per account, per device — Settings row).
      await saveVoiceConsent({ version: VOICE_CONSENT_VERSION, at: Date.now() });
      accepting.current = false;
      setSaving(false);
      settle(true);
    } catch {
      accepting.current = false;
      setSaving(false);
      setSaveError(true);
    }
  };

  return (
    <Dialog
      open={open}
      disablePointerDismissal={saving}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && accepting.current) {
          eventDetails.cancel();
          return;
        }
        if (!nextOpen) void answer(false);
      }}
      onOpenChangeComplete={(nextOpen) => {
        if (!nextOpen) returnFocusRef.current?.focus();
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={declineRef}
        finalFocus={returnFocusRef}
        aria-busy={saving || undefined}
        overlayClassName="z-[80] bg-foreground/30"
        className="top-auto bottom-4 left-4 z-[81] block w-[calc(100%-2rem)] max-w-md translate-x-0 translate-y-0 rounded-3xl border border-hairline bg-card p-6 shadow-xl sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
            <Mic className="size-5" />
          </span>
          <DialogTitle className="font-display text-lg font-semibold leading-normal">
            Antes de usar tu voz · Before using your voice
          </DialogTitle>
        </div>
        <DialogDescription className="mt-3 text-sm text-muted-foreground">
          Un toque inicia la llamada. Después de que Lumi termina cada turno, Clara abre automáticamente
          el micrófono para tu respuesta. Se detiene con el silencio, cuando presionas detener o
          silenciar, cuando el turno llega a 30 segundos o cuando termina la llamada.
        </DialogDescription>
        <p className="mt-2 text-xs text-muted-foreground">
          One tap starts the call. After Lumi finishes each turn, Clara automatically opens the microphone
          for your reply. It stops on silence, when you press stop or mute, when the turn reaches 30 seconds,
          or when the call ends.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Según tu navegador y la configuración, Microsoft Azure Speech, ElevenLabs o el reconocimiento del
          navegador en Google Chrome procesan el audio para transcribirlo. La calificación de pronunciación ocurre
          cuando Azure está configurado. OpenAI recibe la transcripción para que Lumi responda. El audio original es efímero y Clara no lo guarda en sus
          servidores. Clara usa las transcripciones y los puntajes para tu práctica; la transcripción de la
          llamada no se guarda salvo que elijas conservarla en este dispositivo. Para borrar tu cuenta y datos
          en la nube, contacta directamente a tu profesor: la eliminación es manual.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Depending on your browser and configuration, Microsoft Azure Speech, ElevenLabs, or browser recognition
          in Google Chrome process audio for transcription. Pronunciation scoring occurs when Azure is configured.
          OpenAI receives the transcript so Lumi can reply. Raw audio is ephemeral and Clara does not keep it on its servers. Clara uses transcripts and scores
          for your practice; a call transcript is not kept unless you choose to save it on this device. To delete your
          account and cloud data, contact your teacher directly: deletion is manual.
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
            disabled={saving}
            className="flex-1 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            Aceptar y hablar · Accept
          </button>
          <button
            ref={declineRef}
            type="button"
            onClick={() => void answer(false)}
            disabled={saving}
            className="rounded-full border border-hairline px-5 py-3 text-sm font-medium outline-none transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            Ahora no · Not now
          </button>
        </div>
        {saveError && (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            No pudimos guardar tu elección. Intenta de nuevo. · We couldn&apos;t save your choice. Try again.
          </p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Si dices que no, puedes seguir con todo lo que no usa micrófono. · If you decline, every
          non-microphone activity still works.
        </p>
      </DialogContent>
    </Dialog>
  );
}
