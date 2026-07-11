"use client";

import { useState } from "react";
import { Lumi } from "@/components/lumi";
import { useAuth } from "@/lib/hooks/useAuth";

// The access gate. Clara is public, so this stands in front of the whole app:
// only a signed-in account gets in (and can call the paid AI routes). Sign-in
// only on purpose — accounts are provisioned by the teacher in Supabase, so
// there's no open registration for strangers to grab and abuse the paid routes.
// Email + password because magic links break out of the installed iOS PWA.

export function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError(friendlyError(error));
    // On success the AuthProvider's onAuthStateChange swaps this screen for the app.
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="game-hero pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div className="flag-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mx-auto mb-6 flex flex-col items-center text-center">
          <div className="h-28 w-24">
            <Lumi mood="wave" priority />
          </div>
          <p className="mt-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
            <span className="flag-dots" aria-hidden>
              <i /><i /><i />
            </span>
            Bienvenida · Welcome
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">Clara</h1>
          <p className="mt-1 text-sm text-muted-foreground">Inicia sesión para practicar · Sign in to practice</p>
        </div>

        <form onSubmit={submit} className="rounded-3xl border border-hairline bg-card p-6 shadow-[0_18px_44px_-24px_rgba(18,58,147,0.25)]">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Correo · Email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-2.5 text-base outline-none transition-colors focus:border-primary"
            placeholder="mariana@ejemplo.com"
          />

          <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Contraseña · Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-2.5 text-base outline-none transition-colors focus:border-primary"
            placeholder="••••••••"
          />

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-full bg-primary py-3 font-display text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "…" : "Entrar · Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          ¿Sin cuenta? Pídele una a tu profe · No account? Ask your teacher for one.
        </p>
      </div>
    </div>
  );
}

function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return "Correo o contraseña incorrectos · Wrong email or password.";
  if (m.includes("email not confirmed")) return "Confirma tu correo primero · Confirm your email first.";
  if (m.includes("network")) return "Sin conexión · No connection.";
  return raw;
}
