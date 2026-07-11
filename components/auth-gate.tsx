"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { LoginScreen } from "@/components/login-screen";
import { Lumi } from "@/components/lumi";

// Stands in front of the whole app: renders the login screen until there's a
// session (when auth is required), the app once signed in. Bypassed entirely
// when no auth backend is configured (local dev).

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, required, session } = useAuth();

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

  return <>{children}</>;
}
