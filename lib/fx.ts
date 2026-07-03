"use client";

import confetti from "canvas-confetti";

// Celebration visuals. The confetti is Colombia meets USA: condor gold, flag
// blue, the red both flags share, and stars-and-stripes white/navy.

const COLORS = ["#FCD116", "#003893", "#CE1126", "#FFFFFF", "#3C3B6E"];

/** A quick pop — for a single clear word. */
export function popConfetti(origin?: { x: number; y: number }): void {
  confetti({
    particleCount: 40,
    spread: 60,
    startVelocity: 32,
    gravity: 0.9,
    scalar: 0.8,
    ticks: 120,
    colors: COLORS,
    origin: origin ?? { x: 0.5, y: 0.6 },
    disableForReducedMotion: true,
  });
}

/** A bigger celebration — for finishing a lesson or a milestone. */
export function celebrate(): void {
  const end = Date.now() + 900;
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
    confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: COLORS, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** A celebratory upward fountain — for level-ups. */
export function levelUpBurst(): void {
  confetti({
    particleCount: 120,
    spread: 100,
    startVelocity: 45,
    gravity: 0.8,
    scalar: 1,
    origin: { x: 0.5, y: 0.65 },
    colors: COLORS,
    disableForReducedMotion: true,
  });
}
