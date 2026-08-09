"use client";

import { getSpeechRecognitionCtor, hasMediaRecording } from "./support";
import { assessEnabled, assessEnabledSync, assessRecording, requireAssessmentCapability, type Assessment, type AssessmentKind } from "./azure";
import { startWavRecording, SILENCE_PEAK, type WavHandle, type WavOptions } from "./wav-recorder";
import { authHeaders } from "@/lib/auth-client";
import { ensureVoiceConsent, hasVoiceConsent, registerVoiceConsentWithdrawalListener } from "./consent";

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

/** Infrastructure/provider failures are never learner pronunciation misses. */
export function isTechnicalRecognitionError(error: unknown): error is RecognitionError {
  return error instanceof RecognitionError && (error.code === "technical-skip" || error.code === "network");
}

/** Translate bounded provider/capture status without conflating learner silence and outage. */
export function assessmentRecognitionError(assessment: Assessment): RecognitionError | null {
  if (assessment.recognitionReason) {
    return new RecognitionError("no-speech", "I didn't catch anything — try again.");
  }
  if (assessment.providerStatus !== "valid") {
    return new RecognitionError("technical-skip", "Pronunciation scoring is temporarily unavailable. Try again.");
  }
  return null;
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
    case "technical-skip":
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

const activeConsentBoundHandles = new Set<RecognitionHandle>();
registerVoiceConsentWithdrawalListener(() => {
  for (const handle of [...activeConsentBoundHandles]) handle.cancel();
  activeConsentBoundHandles.clear();
});

function consentBound(handle: RecognitionHandle): RecognitionHandle {
  const wrapped: RecognitionHandle = {
    result: handle.result,
    stop: () => handle.stop(),
    cancel: () => {
      activeConsentBoundHandles.delete(wrapped);
      handle.cancel();
    },
  };
  activeConsentBoundHandles.add(wrapped);
  void wrapped.result.then(
    () => activeConsentBoundHandles.delete(wrapped),
    () => activeConsentBoundHandles.delete(wrapped),
  );
  return wrapped;
}

export function startRecognition(opts: { lang?: string; maxAlternatives?: number; maxDurationMs?: number } = {}): RecognitionHandle {
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
  let autoStop: ReturnType<typeof setTimeout> | null = null;
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
    if (autoStop) clearTimeout(autoStop);
    resolveFn({
      transcript: res[0].transcript.trim(),
      confidence: res[0].confidence,
      alternatives,
    });
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (settled) return;
    settled = true;
    if (autoStop) clearTimeout(autoStop);
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
      if (autoStop) clearTimeout(autoStop);
      rejectFn(new RecognitionError("no-speech", "I didn't catch anything — try again."));
    }
  };

  try {
    recognition.start();
    autoStop = setTimeout(() => recognition.stop(), opts.maxDurationMs ?? SHORT_CAPTURE_MS);
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
      if (autoStop) clearTimeout(autoStop);
      try {
        recognition.abort();
      } catch {
        /* no-op */
      }
      rejectFn(new RecognitionError("cancelled", "Cancelled."));
    },
  };
}

/** Short drills retain their established seven-second capture cap. */
export const SHORT_CAPTURE_MS = 7_000;
/** Calls get a full spoken turn, not a seven-second exercise capture. */
export const VIRTUAL_CALL_CAPTURE_MS = 30_000;

/** Resolve each caller's capture contract before choosing a speech provider. */
export function recognitionCapturePolicy(opts: { autoEnd?: boolean; maxDurationMs?: number } = {}): {
  endOnSilence: boolean;
  maxDurationMs: number;
} {
  return {
    endOnSilence: opts.autoEnd === true,
    maxDurationMs: opts.maxDurationMs ?? SHORT_CAPTURE_MS,
  };
}

/** Build the one recorder contract shared by Azure and cloud transcription. */
export function wavRecordingOptions(input: {
  autoEnd: boolean;
  maxDurationMs: number;
  onSpeechEnd: () => void;
}): WavOptions {
  return {
    maxDurationMs: input.maxDurationMs,
    ...(input.autoEnd ? { onSpeechEnd: input.onSpeechEnd } : {}),
  };
}

/**
 * Fallback recognizer for browsers without the Web Speech API (iOS Safari):
 * record 16 kHz WAV, then transcribe on the server via /api/transcribe. For
 * continuous calls the shared recorder detects the end of spoken audio.
 */
export function startCloudRecognition(autoEnd = false, maxDurationMs = SHORT_CAPTURE_MS): RecognitionHandle {
  let wav: WavHandle | null = null;
  let autoStop: ReturnType<typeof setTimeout> | null = null;
  let settled = false;
  let stopping = false;
  let cancelled = false;

  let resolveFn!: (r: RecognitionResult) => void;
  let rejectFn!: (e: RecognitionError) => void;
  const result = new Promise<RecognitionResult>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const transcribe = async (blob: Blob) => {
    try {
      if (!blob.size) {
        if (!settled) {
          settled = true;
          rejectFn(new RecognitionError("no-speech", "I didn't catch anything — try again."));
        }
        return;
      }
      const form = new FormData();
      form.append("file", blob, "attempt.wav");
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

  const finish = async () => {
    if (settled || stopping || !wav) return;
    stopping = true;
    if (autoStop) clearTimeout(autoStop);
    try {
      const blob = await wav.stop();
      if (wav.peak() < SILENCE_PEAK) {
        if (!settled) {
          settled = true;
          rejectFn(new RecognitionError("silent", "We couldn't hear the mic. Check microphone access and try again."));
        }
        return;
      }
      void transcribe(blob);
    } catch {
      if (!settled) {
        settled = true;
        rejectFn(new RecognitionError("network", "Couldn't score that. Check your connection and try again."));
      }
    }
  };

  void (async () => {
    try {
      wav = await startWavRecording(wavRecordingOptions({ autoEnd, maxDurationMs, onSpeechEnd: () => void finish() }));
      if (cancelled) {
        wav.cancel();
        return;
      }
      autoStop = setTimeout(() => void finish(), maxDurationMs);
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
      else stopping = true;
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

/**
 * Azure assessment path: record 16 kHz WAV, then send it with the target text
 * for phoneme-level scoring. She taps stop (like the cloud path); a safety
 * timer auto-stops so a forgotten tap can't hang the flow.
 */
function startAzureRecognition(
  assessmentKind: AssessmentKind,
  target?: string,
  autoEnd = false,
  maxDurationMs = SHORT_CAPTURE_MS,
): RecognitionHandle {
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
      const assessment = await assessRecording(blob, { kind: assessmentKind, ...(target ? { target } : {}) });
      if (settled) return;
      settled = true;
      const assessmentError = assessmentRecognitionError(assessment);
      if (assessmentError) {
        rejectFn(assessmentError);
      } else {
        resolveFn({
          transcript: assessment.recognizedText,
          confidence: 1,
          alternatives: assessment.recognizedText ? [assessment.recognizedText] : [],
          assessment,
          audio: blob,
        });
      }
    } catch {
      if (!settled) {
        settled = true;
        rejectFn(new RecognitionError("technical-skip", "Pronunciation scoring is temporarily unavailable. Try again."));
      }
    }
  };

  void (async () => {
    try {
      // In a continuous call the recorder decides when her turn ended, so she
      // never taps to hand the conversation back.
      wav = await startWavRecording(wavRecordingOptions({ autoEnd, maxDurationMs, onSpeechEnd: () => void finish() }));
      if (cancelled) {
        wav.cancel();
        return;
      }
      autoStop = setTimeout(finish, maxDurationMs);
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
export function createRecognition(
  opts: {
    lang?: string;
    target?: string;
    assess?: boolean;
    assessmentKind?: AssessmentKind;
    autoEnd?: boolean;
    maxDurationMs?: number;
  } = {},
): RecognitionHandle {
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
    return consentBound({
      result,
      stop: () => inner?.stop(),
      cancel: () => {
        cancelled = true;
        inner?.cancel();
      },
    });
  }
  // Warm the capability probe so the second attempt onward can use Azure.
  void assessEnabled();
  const { endOnSilence, maxDurationMs } = recognitionCapturePolicy(opts);
  // Assessment no longer needs a known target: Azure grades unscripted speech
  // too, so free conversation gets real pronunciation scores instead of only
  // repeat-after-me drills. `assess: true` opts a caller in without one.
  if ((opts.target || opts.assess) && assessEnabledSync() && hasMediaRecording()) {
    if (!opts.assessmentKind) {
      return consentBound({
        result: Promise.reject(new RecognitionError("technical-skip", "Pronunciation assessment mode is missing.")),
        stop: () => {},
        cancel: () => {},
      });
    }
    return consentBound(startAzureRecognition(opts.assessmentKind, opts.target, endOnSilence, maxDurationMs));
  }
  if (getSpeechRecognitionCtor()) return consentBound(startRecognition({ ...opts, maxDurationMs }));
  if (hasMediaRecording()) return consentBound(startCloudRecognition(endOnSilence, maxDurationMs));
  return consentBound({
    result: Promise.reject(new RecognitionError("unsupported", "Recording isn't available in this browser.")),
    stop: () => {},
    cancel: () => {},
  });
}

/**
 * Stage-exam capture has no transcript/Web Speech fallback. Capability is
 * resolved before consent or microphone access, then the cached Azure path is
 * the only path createRecognition can select.
 */
export async function createRequiredAssessmentRecognition(opts: {
  target?: string;
  assessmentKind: AssessmentKind;
  maxDurationMs?: number;
  signal?: AbortSignal;
}): Promise<RecognitionHandle> {
  try {
    await requireAssessmentCapability(opts.signal);
  } catch (error) {
    if (opts.signal?.aborted) throw new RecognitionError("cancelled", "Cancelled.");
    throw new RecognitionError("technical-skip", "Pronunciation assessment is unavailable.");
  }
  if (opts.signal?.aborted) throw new RecognitionError("cancelled", "Cancelled.");
  if (!hasMediaRecording()) throw new RecognitionError("technical-skip", "Pronunciation recording is unavailable.");
  const { signal: _signal, ...capture } = opts;
  return createRecognition({ ...capture, assess: true });
}
