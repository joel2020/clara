"use client";

// Tiny synthesized sound effects via Web Audio — no asset files, instant, and
// easy to mute. Created lazily on first use (after a user gesture, so autoplay
// policies are satisfied). Respects a global enabled flag wired to settings.

let ctx: AudioContext | null = null;
let enabled = true;

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Wave = OscillatorType;

function tone(freq: number, start: number, dur: number, opts: { type?: Wave; gain?: number; slideTo?: number } = {}) {
  const ac = audioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, ac.currentTime + start + dur);
  const peak = opts.gain ?? 0.12;
  gain.gain.setValueAtTime(0.0001, ac.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(peak, ac.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

const guard = () => enabled && typeof window !== "undefined";

export const sfx = {
  /** Bright two-note rise; higher when the combo is hot. */
  correct(combo = 1) {
    if (!guard()) return;
    const base = 540 + Math.min(combo, 8) * 28;
    tone(base, 0, 0.12, { type: "triangle", gain: 0.14 });
    tone(base * 1.5, 0.09, 0.16, { type: "triangle", gain: 0.13 });
  },
  wrong() {
    if (!guard()) return;
    tone(200, 0, 0.18, { type: "sawtooth", gain: 0.08, slideTo: 150 });
  },
  tap() {
    if (!guard()) return;
    tone(420, 0, 0.05, { type: "sine", gain: 0.06 });
  },
  levelUp() {
    if (!guard()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.2, { type: "triangle", gain: 0.14 }));
  },
  achievement() {
    if (!guard()) return;
    [659, 880, 1175].forEach((f, i) => tone(f, i * 0.08, 0.22, { type: "sine", gain: 0.13 }));
  },
  goal() {
    if (!guard()) return;
    [784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.2, { type: "triangle", gain: 0.13 }));
  },
  finish() {
    if (!guard()) return;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.28, { type: "triangle", gain: 0.13 }));
  },
};
