"use client";

import { useEffect, useState } from "react";
import { detectSpeechSupport, type SpeechSupport } from "@/lib/speech/support";
import { loadVoices } from "@/lib/speech/synthesis";

// Detects Web Speech API support on the client and warms up the voice list.
// Returns null until the first client render so SSR markup stays stable.

export function useSpeechSupport(): SpeechSupport | null {
  const [support, setSupport] = useState<SpeechSupport | null>(null);

  useEffect(() => {
    setSupport(detectSpeechSupport());
    loadVoices();
  }, []);

  return support;
}
