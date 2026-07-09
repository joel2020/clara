// Illustrated layers for the purchasable backgrounds. The cosmetic's CSS
// gradient stays as the sky; these SVGs paint the place on top — so a shop
// background reads as a real prize, not a color fade. Anchored to the bottom
// edge (slice) so scenes stay grounded at any card size.

function Frame({ children, anchor = "bottom" }: { children: React.ReactNode; anchor?: "top" | "bottom" }) {
  // Ground scenes (waves, leaves) pin to the bottom edge; sky scenes
  // (bunting, clouds, planets) pin to the top so wide cards crop the
  // uninteresting end instead of the art.
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 200 200"
      preserveAspectRatio={anchor === "bottom" ? "xMidYMax slice" : "xMidYMin slice"}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function Fiesta() {
  // Papel picado bunting + drifting confetti.
  const flags = ["#ffd23f", "#2a62c9", "#e2453b", "#ffd23f", "#2a62c9", "#e2453b", "#ffd23f"];
  return (
    <Frame anchor="top">
      <path d="M-4 14 Q100 34 204 14" stroke="#00000022" strokeWidth="2" fill="none" />
      {flags.map((c, i) => {
        const x = 8 + i * 28;
        const y = 16 + Math.sin((i / 6) * Math.PI) * 9;
        return <path key={i} d={`M${x} ${y} h20 l-10 16z`} fill={c} opacity="0.92" />;
      })}
      {Array.from({ length: 14 }).map((_, i) => (
        <circle
          key={`c${i}`}
          cx={(i * 37 + 13) % 196}
          cy={40 + ((i * 53) % 130)}
          r={i % 3 === 0 ? 3 : 2}
          fill={flags[i % 3]}
          opacity="0.45"
        />
      ))}
    </Frame>
  );
}

function Sunset() {
  return (
    <Frame>
      <circle cx="100" cy="150" r="34" fill="#fff3c4" opacity="0.9" />
      <circle cx="100" cy="150" r="48" fill="#ffe9a8" opacity="0.35" />
      <rect x="0" y="150" width="200" height="50" fill="#c25b7c" opacity="0.55" />
      <path d="M0 152c20-6 40-6 60 0s40 6 60 0 40-6 60 0 30 4 30 4v46H0z" fill="#a94b6e" opacity="0.6" />
      <path d="M0 168c25-5 50-5 75 0s50 5 75 0 50-5 50-5v40H0z" fill="#8d3f61" opacity="0.65" />
      <path d="M52 96q6-7 12 0M140 84q6-7 12 0" stroke="#5d3550" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </Frame>
  );
}

function Ocean() {
  return (
    <Frame>
      <rect x="26" y="34" width="34" height="11" rx="5.5" fill="#ffffff" opacity="0.85" />
      <circle cx="38" cy="34" r="7" fill="#ffffff" opacity="0.85" />
      {/* distant island */}
      <ellipse cx="160" cy="132" rx="26" ry="7" fill="#e8d9a8" />
      <path d="M158 130c1-9 1-16-1-22" stroke="#a9764b" strokeWidth="3" strokeLinecap="round" />
      <path d="M157 108c-6-4-12-4-17-1 4-6 12-8 18-4 6-4 13-2 17 4-5-3-12-3-18 1z" fill="#3f9e68" />
      {/* sailboat */}
      <path d="M62 132v-22" stroke="#8a5a34" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M62 111c8 3 11 10 10 19H62z" fill="#e2453b" opacity="0.95" />
      <path d="M50 132h26l-5 8H55z" fill="#20477e" />
      {/* waves */}
      <path d="M0 150c12-6 24-6 36 0s24 6 36 0 24-6 36 0 24 6 36 0 24-6 36 0 20 5 20 5v45H0z" fill="#1d7fa8" opacity="0.5" />
      <path d="M0 166c15-6 30-6 45 0s30 6 45 0 30-6 45 0 30 6 45 0 20-4 20-4v38H0z" fill="#14618c" opacity="0.55" />
    </Frame>
  );
}

function Candy() {
  return (
    <Frame anchor="top">
      {[
        [30, 60, 16],
        [96, 38, 20],
        [164, 66, 14],
        [58, 120, 12],
        [148, 128, 16],
      ].map(([x, y, r], i) => (
        <g key={i} opacity="0.9">
          <circle cx={x} cy={y} r={r} fill="#fff" opacity="0.85" />
          <circle cx={x - r * 0.8} cy={y + r * 0.25} r={r * 0.7} fill="#fff" opacity="0.8" />
          <circle cx={x + r * 0.8} cy={y + r * 0.25} r={r * 0.7} fill="#ffeef8" opacity="0.85" />
        </g>
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <path
          key={`s${i}`}
          d="M0 -3l0.9 1.9 2.1 0.3-1.5 1.5 0.35 2.1L0 1.8l-1.85 1-0.35-2.1-1.5-1.5 2.1-0.3z"
          transform={`translate(${(i * 41 + 22) % 190} ${86 + ((i * 61) % 96)}) scale(${1.1 + (i % 3) * 0.4})`}
          fill={i % 2 ? "#e7a6d8" : "#b39ff0"}
          opacity="0.7"
        />
      ))}
    </Frame>
  );
}

function Jungle() {
  return (
    <Frame>
      {/* corner monstera fans */}
      <g opacity="0.85">
        <path d="M-6 200C-2 158 16 132 46 122c-18 22-24 48-22 78z" fill="#1f7a4d" />
        <path d="M14 200c4-30 18-50 40-58-12 18-16 38-14 58z" fill="#2c9160" />
        <path d="M206 200c-4-44-24-72-56-82 20 24 26 52 24 82z" fill="#1f7a4d" />
        <path d="M182 200c-4-32-18-52-42-62 13 19 17 40 15 62z" fill="#2c9160" />
      </g>
      {/* hanging vines */}
      <path d="M30 0q4 22-6 40M170 0q-4 26 8 46M104 0q2 14-4 26" stroke="#1f7a4d" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
      {/* flowers */}
      {[
        [34, 148],
        [168, 140],
        [22, 188],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="3" ry="5.5" fill="#e2453b" transform={`rotate(${a})`} />
          ))}
          <circle r="3" fill="#ffd23f" />
        </g>
      ))}
    </Frame>
  );
}

function Galaxy() {
  return (
    <Frame anchor="top">
      {Array.from({ length: 18 }).map((_, i) => (
        <circle key={i} cx={(i * 47 + 9) % 198} cy={(i * 71 + 15) % 190} r={i % 4 === 0 ? 1.8 : 1} fill="#fff" opacity={0.4 + (i % 3) * 0.2} />
      ))}
      {/* ringed planet */}
      <g transform="translate(150 54) rotate(-18)">
        <circle r="15" fill="#e8b26a" />
        <circle r="15" fill="#c98b4e" opacity="0.45" clipPath="inset(50% 0 0 0)" />
        <ellipse rx="26" ry="7" fill="none" stroke="#f3d9ae" strokeWidth="3" opacity="0.85" />
      </g>
      {/* comet */}
      <path d="M22 96L58 78" stroke="url(#cometTail)" strokeWidth="3" strokeLinecap="round" />
      <defs>
        <linearGradient id="cometTail" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" />
        </linearGradient>
      </defs>
      <circle cx="58" cy="78" r="4" fill="#fff" />
      <path
        d="M0 -4l1.2 2.5 2.8 0.4-2 2 0.5 2.8L0 2.4l-2.5 1.3 0.5-2.8-2-2 2.8-0.4z"
        transform="translate(96 130) scale(1.6)"
        fill="#ffd23f"
        opacity="0.9"
      />
    </Frame>
  );
}

const SCENES: Record<string, () => React.ReactNode> = {
  "bg-default": Fiesta,
  "bg-sunset": Sunset,
  "bg-ocean": Ocean,
  "bg-candy": Candy,
  "bg-jungle": Jungle,
  "bg-galaxy": Galaxy,
};

export function SceneArt({ bgId }: { bgId: string }) {
  const Scene = SCENES[bgId];
  return Scene ? <Scene /> : null;
}
