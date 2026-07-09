"use client";

import { useEffect, useState } from "react";

// The "juice" engine — arcade game-feel for the whole app. A single fixed
// overlay renders short-lived particles (tricolor stars, glow rays, light
// sweeps, floating rewards) spawned imperatively from anywhere via `juice.*`.
// Design rules: Colombian tricolor palette, 300–900ms lifetimes, hard particle
// cap, pointer-events-none, and everything no-ops under reduced motion — the
// spectacle never blocks or blurs the gameplay.

type Particle =
  | { id: number; kind: "star"; x: number; y: number; dx: number; dy: number; size: number; color: string; ms: number }
  | { id: number; kind: "ray"; x: number; y: number; angle: number; length: number; color: string; ms: number }
  | { id: number; kind: "flash"; x: number; y: number; size: number; ms: number }
  | { id: number; kind: "float"; x: number; y: number; text: string; ms: number }
  | { id: number; kind: "sweep"; ms: number };

const TRICOLOR = ["var(--co-yellow)", "var(--co-blue)", "var(--co-red)", "var(--co-yellow)", "#ffffff"];
const MAX_PARTICLES = 80;

let nextId = 1;
let listener: ((p: Particle[]) => void) | null = null;
let pool: Particle[] = [];

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function push(items: Particle[]) {
  if (!listener || reducedMotion()) return;
  pool = [...pool, ...items].slice(-MAX_PARTICLES);
  listener(pool);
  for (const it of items) {
    setTimeout(() => {
      pool = pool.filter((p) => p.id !== it.id);
      listener?.(pool);
    }, it.ms + 60);
  }
}

/** Small sparkle at a tap point — makes every interaction feel alive. */
function tap(x: number, y: number) {
  const items: Particle[] = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 16 + Math.random() * 18;
    items.push({
      id: nextId++,
      kind: "star",
      x,
      y,
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d - 8,
      size: 7 + Math.random() * 6,
      color: TRICOLOR[i % TRICOLOR.length],
      ms: 450,
    });
  }
  push(items);
}

/** A win: star explosion + glowing rays + a light flash. */
function burst(x: number, y: number, opts: { count?: number; rays?: boolean } = {}) {
  const { count = 12, rays = true } = opts;
  const items: Particle[] = [{ id: nextId++, kind: "flash", x, y, size: 90, ms: 500 }];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const d = 55 + Math.random() * 65;
    items.push({
      id: nextId++,
      kind: "star",
      x,
      y,
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      size: 9 + Math.random() * 9,
      color: TRICOLOR[i % TRICOLOR.length],
      ms: 700,
    });
  }
  if (rays) {
    for (let i = 0; i < 6; i++) {
      items.push({
        id: nextId++,
        kind: "ray",
        x,
        y,
        angle: (i / 6) * 360 + Math.random() * 20,
        length: 70 + Math.random() * 40,
        color: TRICOLOR[i % 3],
        ms: 600,
      });
    }
  }
  push(items);
}

/** Floating reward text ("+2 ★") that drifts up and fades. */
function float(x: number, y: number, text: string) {
  push([{ id: nextId++, kind: "float", x, y, text, ms: 950 }]);
}

/** A tricolor light band sweeping across the screen — combo / milestone. */
function sweep() {
  push([{ id: nextId++, kind: "sweep", ms: 750 }]);
}

/** Convenience: a centered celebration for full-screen moments. */
function centerBurst(text?: string) {
  if (typeof window === "undefined") return;
  const x = window.innerWidth / 2;
  const y = window.innerHeight * 0.38;
  burst(x, y, { count: 14 });
  if (text) float(x, y - 30, text);
}

export const juice = { tap, burst, float, sweep, centerBurst };

// A five-point star path, filled with the particle's color.
function StarShape({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }} aria-hidden>
      <path
        d="M12 1.8l3 6.2 6.8 1-4.9 4.8 1.2 6.8-6.1-3.2-6.1 3.2 1.2-6.8L2.2 9l6.8-1z"
        fill={color}
      />
    </svg>
  );
}

export function JuiceLayer() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    listener = setParticles;
    // Sparkle on taps of interactive elements — throttled so fast taps don't flood.
    let last = 0;
    const onDown = (e: PointerEvent) => {
      const now = Date.now();
      if (now - last < 90) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest("button, a")) return;
      last = now;
      tap(e.clientX, e.clientY);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => {
      listener = null;
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {particles.map((p) => {
        switch (p.kind) {
          case "star":
            return (
              <span
                key={p.id}
                className="juice-star"
                style={
                  {
                    left: p.x,
                    top: p.y,
                    "--dx": `${p.dx}px`,
                    "--dy": `${p.dy}px`,
                    "--dur": `${p.ms}ms`,
                    color: p.color,
                  } as React.CSSProperties
                }
              >
                <StarShape size={p.size} color={p.color} />
              </span>
            );
          case "ray":
            return (
              <span
                key={p.id}
                className="juice-ray"
                style={
                  {
                    left: p.x,
                    top: p.y,
                    "--angle": `${p.angle}deg`,
                    "--len": `${p.length}px`,
                    "--dur": `${p.ms}ms`,
                    background: `linear-gradient(to top, transparent, ${p.color})`,
                  } as React.CSSProperties
                }
              />
            );
          case "flash":
            return (
              <span
                key={p.id}
                className="juice-flash"
                style={{ left: p.x, top: p.y, width: p.size, height: p.size, "--dur": `${p.ms}ms` } as React.CSSProperties}
              />
            );
          case "float":
            return (
              <span
                key={p.id}
                className="juice-float star-chip"
                style={{ left: p.x, top: p.y, "--dur": `${p.ms}ms` } as React.CSSProperties}
              >
                {p.text}
              </span>
            );
          case "sweep":
            return <span key={p.id} className="juice-sweep" style={{ "--dur": `${p.ms}ms` } as React.CSSProperties} />;
        }
      })}
    </div>
  );
}

// Deterministic star recipe for the global ambient layer — spread across the
// width, varied sizes/speeds/sways so the drift never reads as a pattern.
const AMBIENT = [
  { left: 4, size: 9, dur: 17, delay: 0, sway: 26, o: 0.5 },
  { left: 15, size: 13, dur: 21, delay: 4, sway: -34, o: 0.4 },
  { left: 27, size: 8, dur: 15, delay: 9, sway: 20, o: 0.55 },
  { left: 41, size: 11, dur: 19, delay: 2, sway: -24, o: 0.45 },
  { left: 55, size: 9, dur: 16, delay: 12, sway: 30, o: 0.5 },
  { left: 68, size: 14, dur: 23, delay: 6, sway: -20, o: 0.35 },
  { left: 80, size: 10, dur: 18, delay: 14, sway: 24, o: 0.5 },
  { left: 92, size: 8, dur: 20, delay: 8, sway: -28, o: 0.45 },
];

/**
 * Always-on ambient life for the whole app: tricolor stars drifting up the
 * screen plus an occasional light streak sweeping across. Pure looping CSS —
 * no timers, no re-renders — and hidden entirely under reduced motion.
 */
export function AmbientFx() {
  return (
    <div className="ambient-fx pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {AMBIENT.map((s, i) => (
        <span
          key={i}
          className="ambient-star"
          style={
            {
              left: `${s.left}%`,
              "--sway": `${s.sway}px`,
              "--o": s.o,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.delay}s`,
            } as React.CSSProperties
          }
        >
          <StarShape size={s.size} color={TRICOLOR[i % 3]} />
        </span>
      ))}
      <span className="ambient-streak" style={{ top: "16%", animationDuration: "13s", animationDelay: "3s" }} />
      <span
        className="ambient-streak"
        style={{ top: "62%", animationDuration: "19s", animationDelay: "11s", "--streak": "var(--co-blue)" } as React.CSSProperties}
      />
    </div>
  );
}

/** Gentle ambient twinkles for hero surfaces — always-on life, never in the way. */
export function AmbientStars({ count = 7 }: { count?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 13.7 + 6) % 94;
        const top = (i * 23.3 + 8) % 82;
        const size = 6 + (i % 3) * 4;
        const color = TRICOLOR[i % 3];
        return (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              animation: `fx-twinkle ${2.4 + (i % 3)}s ease-in-out ${(i % 5) * 0.5}s infinite`,
            }}
          >
            <StarShape size={size} color={color} />
          </span>
        );
      })}
    </div>
  );
}
