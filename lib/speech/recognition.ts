"use client";

import { getSpeechRecognitionCtor, hasMediaRecording } from "./support";
import { assessEnabled, assessEnabledSync, assessRecording, type Assessment } from "./azure";
import { startWavRecording, SILENCE_PEAK, type WavHandle } from "./wav-recorder";
import { authHeaders } from "@/lib/auth-client";
import { ensureVoiceConsent, hasVoiceConsent } from "./consent";

// Promise-based wrapper around the one-shot SpeechRecognition flow: start
// listening, capture the best transcript, stop. Surfaces alternatives too, so
// scoring can tell whether she actually hit the target or its minimal-pair twin.
// When Azure phoneme assessment is configured AND the caller knows the target
// text, attempts record WAV and go through /api/assess instead — same handle
// shape, plus an `assessment` with real acoustic scores.

export interface RecognitionResult {
  transcript: string;
  confidence: number;
  alternatives: string[];
  /** Present when the attempt went through phoneme-level assessment. */
  assessment?: Assessment;
  /** The captured audio, when the path records one (not Web Speech). Feeds the voice journal. */
  audio?: Blob;
}

export class RecognitionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RecognitionError";
  }
}

/** i18n key for a recognition error, so the message shows in her coach language. */
export function recognitionErrorKey(e: unknown): "recNoSpeech" | "recSilent" | "recNotAllowed" | "recNetwork" | "recConsent" | "recGeneric" {
  if (!(e instanceof RecognitionError)) return "recGeneric";
  switch (e.code) {
    case "no-speech":
      return "recNoSpeech";
    case "silent":
      return "recSilent";
    case "not-allowed":
      return "recNotAllowed";
    case "network":
      return "recNetwork";
    case "consent":
      return "recConsent";
    default:
      return "recGeneric";
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
      const res = await fetch("/api/transcribe", { method: "POST", body: form, headers: await authHeaders() });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { transcript?: string };
      const transcript = (data.transcript ?? "").trim();
      if (!settled) {
        settled = true;
        if (!transcript) {
          rejectFn(new RecognitionError("no-speech", "I didn't catch anything — try again."));
        } else {
          resolveFn({ transcript, confidence: 1, alternatives: [transcript], audio: blob });
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

/**
 * Azure assessment path: record 16 kHz WAV, then send it with the target text
 * for phoneme-level scoring. She taps stop (like the cloud path); a safety
 * timer auto-stops so a forgotten tap can't hang the flow.
 */
function startAzureRecognition(target?: string): RecognitionHandle {
  let wav: WavHandle | null = null;
  let settled = false;
  let stopping = false;
  let cancelled = false;
  let autoStop: ReturnType<typeof setTimeout> | null = null;

  let resolveFn!: (r: RecognitionResult) => void;
  let rejectFn!: (e: RecognitionError) => void;
  const result = new Promise<RecognitionResult>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const finish = async () => {
    if (settled || stopping || !wav) return;
    stopping = true;
    if (autoStop) clearTimeout(autoStop);
    try {
      const blob = await wav.stop();
      // A dead mic records digital silence. Don't bill Azure for it, and don't
      // let her think she mispronounced when nothing was ever captured.
      if (wav.peak() < SILENCE_PEAK) {
        if (!settled) {
          settled = true;
          rejectFn(new RecognitionError("silent", "We couldn't hear the mic. Check microphone access and try again."));
        }
        return;
      }
      const assessment = await assessRecording(blob, target);
      if (settled) return;
      settled = true;
      if (!assessment.display && assessment.pronScore === 0 && !assessment.words.length) {
        rejectFn(new RecognitionError("no-speech", "I didn't catch anything — try again."));
      } else {
        resolveFn({
          transcript: assessment.display,
          confidence: 1,
          alternatives: assessment.display ? [assessment.display] : [],
          assessment,
          audio: blob,
        });
      }
    } catch {
      if (!settled) {
        settled = true;
        rejectFn(new RecognitionError("network", "Couldn't score that. Check your connection and try again."));
      }
    }
  };

  void (async () => {
    try {
      wav = await startWavRecording();
      if (cancelled) {
        wav.cancel();
        return;
      }
      autoStop = setTimeout(finish, MAX_RECORD_MS);
      if (stopping) {
        stopping = false;
        void finish();
      }
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
      if (wav) void finish();
      else stopping = true; // stop arrived before the recorder finished starting
    },
    cancel: () => {
      cancelled = true;
      settled = true;
      if (autoStop) clearTimeout(autoStop);
      wav?.cancel();
      rejectFn(new RecognitionError("cancelled", "Cancelled."));
    },
  };
}

/** How an attempt will actually be captured, so the UI can adjust its prompts. */
export type RecognitionMode = "instant" | "record";

export function recognitionMode(): RecognitionMode {
  if (assessEnabledSync()) return "record"; // Azure path: she taps stop
  return getSpeechRecognitionCtor() ? "instant" : "record";
}

/**
 * Start recognition with the best method available: phoneme-level assessment
 * when Azure is configured and the target is known; otherwise the Web Speech
 * API (desktop Chrome — instant, free) or record-and-transcribe (iOS Safari).
 */
export function createRecognition(opts: { lang?: string; target?: string; assess?: boolean } = {}): RecognitionHandle {
  // Consent before capture (audit P0): the first mic use anywhere opens the
  // one-time consent sheet; a decline blocks capture only, never the app.
  // The gate sits here because this is the single entry point for every mic
  // surface — practice, talk, exams, calls, duets, shadowing, placement.
  if (!hasVoiceConsent()) {
    let inner: RecognitionHandle | null = null;
    let cancelled = false;
    const result = ensureVoiceConsent().then((okd) => {
      if (!okd) throw new RecognitionError("consent", "Voice capture was declined.");
      if (cancelled) throw new RecognitionError("cancelled", "Cancelled.");
      inner = createRecognition(opts);
      return inner.result;
    });
    return {
      result,
      stop: () => inner?.stop(),
      cancel: () => {
        cancelled = true;
        inner?.cancel();
      },
    };
  }
  // Warm the capability probe so the second attempt onward can use Azure.
  void assessEnabled();
  // Assessment no longer needs a known target: Azure grades unscripted speech
  // too, so free conversation gets real pronunciation scores instead of only
  // repeat-after-me drills. `assess: true` opts a caller in without one.
  if ((opts.target || opts.assess) && assessEnabledSync() && hasMediaRecording()) {
    return startAzureRecognition(opts.target);
  }
  if (getSpeechRecognitionCtor()) return startRecognition(opts);
  if (hasMediaRecording()) return startCloudRecognition();
  return {
    result: Promise.reject(new RecognitionError("unsupported", "Recording isn't available in this browser.")),
    stop: () => {},
    cancel: () => {},
  };
}
