"use client";

import { useState } from "react";
import { CharacterIllustration } from "@/components/character";
import { useAuth } from "@/lib/hooks/useAuth";

// Clara is currently a private-beta product shared by link with family and
// friends. Any Google account may join; admin capabilities remain a separate,
// server-enforced policy. Keeping one authentication path removes password
// resets, confirmation emails, and ambiguity about how to create an account.

export function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueWithGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await signInWithGoogle();
    // On success the browser leaves for Google, so this only runs on failure.
    if (error) {
      setBusy(false);
      setError(friendlyError(error));
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="hero-calm pointer-events-none absolute inset-0" aria-hidden />
      <div className="flag-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mx-auto mb-6 flex flex-col items-center text-center">
          <div className="h-44 w-40 px-1">
            {/* First contact with the product: `welcome`, full figure, and the
                page's LCP element. Decorative — "Bienvenida · Welcome" sits
                directly beneath her and alt must not repeat it. */}
            <CharacterIllustration state="welcome" preload />
          </div>
          <p className="mt-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
            <span className="flag-dots" aria-hidden>
              <i /><i /><i />
            </span>
            Bienvenida · Welcome
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">Clara</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Practica inglés con tu cuenta de Google · Practice English with your Google account
          </p>
        </div>

        <div className="rounded-3xl border border-hairline bg-card p-6 shadow-[0_18px_44px_-24px_rgba(18,58,147,0.25)]">
          <button
            type="button"
            disabled={busy}
            onClick={() => void continueWithGoogle()}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-hairline bg-background py-3 text-sm font-semibold transition-colors hover:border-foreground/30 disabled:opacity-60"
          >
            <GoogleMark />
            {busy ? "Conectando… · Connecting…" : "Continuar con Google · Continue with Google"}
          </button>

          {error && (
            <p role="alert" className="mt-4 text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            Cualquier persona con el enlace y una cuenta de Google puede entrar. No se requiere pago. ·
            Anyone with the link and a Google account can join. No payment is required.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="/privacidad" className="underline-offset-2 hover:underline">
            Privacidad · Privacy
          </a>
        </p>
      </div>
    </div>
  );
}

/** The Google "G", inlined so the button needs no network request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

function friendlyError(raw: string): string {
  const message = raw.toLowerCase();
  if (message.includes("provider is not enabled") || message.includes("unsupported provider")) {
    return "Google no está disponible en este momento · Google sign-in is temporarily unavailable.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Sin conexión. Intenta de nuevo · No connection. Try again.";
  }
  return raw;
}
