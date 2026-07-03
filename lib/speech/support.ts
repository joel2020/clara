"use client";

// Feature detection for the Web Speech API. Both halves degrade independently:
// a browser can have SpeechSynthesis (playback) without SpeechRecognition
// (scoring her attempts), so we report them separately.

export interface SpeechSupport {
  synthesis: boolean;
  recognition: boolean;
}

export function getSpeechRecognitionCtor(): typeof SpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** MediaRecorder + mic access — the fallback path for browsers with no Web Speech (iOS Safari). */
export function hasMediaRecording(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

export function detectSpeechSupport(): SpeechSupport {
  if (typeof window === "undefined") {
    return { synthesis: false, recognition: false };
  }
  return {
    synthesis: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    // Recognition works via the Web Speech API (desktop Chrome) OR by recording
    // audio and transcribing it on the server (iOS Safari and everywhere else).
    recognition: getSpeechRecognitionCtor() !== null || hasMediaRecording(),
  };
}
