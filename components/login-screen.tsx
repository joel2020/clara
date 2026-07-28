"use client";

import { useState } from "react";
import { Lumi } from "@/components/lumi";
import { useAuth } from "@/lib/hooks/useAuth";

// The access gate. Clara is public, so this stands in front of the whole app:
// only a signed-in, allowlisted account gets in (and can call the paid AI
// routes). Accounts are created right here — no dashboard trip — because the
// real protection is the server-side allowlist (lib/allowlist.ts), not secrecy
// about the sign-up form: a stranger can register and still get nowhere.
// Email + password because magic links break out of the installed iOS PWA.

export function LoginScreen() {
  const { signIn, signUp, resendConfirmation, resetPassword } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setNeedsConfirm(false);
    const { error } = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) {
      // Surface a self-serve "resend confirmation" path when the account exists
      // but its email was never confirmed — the most common sign-in failure here.
      if (error.toLowerCase().includes("not confirmed")) setNeedsConfirm(true);
      setError(friendlyError(error));
      return;
    }
    if (mode === "up") {
      // With email confirmation on, sign-up creates no session until the link in
      // the email is clicked. Say so plainly rather than looking like nothing happened.
      setNotice("Cuenta creada. Revisa tu correo y confirma, luego inicia sesión · Account created. Confirm via the email, then sign in.");
      setMode("in");
      setPassword("");
    }
    // On sign-in success, AuthProvider's onAuthStateChange swaps this screen for the app.
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="hero-calm pointer-events-none absolute inset-0" aria-hidden />
      <div className="flag-bar absolute inset-x-0 top-0 h-[3px]" aria-hidden />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mx-auto mb-6 flex flex-col items-center text-center">
          <div className="h-44 w-40 px-1">
            <Lumi mood="wave" priority depth />
          </div>
          <p className="mt-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
            <span className="flag-dots" aria-hidden>
              <i /><i /><i />
            </span>
            Bienvenida · Welcome
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em]">Clara</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in" ? "Inicia sesión para practicar · Sign in to practice" : "Crea tu cuenta · Create your account"}
          </p>
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
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-hairline bg-background px-3.5 py-2.5 text-base outline-none transition-colors focus:border-primary"
            placeholder="••••••••"
          />

          {mode === "in" && (
            <button
              type="button"
              onClick={async () => {
                if (busy) return;
                setError(null);
                setNotice(null);
                setNeedsConfirm(false);
                if (!email.trim()) {
                  setError("Escribe tu correo primero · Enter your email first.");
                  return;
                }
                setBusy(true);
                const { error } = await resetPassword(email);
                setBusy(false);
                if (error) setError(friendlyError(error));
                else
                  setNotice(
                    "Te enviamos un correo para restablecer tu contraseña. Revisa tu bandeja · Password-reset email sent — check your inbox.",
                  );
              }}
              className="mt-3 block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ¿Olvidaste tu contraseña? · Forgot your password?
            </button>
          )}

          {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
          {notice && <p className="mt-3 text-sm font-medium text-primary">{notice}</p>}
          {needsConfirm && (
            <button
              type="button"
              onClick={async () => {
                if (busy) return;
                setBusy(true);
                const { error } = await resendConfirmation(email);
                setBusy(false);
                setNeedsConfirm(false);
                if (error) setError(friendlyError(error));
                else {
                  setError(null);
                  setNotice("Correo de confirmación reenviado. Revísalo · Confirmation email resent — check your inbox.");
                }
              }}
              className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Reenviar correo de confirmación · Resend confirmation email
            </button>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-full bg-primary py-3 font-display text-lg font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "…" : mode === "in" ? "Entrar · Sign in" : "Crear cuenta · Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "in" ? "up" : "in"));
            setError(null);
            setNotice(null);
          }}
          className="mt-4 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "in"
            ? "¿Sin cuenta? Crea una · No account? Create one"
            : "¿Ya tienes cuenta? Inicia sesión · Already have one? Sign in"}
        </button>
      </div>
    </div>
  );
}

function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return "Correo o contraseña incorrectos — ¿ya creaste la cuenta? · Wrong email or password — did you create the account yet?";
  if (m.includes("email not confirmed")) return "Confirma tu correo primero (revisa tu bandeja) · Confirm your email first — check your inbox.";
  if (m.includes("already registered")) return "Esa cuenta ya existe — inicia sesión · That account already exists — sign in instead.";
  if (m.includes("network")) return "Sin conexión · No connection.";
  return raw;
}
