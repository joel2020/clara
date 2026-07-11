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
  completenessScore?: number;
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
export async function assessRecording(wav: Blob, target: string): Promise<Assessment> {
  const form = new FormData();
  form.append("file", wav, "attempt.wav");
  form.append("target", target);
  const res = await fetch("/api/assess", { method: "POST", body: form, headers: await authHeaders() });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as Assessment;
}
