"use client";

// Keeping a student's progress alive on iOS. Safari evicts IndexedDB (where all
// local progress lives) under storage pressure or after a stretch of not
// opening the app — and when that happened the app used to onboard the student
// as brand new, minting a fresh sync code and stranding their real data in the
// cloud. Three defenses, cheapest first:
//   1. Ask the browser to make storage persistent so it isn't evicted at all.
//   2. Remember the sync code in localStorage (evicted independently of, and
//      generally later than, IndexedDB) so we can always find their cloud data.
//   3. If local ever comes up empty but we remember a code, silently restore
//      from the cloud instead of starting over.

import { boundAccountId } from "@/lib/db/dexie";

const SYNC_CODE_KEY = "clara.syncCode";

/** Ask the browser not to evict our storage. Best-effort; harmless if denied. */
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      const already = (await navigator.storage.persisted?.()) ?? false;
      if (!already) await navigator.storage.persist();
    }
  } catch {
    /* not supported — the other two defenses still apply */
  }
}

/** Stash the sync code somewhere IndexedDB eviction won't take with it. */
export function rememberSyncCode(code: string | null | undefined): void {
  try {
    if (code) localStorage.setItem(SYNC_CODE_KEY, code);
  } catch {
    /* private mode / storage full — nothing we can do */
  }
}

export function recalledSyncCode(): string | null {
  try {
    const code = localStorage.getItem(SYNC_CODE_KEY);
    // The remembered code is a device-wide value from the passwordless era.
    // Under account-scoped storage it may belong to whoever used this device
    // last — never let it restore a different account's profile into the
    // currently bound database (audit: cross-account bleed).
    const bound = boundAccountId();
    if (bound && code && code.trim().toLowerCase() !== bound) return null;
    return code;
  } catch {
    return null;
  }
}

/** Called on a deliberate reset so we don't auto-restore the wiped profile. */
export function forgetSyncCode(): void {
  try {
    localStorage.removeItem(SYNC_CODE_KEY);
  } catch {
    /* no-op */
  }
}
