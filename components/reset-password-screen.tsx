"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lumi } from "@/components/lumi";
import { useAuth } from "@/lib/hooks/useAuth";
import { supabase } from "@/lib/db/supabase";

// Set-a-new-password screen, shown by AuthGate when the emailed reset link lands
// on /reset. The link carries a one-time recovery token; we exchange it for a
// short-lived session, let her choose a new password, then sign out so she signs
// in fresh with it.
//
// The Supabase client is configured with detectSessionInUrl:false (magic links
// break out of the installed iOS PWA), so the token is parsed here by hand rather
// than automatically. Both link shapes are handled: the implicit hash
// (#access_token&refresh_token&type=recovery) and the PKCE query (?code=).

type Phase = "verifying" | "ready" | "invalid" | "done";

export function ResetPasswordScreen() {
  const { updatePassword, signOut } = useAuth();
  const [phase, setPhase] = useState<Phase>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Turn the emailed link's token into a recovery session. All state updates live
  // inside the async callback so none runs synchronously in the effect body.
  useEffect(() => {
    let active = true;
    void (async () => {
      const sb = supabase();
      if (!sb) {
        if (active) setPhase("invalid");
        return;
      }
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (!active) return;
          setPhase(error ? "invalid" : "ready");
        } else if (accessToken && refreshToken) {
          const { error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!active) return;
          setPhase(error ? "invalid" : "ready");
        } else {
          // No token in the URL, but a recovery session may already be active.
          const { data } = await sb.auth.getSession();
          if (!active) return;
          setPhase(data.session ? "ready" : "invalid");
        }
        // Scrub the token from the address bar either way.
        window.history.replaceState(null, "", "/reset");
      } catch {
        if (active) setPhase("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres · Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden · Passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setError(friendlyError(error));
      return;
    }
    // Sign out so the recovery session doesn't linger — she signs in fresh.
    await signOut();
    setPhase("done");
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="hero-calm pointer-events-none absolute inset-0" aria-hidden />
      <div className="flag-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mx-auto mb-6 flex flex-col items-center text-center">
          <div className="h-40 w-36 px-1">
            <Lumi mood={phase === "done" ? "clap" : "think"} priority depth />
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">Clara</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nueva contraseña · New password
          </p>
        </div>

        {phase === "verifying" && (
          <p className="text-center text-sm text-muted-foreground">Verificando el enlace · Checking your link…</p>
        )}

        {phase === "invalid" && (
          <div className="rounded-3xl border border-hairline bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Este enlace ya no es válido. Pide uno nuevo desde &ldquo;¿Olvidaste tu contraseña?&rdquo;.
              <br />
              This link is no longer valid. Request a new one from &ldquo;Forgot your password?&rdquo;.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full border border-hairline px-5 py-2.5 text-sm font-medium transition-colors hover:border-foreground/30"
            >
              Volver · Back
            </Link>
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={submit} className="rounded-3xl border border-hairline bg-card p-6 shadow-[0_18px_44px_-24px_rgba(18,58,147,0.25)]">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Nueva contraseña · New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-2.5 text-base outline-none transition-colors focus:border-primary"
              placeholder="••••••••"
            />
            <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Confirmar · Confirm
            </label>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-2.5 text-base outline-none transition-colors focus:border-primary"
              placeholder="••••••••"
            />
            {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full rounded-full bg-primary py-3 font-display text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "…" : "Guardar · Save"}
            </button>
          </form>
        )}

        {phase === "done" && (
          <div className="rounded-3xl border border-hairline bg-card p-6 text-center">
            <p className="text-sm font-medium text-primary">
              Contraseña actualizada. Ya puedes iniciar sesión.
              <br />
              Password updated — you can sign in now.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Iniciar sesión · Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("should be different") || m.includes("same as the")) {
    return "La nueva contraseña no puede ser igual a la anterior · New password can't match the old one.";
  }
  if (m.includes("weak") || m.includes("at least")) {
    return "Elige una contraseña más fuerte · Choose a stronger password.";
  }
  if (m.includes("network")) return "Sin conexión · No connection.";
  return raw;
}
