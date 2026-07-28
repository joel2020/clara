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
  /**
   * True when the check itself failed (network, server down) — NOT a denial.
   * The gate shows a retryable "couldn't verify" state instead of the hard
   * no-access screen: only an explicit allowed:false from the server means
   * this account is actually not on the list.
   */
  checkFailed: boolean;
  /** Re-run a failed check. */
  retry: () => void;
}

const NOOP = () => {};
const AccessContext = createContext<AccessValue>({ allowed: null, admin: false, checkFailed: false, retry: NOOP });

export function AccessProvider({ children }: { children: ReactNode }) {
  const { ready, required, session } = useAuth();
  // The fetched answer is keyed to the session token it was fetched for, so a
  // sign-out/switch can never show a stale user's flags (and no state needs to
  // be set synchronously inside the effect).
  const [fetched, setFetched] = useState<{ key: string; allowed: boolean; admin: boolean; failed: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready || !required || !session) return;
    const key = `${session.access_token}:${attempt}`;
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/me", { headers: await authHeaders() });
        const body = res.ok ? ((await res.json()) as { allowed?: boolean; admin?: boolean }) : null;
        if (!active) return;
        if (body) {
          // The server answered: this is the truth for this account.
          setFetched({ key, allowed: body.allowed === true, admin: body.admin === true, failed: false });
        } else {
          // Reached the server but got no verdict (401 stale token, 5xx, dev
          // server restarting): a check failure, not a denial.
          setFetched({ key, allowed: false, admin: false, failed: true });
        }
      } catch {
        if (active) setFetched({ key, allowed: false, admin: false, failed: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, required, session, attempt]);

  const retry = () => setAttempt((n) => n + 1);

  const current = session && fetched?.key === `${session.access_token}:${attempt}` ? fetched : null;
  const value: AccessValue = !required
    ? { allowed: true, admin: true, checkFailed: false, retry: NOOP } // local dev without an auth backend: open, matching the gate's bypass
    : current
      ? current.failed
        ? { allowed: null, admin: false, checkFailed: true, retry }
        : { allowed: current.allowed, admin: current.admin, checkFailed: false, retry }
      : { allowed: null, admin: false, checkFailed: false, retry };

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessValue {
  return useContext(AccessContext);
}
