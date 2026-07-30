"use client";

import { useEffect, useState } from "react";
import { CharacterIllustration } from "@/components/character";

// A brief "movie moment" for big wins — letterbox bars slide in, the screen
// dims, light rays sweep behind Clara's celebrating pose as she zooms in, and the
// star reward counts up. Fully imperative (call `cinematic.play(...)` from
// anywhere) and self-dismissing (~1.9s). No-ops under reduced motion so it
// never gets in the way of a learner who's turned motion off.

interface Scene {
  id: number;
  title?: string;
  subtitle?: string;
  stars?: number;
}

let listener: ((s: Scene | null) => void) | null = null;
let nextId = 1;

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const cinematic = {
  play(opts: { title?: string; subtitle?: string; stars?: number } = {}) {
    if (!listener || reducedMotion()) return;
    listener({ id: nextId++, ...opts });
  },
};

function CountUp({ to }: { to: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to <= 0) return;
    let raf = 0;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setN(Math.round(p * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{n}</>;
}

export function CinematicLayer() {
  const [scene, setScene] = useState<Scene | null>(null);

  useEffect(() => {
    listener = setScene;
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!scene) return;
    const t = setTimeout(() => setScene(null), 1950);
    return () => clearTimeout(t);
  }, [scene]);

  if (!scene) return null;

  return (
    <div key={scene.id} className="cine-overlay pointer-events-none fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden">
      <div className="cine-scrim absolute inset-0" aria-hidden />
      <div className="cine-bar cine-bar-top absolute inset-x-0 top-0" aria-hidden />
      <div className="cine-bar cine-bar-bottom absolute inset-x-0 bottom-0" aria-hidden />
      <div className="cine-rays absolute" aria-hidden />

      <div className="cine-hero relative flex flex-col items-center">
        <div className="relative h-64 w-52 sm:h-72 sm:w-60">
          {/* Milestone unlock / streak celebration — `celebrating`, full
              figure. The whole overlay already no-ops under reduced motion. */}
          <CharacterIllustration state="celebrating" preload />
        </div>
        {scene.title && (
          <p className="mt-1 font-display text-3xl font-semibold tracking-[-0.02em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {scene.title}
          </p>
        )}
        {scene.subtitle && <p className="mt-1 text-sm font-medium text-white/85">{scene.subtitle}</p>}
        {scene.stars ? (
          <p className="star-chip bloom-gold mt-3 rounded-full px-5 py-1.5 font-display text-xl font-bold">
            +<CountUp to={scene.stars} /> ★
          </p>
        ) : null}
      </div>
    </div>
  );
}
