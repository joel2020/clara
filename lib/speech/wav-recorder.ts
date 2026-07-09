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
}

const MAX_MS = 15000;

export async function startWavRecording(): Promise<WavHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  type AC = typeof AudioContext;
  const Ctx: AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: AC }).webkitAudioContext;
  const ctx = new Ctx();
  // iOS creates suspended contexts outside direct gestures — resume defensively.
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  // ScriptProcessor is deprecated but universally supported (incl. iOS Safari)
  // and fine for short clips like these.
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let finished = false;

  processor.onaudioprocess = (e) => {
    if (!finished) chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
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

  const safety = setTimeout(cleanup, MAX_MS);

  return {
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
