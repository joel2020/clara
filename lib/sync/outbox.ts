"use client";

import { db, boundAccountId } from "@/lib/db/dexie";
import type { OutboxRow } from "@/lib/db/types";
import { deliverQueued, setOutboxSink, type DurableKind } from "./supabase-sync";

// Durable retry for one-shot history rows (audit P1: a transient network or
// provider failure silently discarded a completed attempt's cloud mirror —
// and iOS storage eviction could then destroy the only copy).
//
// Flow: a failed durable push lands here via the sink; rows are replayed on
// app start, when the browser comes back online, and after later successful
// flush triggers. Replays are idempotent (natural keys / existence checks in
// deliverQueued) and a row is only deleted once the cloud definitely has it.

let initialized = false;
let flushing = false;

/** Queue a failed push. Rows live in the writer's own account database. */
export function enqueueOutbox(kind: DurableKind, profileId: string, payload: unknown): void {
  const bound = boundAccountId();
  // After an account switch, the failure callback may fire late. The row would
  // land in the WRONG account's database and its replay would be rejected by
  // RLS forever — drop it instead (the practice data itself is safe in the
  // original account's local store; only this cloud-mirror retry is lost).
  if (bound && profileId.trim().toLowerCase() !== bound) {
    console.warn("[outbox] dropped late enqueue for a different account");
    return;
  }
  void db.outbox
    .add({ kind, profileId, payload, at: Date.now(), tries: 0 })
    .catch((e) => console.warn("[outbox] enqueue failed", e instanceof Error ? e.message : e));
}

export type Deliver = (kind: DurableKind, profileId: string, payload: unknown) => Promise<boolean>;

/**
 * Replay queued rows oldest-first. Stops at the first failure (almost always
 * "still offline") rather than hammering; the next trigger retries. Returns
 * counts for observability and tests.
 */
export async function flushOutbox(deliver: Deliver = deliverQueued): Promise<{ delivered: number; remaining: number }> {
  if (flushing || typeof window === "undefined") return { delivered: 0, remaining: await pendingOutboxCount() };
  flushing = true;
  let delivered = 0;
  try {
    const rows = await db.outbox.orderBy("at").toArray();
    for (const row of rows) {
      const okNow = await deliver(row.kind, row.profileId, row.payload).catch(() => false);
      if (okNow) {
        await db.outbox.delete(row.id as number);
        delivered++;
      } else {
        await db.outbox.update(row.id as number, { tries: (row.tries ?? 0) + 1 });
        break; // provider/network still down — wait for the next trigger
      }
    }
  } catch (e) {
    console.warn("[outbox] flush failed", e instanceof Error ? e.message : e);
  } finally {
    flushing = false;
  }
  return { delivered, remaining: await pendingOutboxCount().catch(() => 0) };
}

export async function pendingOutboxCount(): Promise<number> {
  if (typeof window === "undefined") return 0;
  return db.outbox.count();
}

/**
 * Wire the outbox up: register the failure sink and the flush triggers.
 * Idempotent — DataScope calls it on every (re)bind, listeners attach once.
 */
export function initOutbox(): void {
  setOutboxSink(enqueueOutbox);
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  window.addEventListener("online", () => void flushOutbox());
  // App start (and each account bind) gets one flush attempt shortly after
  // load, off the critical path.
  window.setTimeout(() => void flushOutbox(), 4000);
}
