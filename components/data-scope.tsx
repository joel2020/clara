"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { bindLocalDb } from "@/lib/db/dexie";
import { initOutbox, flushOutbox } from "@/lib/sync/outbox";
import { Splash } from "@/components/splash";

// Binds local storage to the signed-in account BEFORE anything can read it,
// and re-mounts the whole data-consuming tree when the account changes so
// every live query re-subscribes against the right database. This is the
// isolation boundary for the audit's shared-device account-bleed finding:
// user B can never render, merge, or sync user A's rows because B's session
// never even opens A's database.
export function DataScope({ children }: { children: ReactNode }) {
  const { ready, required, user } = useAuth();
  // undefined = not bound yet; string = React key for the bound scope.
  const [scope, setScope] = useState<string | undefined>(undefined);

  const target = !required ? null : (user?.id ?? null);

  useEffect(() => {
    if (required && !ready) return;
    let cancelled = false;
    void bindLocalDb(target).then(() => {
      if (cancelled) return;
      setScope(target ?? "local");
      // The account's database is open: arm the durable-sync outbox and give
      // any rows stranded by an earlier failure a replay attempt.
      initOutbox();
      void flushOutbox();
    });
    return () => {
      cancelled = true;
    };
  }, [ready, required, target]);

  // AuthGate has already blocked unauthenticated users; this only shows for
  // the moment the account database is being opened (or legacy data claimed).
  if (scope === undefined || (required && ready && scope !== (target ?? "local"))) return <Splash />;

  return <div key={scope} className="contents">{children}</div>;
}
