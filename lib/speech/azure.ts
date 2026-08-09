"use client";

// Client side of phoneme-level assessment. Discovers once per session whether
// the server has Azure configured; when it does, practice recordings go
// through /api/assess and come back with real acoustic scores.

import { authHeaders } from "@/lib/auth-client";
import { isAssessmentResult, type AssessmentKind, type AssessmentResult } from "./azure-response";

export type { AssessedPhoneme, AssessedWord, AssessmentKind, AssessmentResult } from "./azure-response";
export type Assessment = AssessmentResult;

let enabledCache: boolean | null = null;
let probe: Promise<boolean> | null = null;

/** Whether phoneme scoring is available (cached for the session). */
export function assessEnabled(): Promise<boolean> {
  if (enabledCache !== null) return Promise.resolve(enabledCache);
  probe ??= fetch("/api/assess")
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((d: { enabled?: boolean }) => {
      enabledCache = Boolean(d.enabled);
      return enabledCache;
    })
    .catch(() => {
      enabledCache = false;
      return false;
    });
  return probe;
}

/** Synchronous view of the cached probe — null until the first probe lands. */
export function assessEnabledSync(): boolean {
  return enabledCache === true;
}

/** Stage gates must resolve this before opening a microphone. */
export async function requireAssessmentCapability(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const enabled = await Promise.race([
    assessEnabled(),
    ...(signal ? [new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }))] : []),
  ]);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (!enabled) throw new Error("assessment-unavailable");
}

/** Test-only reset for cold-cache and concurrent-probe coverage. */
export function resetAssessmentCapabilityForTests(): void {
  enabledCache = null;
  probe = null;
}

/** Send a WAV recording + target text for assessment. Throws on failure. */
/**
 * Score a recording. With `target`, Azure grades against that exact sentence
 * (a repeat-after-me retry). Without it, Azure runs an unscripted assessment of
 * whatever she actually said — which is how free conversation gets graded.
 */
export async function assessRecording(
  wav: Blob,
  input: { kind: AssessmentKind; target?: string },
): Promise<Assessment> {
  const form = new FormData();
  form.append("file", wav, "attempt.wav");
  form.append("kind", input.kind);
  if (input.target?.trim()) form.append("target", input.target.trim());
  const res = await fetch("/api/assess", { method: "POST", body: form, headers: await authHeaders() });
  if (!res.ok) throw new Error(String(res.status));
  const result: unknown = await res.json();
  if (!isAssessmentResult(result)) {
    throw new Error("Malformed assessment response");
  }
  return result as AssessmentResult;
}
