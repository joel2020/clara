"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { LoginScreen } from "@/components/login-screen";
import { Lumi } from "@/components/lumi";
import { isAllowed } from "@/lib/allowlist";

// Stands in front of the whole app: the login screen until there's a session,
// then an allowlist check (anyone can register with Supabase, but only approved
// students get in — the paid routes enforce the same list server-side), then the
// app. Bypassed entirely when no auth backend is configured (local dev).

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, required, session, user, signOut } = useAuth();

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

  if (required && !isAllowed(user?.email)) {
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
