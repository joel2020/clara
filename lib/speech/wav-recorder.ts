"use client";

// A universal microphone recorder that produces 16 kHz mono WAV — the format
// Azure Pronunciation Assessment wants. Built on WebAudio (getUserMedia +
// ScriptProcessor) because it behaves identically on iPhone Safari and desktop,
// unlike MediaRecorder whose output format differs per browser (AAC vs OPUS).
// The downsample/encode helpers are pure so they can be unit-tested.

export const TARGET_RATE = 16000;

/** Linear-interpolation downsample to the target rate. Pure. */
export function downsample(input: Float32Array, fromRate: number, toRate = TARGET_RATE): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

/** Encode mono float samples as a 16-bit PCM WAV file. Pure. */
export function encodeWav(samples: Float32Array, sampleRate = TARGET_RATE): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface WavHandle {
  /** Stop recording and get the WAV blob. */
  stop: () => Promise<Blob>;
  cancel: () => void;
  /** Loudest sample seen, 0–1. Near zero means the mic captured nothing. */
  peak: () => number;
}

export interface WavOptions {
  /** Caller-specific hard cap; continuous calls use their 30-second turn limit. */
  maxDurationMs?: number;
  /**
   * Fired once she stops talking, so a continuous call can take its turn
   * without her tapping a button. Only ever fires AFTER speech was detected —
   * a learner thinking before she answers must not be cut off, which is the
   * difference between a conversation and an interrogation.
   */
  onSpeechEnd?: () => void;
}

const MAX_MS = 15000;

/** The effective safety cap for this recording, independently testable. */
export function wavRecordingDurationMs(options: WavOptions = {}): number {
  return options.maxDurationMs ?? MAX_MS;
}

/** Silence this long after she has spoken reads as "her turn is over". */
const END_OF_SPEECH_MS = 1400;
/** A frame at or above this counts as voice rather than room noise. */
const VOICE_PEAK = 0.02;

/** Below this the capture is silence, not a quiet voice — the mic never opened. */
export const SILENCE_PEAK = 0.004;

export async function startWavRecording(options: WavOptions = {}): Promise<WavHandle> {
  // Create AND unlock the AudioContext *before* awaiting getUserMedia. On iOS
  // Safari the mic permission prompt ends the user-gesture window, so a context
  // constructed or resumed after that await stays suspended forever —
  // onaudioprocess never fires and we'd silently record pure silence.
  type AC = typeof AudioContext;
  const Ctx: AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: AC }).webkitAudioContext;
  const ctx = new Ctx();
  const unlocked = ctx.state === "suspended" ? ctx.resume().catch(() => {}) : Promise.resolve();

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    void ctx.close().catch(() => {});
    throw e;
  }
  await unlocked;

  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is deprecated but universally supported (incl. iOS Safari)
  // and fine for short clips like these. It must stay connected to destination
  // or Safari never fires onaudioprocess; its output buffer is left silent.
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let finished = false;
  let peak = 0;

  // End-of-speech detection, measured per frame rather than from the cumulative
  // peak: `peak` only grows, so it can say "the mic worked" but never "she has
  // finished". A frame's own peak can.
  let heardVoice = false;
  let quietSince = 0;
  let endFired = false;

  processor.onaudioprocess = (e) => {
    if (finished) return;
    const input = e.inputBuffer.getChannelData(0);
    let framePeak = 0;
    for (let i = 0; i < input.length; i++) {
      const a = input[i] < 0 ? -input[i] : input[i];
      if (a > framePeak) framePeak = a;
    }
    if (framePeak > peak) peak = framePeak;
    chunks.push(new Float32Array(input));

    if (!options.onSpeechEnd || endFired) return;
    const now = Date.now();
    if (framePeak >= VOICE_PEAK) {
      heardVoice = true;
      quietSince = 0;
      return;
    }
    // Silence before she has said anything is her thinking. Leave her alone.
    if (!heardVoice) return;
    if (quietSince === 0) quietSince = now;
    else if (now - quietSince >= END_OF_SPEECH_MS) {
      endFired = true;
      options.onSpeechEnd();
    }
  };
  source.connect(processor);
  processor.connect(ctx.destination);

  const cleanup = () => {
    finished = true;
    try {
      processor.disconnect();
      source.disconnect();
    } catch {
      /* no-op */
    }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  const safety = setTimeout(cleanup, wavRecordingDurationMs(options));

  return {
    peak: () => peak,
    stop: async () => {
      clearTimeout(safety);
      const rate = ctx.sampleRate;
      cleanup();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const all = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        all.set(c, off);
        off += c.length;
      }
      return encodeWav(downsample(all, rate));
    },
    cancel: () => {
      clearTimeout(safety);
      cleanup();
    },
  };
}
