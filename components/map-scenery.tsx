// Hand-drawn SVG scenery for the adventure map — the world she travels
// through. World 1 (conversation) is the Caribbean coast; world 2 (sounds)
// climbs into the Andes. All decorative: aria-hidden, pointer-events-none,
// soft opacity so the path and labels always win.

const SOFT = { opacity: 0.85 } as const;

export function PalmTree({ size = 76 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden style={SOFT}>
      <path d="M38 72c1-14 1-26-2-38" stroke="#a9764b" strokeWidth="5" strokeLinecap="round" />
      <path d="M36 34C26 28 16 28 8 33c8-10 20-12 30-6" fill="#43a86e" />
      <path d="M36 33c-2-11 2-20 10-26-2 10-1 18 0 24" fill="#3a9e63" />
      <path d="M38 34c8-8 19-10 28-6-9-1-18 3-24 10" fill="#4cb578" />
      <path d="M37 35c10-2 19 2 24 10-8-5-16-6-23-4" fill="#43a86e" />
      <circle cx="34" cy="38" r="4" fill="#8a5a34" />
      <circle cx="42" cy="40" r="4" fill="#8a5a34" />
      <ellipse cx="38" cy="74" rx="16" ry="3.5" fill="#eaddc4" />
    </svg>
  );
}

export function SunAndCloud({ size = 70 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 80 56" fill="none" aria-hidden style={SOFT}>
      <circle cx="52" cy="22" r="13" fill="var(--co-yellow)" />
      <circle cx="52" cy="22" r="18" fill="var(--co-yellow)" opacity="0.25" />
      <rect x="14" y="30" width="36" height="13" rx="6.5" fill="#fff" />
      <circle cx="24" cy="30" r="8" fill="#fff" />
      <circle cx="36" cy="27" r="10" fill="#fff" />
      <rect x="14" y="30" width="36" height="13" rx="6.5" fill="#dfeaf7" opacity="0.5" />
    </svg>
  );
}

export function Sailboat({ size = 66 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.85} viewBox="0 0 72 60" fill="none" aria-hidden style={SOFT}>
      <path d="M35 6v30" stroke="#8a5a34" strokeWidth="3" strokeLinecap="round" />
      <path d="M35 8c12 4 16 14 15 26H35z" fill="var(--co-red)" opacity="0.9" />
      <path d="M33 12c-9 5-12 13-12 22h12z" fill="#ffffff" stroke="#e5dccb" />
      <path d="M16 40h40l-7 10H24z" fill="var(--co-blue)" />
      <path d="M6 52c6-4 12-4 18 0s12 4 18 0 12-4 18 0" stroke="#7fb6e8" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Mountains({ size = 92 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 100 62" fill="none" aria-hidden style={SOFT}>
      <path d="M4 58L30 14l26 44z" fill="#7c9ec9" />
      <path d="M30 14l8 14-6 3-5-6-5 8-4-3z" fill="#f3f7fc" />
      <path d="M42 58l24-36 22 36z" fill="#5c82b5" />
      <path d="M66 22l6 10-5 2-4-4-4 6-3-2z" fill="#f3f7fc" />
      <ellipse cx="50" cy="59" rx="46" ry="3" fill="#e3ecdf" />
    </svg>
  );
}

export function CoffeePlant({ size = 62 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden style={SOFT}>
      <path d="M32 58c0-14-1-26 0-36" stroke="#5d8f4e" strokeWidth="4" strokeLinecap="round" />
      <path d="M32 30c-8-2-13-8-14-16 8 1 13 6 15 13" fill="#4f9a44" />
      <path d="M33 26c1-8 6-13 14-15-1 8-6 14-13 16" fill="#5aab4f" />
      <path d="M31 42c-7-1-11-5-13-12 7 1 11 5 13 11" fill="#4f9a44" />
      <circle cx="24" cy="44" r="4" fill="var(--co-red)" />
      <circle cx="32" cy="49" r="4" fill="#d63c30" />
      <circle cx="40" cy="44" r="4" fill="var(--co-red)" />
      <ellipse cx="32" cy="60" rx="14" ry="3" fill="#e3ecdf" />
    </svg>
  );
}

export function WaxPalms({ size = 74 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 76 76" fill="none" aria-hidden style={SOFT}>
      <path d="M22 72c2-20 2-38 0-52" stroke="#b9a06d" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 20c-6-3-11-3-16 0 4-6 11-8 17-4 6-4 13-2 17 4-5-3-10-3-16 0z" fill="#4f9a44" />
      <path d="M54 72c2-16 2-30 0-42" stroke="#b9a06d" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M54 30c-5-2-9-2-13 0 3-5 9-6 14-3 5-3 10-2 13 3-4-2-9-2-13 0z" fill="#5aab4f" />
      <ellipse cx="38" cy="73" rx="26" ry="3" fill="#e3ecdf" />
    </svg>
  );
}

/** Ordered scenery per world; the map cycles through these between stops. */
export const WORLD_SCENERY: Record<"conversation" | "sounds", (({ size }: { size?: number }) => React.ReactNode)[]> = {
  conversation: [PalmTree, SunAndCloud, Sailboat],
  sounds: [Mountains, CoffeePlant, WaxPalms],
};
