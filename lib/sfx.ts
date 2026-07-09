"use client";

// Tiny synthesized sound effects via Web Audio — no asset files, instant, and
// easy to mute. Created lazily on first use (after a user gesture, so autoplay
// policies are satisfied). Respects a global enabled flag wired to settings.
//
// The "correct" and "wrong" cues are written like little musical stings: a
// bright, triumphant arpeggio for a win (warmer and taller as the combo grows)
// and a soft, encouraging two-note fall for a miss — never a harsh buzzer,
// since the learner is a nervous beginner and the sound should invite a retry.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
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
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

type Wave = OscillatorType;

interface NoteOpts {
  type?: Wave;
  gain?: number;
  slideTo?: number;
  attack?: number;
  release?: number;
  /** Add a second, slightly detuned voice for a fuller, chime-like tone. */
  detune?: number;
  /** Route through a gentle low-pass for warmth (Hz cutoff). */
  soft?: number;
}

// One shaped note with a proper attack/decay envelope so it reads as musical,
// not clicky. Optional detuned twin and low-pass give body without samples.
function note(freq: number, start: number, dur: number, opts: NoteOpts = {}) {
  const ac = audioCtx();
  if (!ac || !master) return;
  const t0 = ac.currentTime + start;
  const attack = opts.attack ?? 0.012;
  const release = opts.release ?? dur;
  const peak = opts.gain ?? 0.12;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

  let sink: AudioNode = master;
  if (opts.soft) {
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = opts.soft;
    gain.connect(lp).connect(master);
    sink = gain;
  } else {
    gain.connect(master);
    sink = gain;
  }

  const voices = opts.detune ? [0, opts.detune] : [0];
  for (const cents of voices) {
    const osc = ac.createOscillator();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (cents) osc.detune.setValueAtTime(cents, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    osc.connect(sink);
    osc.start(t0);
    osc.stop(t0 + attack + release + 0.03);
  }
}

const guard = () => enabled && typeof window !== "undefined";

// A note name → frequency table for the octaves the stings use.
const C4 = 261.63;
const semis = (n: number) => C4 * Math.pow(2, n / 12);

export const sfx = {
  /**
   * A happy little win jingle: a major arpeggio (root–third–fifth–octave) with
   * a sparkle on top, played warmer and a step higher as the combo climbs.
   */
  correct(combo = 1) {
    if (!guard()) return;
    const lift = Math.min(combo - 1, 7); // shift up to a fifth as combos stack
    const root = semis(lift);
    const arp = [0, 4, 7, 12]; // major triad + octave
    arp.forEach((iv, i) => {
      note(root * Math.pow(2, iv / 12), i * 0.06, 0.16, {
        type: "triangle",
        gain: 0.13,
        detune: 6,
        attack: 0.01,
        release: 0.18,
      });
    });
    // sparkle
    note(root * 4, 0.24, 0.22, { type: "sine", gain: 0.09, attack: 0.008, release: 0.3 });
  },

  /**
   * A gentle, encouraging "aww — try again": two soft falling notes through a
   * low-pass. Warm and short, never a harsh buzzer.
   */
  wrong() {
    if (!guard()) return;
    note(semis(4), 0, 0.16, { type: "triangle", gain: 0.11, soft: 1400, attack: 0.014, release: 0.18 });
    note(semis(1), 0.12, 0.26, { type: "triangle", gain: 0.11, soft: 1200, attack: 0.014, release: 0.32 });
  },

  tap() {
    if (!guard()) return;
    note(420, 0, 0.05, { type: "sine", gain: 0.05, attack: 0.005, release: 0.06 });
  },

  levelUp() {
    if (!guard()) return;
    [0, 4, 7, 12, 16].forEach((iv, i) =>
      note(semis(iv), i * 0.1, 0.24, { type: "triangle", gain: 0.14, detune: 7, release: 0.26 }),
    );
  },

  achievement() {
    if (!guard()) return;
    [7, 11, 14].forEach((iv, i) => note(semis(iv), i * 0.08, 0.24, { type: "sine", gain: 0.12, release: 0.28 }));
  },

  goal() {
    if (!guard()) return;
    [7, 11, 14, 19].forEach((iv, i) => note(semis(iv), i * 0.09, 0.22, { type: "triangle", gain: 0.12, detune: 6, release: 0.24 }));
  },

  /** A full triumphant flourish for finishing a lesson. */
  finish() {
    if (!guard()) return;
    [0, 4, 7, 12, 16, 19].forEach((iv, i) =>
      note(semis(iv), i * 0.1, 0.3, { type: "triangle", gain: 0.13, detune: 7, release: 0.34 }),
    );
    note(semis(24), 0.62, 0.5, { type: "sine", gain: 0.1, attack: 0.01, release: 0.6 });
  },
};
