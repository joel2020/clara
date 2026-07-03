"use client";

// Thin wrapper over SpeechSynthesis for native-model playback. Handles the two
// quirks that bite everyone: voices loading asynchronously, and Chrome's
// occasional stuck-utterance state (fixed by cancel() before speak()).

let cachedVoices: SpeechSynthesisVoice[] = [];

export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

/** Resolve once the browser has loaded its voice list. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length) {
      cachedVoices = immediate;
      resolve(immediate);
      return;
    }
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve(cachedVoices);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Fallback in case the event never fires.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
  });
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  return getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
}

/** Pick a sensible default English voice, preferring US/GB native models. */
export function pickDefaultVoice(preferredURI?: string): SpeechSynthesisVoice | undefined {
  const voices = getEnglishVoices();
  if (!voices.length) return undefined;
  if (preferredURI) {
    const match = voices.find((v) => v.voiceURI === preferredURI);
    if (match) return match;
  }
  return (
    voices.find((v) => /en[-_]US/i.test(v.lang) && v.localService) ??
    voices.find((v) => /en[-_]US/i.test(v.lang)) ??
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ??
    voices[0]
  );
}

export interface SpeakOptions {
  rate?: number; // 0.1–10, default 0.9
  voiceURI?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/** Speak text with the chosen voice/rate. Cancels anything already speaking. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // clear any stuck/queued utterance (Chrome quirk)

  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = opts.rate ?? 0.9;
  utter.pitch = 1;
  const voice = pickDefaultVoice(opts.voiceURI);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = "en-US";
  }
  if (opts.onStart) utter.onstart = opts.onStart;
  if (opts.onEnd) {
    utter.onend = opts.onEnd;
    utter.onerror = opts.onEnd;
  }
  synth.speak(utter);
}

export function cancelSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
