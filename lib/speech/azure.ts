"use client";

// Client side of phoneme-level assessment. Discovers once per session whether
// the server has Azure configured; when it does, practice recordings go
// through /api/assess and come back with real acoustic scores.

import { authHeaders } from "@/lib/auth-client";

export interface AssessedPhoneme {
  p: string; // IPA symbol
  accuracy: number;
}

export interface AssessedWord {
  word: string;
  accuracy: number;
  errorType: string; // "None" | "Mispronunciation" | "Omission" | "Insertion"
  phonemes: AssessedPhoneme[];
}

export interface Assessment {
  display: string;
  pronScore: number;
  accuracyScore?: number;
  fluencyScore?: number;
  /** Only present for a scripted assessment — see `scripted`. */
  completenessScore?: number;
  /**
   * True when the audio was graded against a known sentence (a retry), false
   * for free conversation. Both are real measurements of her speech; the flag
   * says which claims the score supports, since completeness and miscue need
   * expected words to mean anything.
   */
  scripted?: boolean;
  words: AssessedWord[];
}

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

/** Send a WAV recording + target text for assessment. Throws on failure. */
/**
 * Score a recording. With `target`, Azure grades against that exact sentence
 * (a repeat-after-me retry). Without it, Azure runs an unscripted assessment of
 * whatever she actually said — which is how free conversation gets graded.
 */
export async function assessRecording(wav: Blob, target?: string): Promise<Assessment> {
  const form = new FormData();
  form.append("file", wav, "attempt.wav");
  if (target?.trim()) form.append("target", target.trim());
  const res = await fetch("/api/assess", { method: "POST", body: form, headers: await authHeaders() });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Assessment;
}
