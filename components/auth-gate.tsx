"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { LoginScreen } from "@/components/login-screen";
import { ResetPasswordScreen } from "@/components/reset-password-screen";
import { OAuthCallbackScreen } from "@/components/oauth-callback-screen";
import { Lumi } from "@/components/lumi";
import { useAccess } from "@/lib/hooks/useAccess";
import { PrivacyNotice } from "@/components/privacy-notice";

// Stands in front of the whole app until there is a Google-backed Supabase
// session whose identity is admitted by the server-side access policy.

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, required, session, signOut } = useAuth();
  const { allowed, checkFailed, retry } = useAccess();
  const pathname = usePathname();

  // The notice is linked from Login and must be readable before authentication.
  // Render it here, outside DataScope/onboarding, so opening it cannot touch a
  // previous learner's local database on a shared device.
  if (pathname === "/privacidad" && required && !session) return <PrivacyNotice />;

  // The password-reset link lands here. Intercept it before the session check so
  // it works without being signed in, and before the app chrome, onboarding, and
  // profile-binding mount — the reset screen owns the whole viewport.
  if (pathname === "/reset") return <ResetPasswordScreen />;

  // Google sends the user back here with a token to exchange; same reasoning —
  // it must run before the session check, since there is no session yet.
  if (pathname === "/auth/callback") return <OAuthCallbackScreen />;

  if (required && !ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-24 w-20 opacity-90">
          <Lumi mood="idle" priority />
        </div>
      </div>
    );
  }

  if (required && !session) return <LoginScreen />;

  // The check itself failed (offline, server unreachable, stale token) —
  // that is NOT a denial. Never show the no-access screen for it.
  if (required && session && checkFailed) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <div className="h-28 w-24">
          <Lumi mood="think" priority />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">No pudimos verificar tu acceso</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Parece un problema de conexión, no de tu cuenta. Intenta de nuevo en un momento. ·
          Looks like a connection problem, not your account. Try again in a moment.
        </p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Reintentar · Retry
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-full border border-hairline px-5 py-2.5 text-sm font-medium transition-colors hover:border-foreground/30"
          >
            Cerrar sesión · Sign out
          </button>
        </div>
      </div>
    );
  }

  // The allowlist lives server-side now; /api/me answers for this session.
  if (required && session && allowed === null) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-24 w-20 opacity-90">
          <Lumi mood="idle" priority />
        </div>
      </div>
    );
  }

  if (required && allowed === false) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        <div className="h-28 w-24">
          <Lumi mood="think" priority />
        </div>
        <h1 className="mt-4 font-display text-2xl font-semibold">Esta cuenta no tiene acceso</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This account doesn&apos;t have access to Clara. Pídele acceso a tu profe · Ask your teacher for access.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 rounded-full border border-hairline px-5 py-2.5 text-sm font-medium transition-colors hover:border-foreground/30"
        >
          Cerrar sesión · Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
