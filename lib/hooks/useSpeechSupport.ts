"use client";

import { useEffect, useState } from "react";
import { detectSpeechSupport, type SpeechSupport } from "@/lib/speech/support";
import { loadVoices } from "@/lib/speech/synthesis";

// Detects Web Speech API support on the client and warms up the voice list.
// Returns null until the first client render so SSR markup stays stable.

export function useSpeechSupport(): SpeechSupport | null {
  // Probed via a lazy initialiser rather than an effect: capability detection is a
  // one-time read, not a subscription, and setting state in an effect for it caused
  // an avoidable extra render. Guarded so SSR still returns null.
  const [support] = useState<SpeechSupport | null>(() =>
    typeof window === "undefined" ? null : detectSpeechSupport(),
  );

  // Voices load asynchronously in the browser, so warming them IS a side effect.
  useEffect(() => {
    loadVoices();
  }, []);

  return support;
}
