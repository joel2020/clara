"use client";

import { getSpeechRecognitionCtor, hasMediaRecording } from "./support";

// Promise-based wrapper around the one-shot SpeechRecognition flow: start
// listening, capture the best transcript, stop. Surfaces alternatives too, so
// scoring can tell whether she actually hit the target or its minimal-pair twin.

export interface RecognitionResult {
  transcript: string;
  confidence: number;
  alternatives: string[];
}

export class RecognitionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RecognitionError";
  }
}

export interface RecognitionHandle {
  /** Resolves with the result, or rejects with a RecognitionError. */
  result: Promise<RecognitionResult>;
  /** Stop listening early and resolve with whatever was captured. */
  stop: () => void;
  /** Abort without a result. */
  cancel: () => void;
}

export function startRecognition(opts: { lang?: string; maxAlternatives?: number } = {}): RecognitionHandle {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return {
      result: Promise.reject(
        new RecognitionError("unsupported", "Speech recognition isn't available in this browser."),
      ),
      stop: () => {},
      cancel: () => {},
    };
  }

  const recognition = new Ctor();
  recognition.lang = opts.lang ?? "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = opts.maxAlternatives ?? 5;
  recognition.continuous = false;

  let settled = false;
  let resolveFn!: (r: RecognitionResult) => void;
  let rejectFn!: (e: RecognitionError) => void;

  const result = new Promise<RecognitionResult>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const res = event.results[0];
    if (!res) return;
    const alternatives: string[] = [];
    for (let i = 0; i < res.length; i++) {
      alternatives.push(res[i].transcript.trim());
    }
    settled = true;
    resolveFn({
      transcript: res[0].transcript.trim(),
      confidence: res[0].confidence,
      alternatives,
    });
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (settled) return;
    settled = true;
    const code = event.error || "error";
    const message =
      code === "no-speech"
        ? "I didn't catch anything — try again a little louder."
        : code === "not-allowed" || code === "service-not-allowed"
          ? "Microphone access is blocked. Allow the mic and try again."
          : code === "audio-capture"
            ? "No microphone found."
            : "Something went wrong with recognition. Try again.";
    rejectFn(new RecognitionError(code, message));
  };

  recognition.onend = () => {
    if (!settled) {
      settled = true;
      rejectFn(new RecognitionError("no-speech", "I didn't catch anything — try again."));
    }
  };

  try {
    recognition.start();
  } catch {
    if (!settled) {
      settled = true;
      rejectFn(new RecognitionError("start-failed", "Couldn't start the mic. Try again."));
    }
  }

  return {
    result,
    stop: () => {
      try {
        recognition.stop();
      } catch {
        /* no-op */
      }
    },
    cancel: () => {
      settled = true;
      try {
        recognition.abort();
      } catch {
        /* no-op */
      }
      rejectFn(new RecognitionError("cancelled", "Cancelled."));
    },
  };
}

// Longest a single recording runs before we auto-stop and transcribe, so a
// forgotten "stop" tap can't hang the flow.
const MAX_RECORD_MS = 7000;

/**
 * Fallback recognizer for browsers without the Web Speech API (iOS Safari):
 * record with MediaRecorder, then transcribe on the server via /api/transcribe.
 * Unlike Web Speech it doesn't auto-detect end-of-speech — the caller ends it
 * with stop() (there's also a safety timeout).
 */
export function startCloudRecognition(): RecognitionHandle {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let autoStop: ReturnType<typeof setTimeout> | null = null;
  const chunks: BlobPart[] = [];
  let settled = false;
  let stopped = false;

  let resolveFn!: (r: RecognitionResult) => void;
  let rejectFn!: (e: RecognitionError) => void;
  const result = new Promise<RecognitionResult>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const cleanupStream = () => stream?.getTracks().forEach((t) => t.stop());

  const transcribe = async () => {
    try {
      const type = recorder?.mimeType || "audio/webm";
      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        if (!settled) {
          settled = true;
          rejectFn(new RecognitionError("no-speech", "I didn't catch anything — try again."));
        }
        return;
      }
      const form = new FormData();
      form.append("file", blob, "attempt.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { transcript?: string };
      const transcript = (data.transcript ?? "").trim();
      if (!settled) {
        settled = true;
        if (!transcript) {
          rejectFn(new RecognitionError("no-speech", "I didn't catch anything — try again."));
        } else {
          resolveFn({ transcript, confidence: 1, alternatives: [transcript] });
        }
      }
    } catch {
      if (!settled) {
        settled = true;
        rejectFn(new RecognitionError("network", "Couldn't score that. Check your connection and try again."));
      }
    }
  };

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        if (autoStop) clearTimeout(autoStop);
        cleanupStream();
        if (!settled) void transcribe();
      };
      recorder.start();
      autoStop = setTimeout(() => {
        if (!stopped) {
          stopped = true;
          try {
            recorder?.stop();
          } catch {
            /* no-op */
          }
        }
      }, MAX_RECORD_MS);
    } catch {
      if (!settled) {
        settled = true;
        rejectFn(new RecognitionError("not-allowed", "Microphone access is blocked. Allow the mic and try again."));
      }
    }
  })();

  return {
    result,
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        recorder?.stop();
      } catch {
        /* no-op */
      }
    },
    cancel: () => {
      settled = true;
      stopped = true;
      if (autoStop) clearTimeout(autoStop);
      try {
        recorder?.stop();
      } catch {
        /* no-op */
      }
      cleanupStream();
      rejectFn(new RecognitionError("cancelled", "Cancelled."));
    },
  };
}

/** How an attempt will actually be captured, so the UI can adjust its prompts. */
export type RecognitionMode = "instant" | "record";

export function recognitionMode(): RecognitionMode {
  return getSpeechRecognitionCtor() ? "instant" : "record";
}

/**
 * Start recognition with the best method available: the Web Speech API when it
 * exists (desktop Chrome — instant, free), otherwise record-and-transcribe
 * (iOS Safari and the rest).
 */
export function createRecognition(opts: { lang?: string } = {}): RecognitionHandle {
  if (getSpeechRecognitionCtor()) return startRecognition(opts);
  if (hasMediaRecording()) return startCloudRecognition();
  return {
    result: Promise.reject(new RecognitionError("unsupported", "Recording isn't available in this browser.")),
    stop: () => {},
    cancel: () => {},
  };
}
