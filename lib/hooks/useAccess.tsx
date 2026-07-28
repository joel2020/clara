"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { authHeaders } from "@/lib/auth-client";

// Client-side access flags, fetched once per session from /api/me. The email
// allowlists live in server env now (audit P0: student emails shipped in the
// client bundle), so the browser can't evaluate them locally. These flags gate
// UI only — every API route re-enforces the same checks per request.

interface AccessValue {
  /** null while the check is in flight. */
  allowed: boolean | null;
  admin: boolean;
}

const AccessContext = createContext<AccessValue>({ allowed: null, admin: false });

export function AccessProvider({ children }: { children: ReactNode }) {
  const { ready, required, session } = useAuth();
  // The fetched answer is keyed to the session token it was fetched for, so a
  // sign-out/switch can never show a stale user's flags (and no state needs to
  // be set synchronously inside the effect).
  const [fetched, setFetched] = useState<{ key: string; value: AccessValue } | null>(null);

  useEffect(() => {
    if (!ready || !required || !session) return;
    const key = session.access_token;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/me", { headers: await authHeaders() });
        const body = res.ok ? ((await res.json()) as { allowed?: boolean; admin?: boolean }) : null;
        if (!active) return;
        // A failed check fails CLOSED for UI (the "no access" screen offers
        // sign-out; the server would reject the calls anyway).
        setFetched({ key, value: { allowed: body?.allowed === true, admin: body?.admin === true } });
      } catch {
        if (active) setFetched({ key, value: { allowed: false, admin: false } });
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, required, session]);

  const value: AccessValue = !required
    ? { allowed: true, admin: true } // local dev without an auth backend: open, matching the gate's bypass
    : session && fetched?.key === session.access_token
      ? fetched.value
      : { allowed: null, admin: false };

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessValue {
  return useContext(AccessContext);
}
