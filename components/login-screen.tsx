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
// Google sign-in sits above it, shown only when configured (see below).

/** True once the Google provider is configured in Supabase. Read at build time. */
const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";

export function LoginScreen() {
  const { signIn, signUp, signInWithGoogle, resendConfirmation, resetPassword } = useAuth();
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
          {/* Google first: one tap on desktop and Android. Email + password stays
              below it as the reliable path on the installed iOS PWA, where an
              OAuth redirect can bounce out to Safari.

              Env-gated like every other integration in this app: signInWithOAuth
              navigates away immediately, so if the provider isn't enabled in
              Supabase the student lands on a raw JSON error with no way back —
              there is no client-side error to catch. Showing the button only when
              NEXT_PUBLIC_GOOGLE_AUTH_ENABLED is set makes that dead end
              impossible. Flip it on once the provider is configured. */}
          {googleEnabled && (
          <>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              setError(null);
              setNotice(null);
              const { error } = await signInWithGoogle();
              // On success the browser leaves for Google, so this only runs on failure.
              if (error) {
                setBusy(false);
                setError(friendlyError(error));
              }
            }}
            className="flex w-full items-center justify-center gap-2.5 rounded-full border border-hairline bg-background py-3 text-sm font-semibold transition-colors hover:border-foreground/30 disabled:opacity-60"
          >
            <GoogleMark />
            Continuar con Google · Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-hairline" />
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">o · or</span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
          </>
          )}

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
            placeholder="correo@ejemplo.com"
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
  const m = raw.toLowerCase();
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return "Google aún no está configurado — entra con tu correo · Google isn't set up yet — use your email.";
  }
  if (m.includes("invalid login") || m.includes("invalid_credentials")) return "Correo o contraseña incorrectos — ¿ya creaste la cuenta? · Wrong email or password — did you create the account yet?";
  if (m.includes("email not confirmed")) return "Confirma tu correo primero (revisa tu bandeja) · Confirm your email first — check your inbox.";
  if (m.includes("already registered")) return "Esa cuenta ya existe — inicia sesión · That account already exists — sign in instead.";
  if (m.includes("network")) return "Sin conexión · No connection.";
  return raw;
}
