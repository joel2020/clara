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
      <path className="s-wave" d="M0 150c12-6 24-6 36 0s24 6 36 0 24-6 36 0 24 6 36 0 24-6 36 0 20 5 20 5v45H0z" fill="#1d7fa8" opacity="0.5" />
      <path className="s-wave" style={{ animationDelay: "1.2s" }} d="M0 166c15-6 30-6 45 0s30 6 45 0 30-6 45 0 30 6 45 0 20-4 20-4v38H0z" fill="#14618c" opacity="0.55" />
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
        <g key={i} className="s-drift" style={{ animationDelay: `${i * 1.1}s` }} opacity="0.9">
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
        <circle key={i} className="s-twinkle" style={{ animationDelay: `${(i % 6) * 0.5}s` }} cx={(i * 47 + 9) % 198} cy={(i * 71 + 15) % 190} r={i % 4 === 0 ? 1.8 : 1} fill="#fff" opacity={0.4 + (i % 3) * 0.2} />
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

function Beach() {
  return (
    <Frame>
      <circle cx="150" cy="40" r="16" fill="#fff3c4" opacity="0.95" />
      <circle cx="150" cy="40" r="24" fill="#ffe9a8" opacity="0.35" />
      {/* palm */}
      <path d="M40 200c-2-40-2-72 0-96" stroke="#a9764b" strokeWidth="6" strokeLinecap="round" />
      <path d="M40 104c-14-6-28-4-40 4 10-14 28-18 42-10 14-8 32-4 42 10-14-8-30-8-44-4z" fill="#3f9e68" />
      {/* sea + sand */}
      <path className="s-wave" d="M0 150c16-6 32-6 48 0s32 6 48 0 32-6 48 0 32 6 40 4v50H0z" fill="#2aa7d6" opacity="0.55" />
      <path d="M0 168c40-8 80-8 120 0s80 8 80 8v28H0z" fill="#f2cf86" />
      <path d="M0 176c40-6 80-6 120 0s80 6 80 6v20H0z" fill="#e8bf6e" />
    </Frame>
  );
}

function Meadow() {
  return (
    <Frame>
      <circle cx="40" cy="42" r="15" fill="#fff3c4" opacity="0.9" />
      <path d="M0 158c30-8 60-8 100 0s70 8 100 6v40H0z" fill="#8fce63" />
      <path d="M0 176c34-6 68-6 100 0s66 6 100 4v24H0z" fill="#79bd4f" />
      {[
        [24, 168, "#e2453b"],
        [60, 178, "#ffd23f"],
        [104, 172, "#e7a6d8"],
        [150, 182, "#e2453b"],
        [182, 170, "#ffd23f"],
      ].map(([x, y, c], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="3" ry="5" fill={c as string} transform={`rotate(${a})`} />
          ))}
          <circle r="2.5" fill="#fff6cf" />
        </g>
      ))}
    </Frame>
  );
}

function Rainbow() {
  const bands = ["#e2453b", "#ff9a3d", "#ffd23f", "#4caf6a", "#2a72c9", "#7a4fb0"];
  return (
    <Frame anchor="top">
      {bands.map((c, i) => (
        <path key={i} d={`M-10 ${150} A ${120 - i * 8} ${120 - i * 8} 0 0 1 ${210} ${150}`} fill="none" stroke={c} strokeWidth="8" opacity="0.8" />
      ))}
      <g className="s-drift" opacity="0.9">
        <circle cx="26" cy="150" r="12" fill="#fff" />
        <circle cx="40" cy="150" r="15" fill="#fff" />
      </g>
      <g className="s-drift" style={{ animationDelay: "2s" }} opacity="0.9">
        <circle cx="174" cy="150" r="12" fill="#fff" />
        <circle cx="160" cy="150" r="15" fill="#fff" />
      </g>
    </Frame>
  );
}

function Night() {
  return (
    <Frame anchor="top">
      <circle cx="150" cy="46" r="20" fill="#fdf3c0" />
      <circle cx="143" cy="42" r="17" fill="#33528f" />
      {Array.from({ length: 22 }).map((_, i) => (
        <path
          key={i}
          className="s-twinkle"
          style={{ animationDelay: `${(i % 7) * 0.4}s` }}
          d="M0 -2.4l0.7 1.5 1.7 0.25-1.2 1.2 0.28 1.7L0 1.4l-1.5 0.8 0.28-1.7-1.2-1.2 1.7-0.25z"
          transform={`translate(${(i * 41 + 12) % 196} ${(i * 53 + 20) % 150}) scale(${1 + (i % 3) * 0.6})`}
          fill="#fff"
          opacity={0.5 + (i % 3) * 0.2}
        />
      ))}
    </Frame>
  );
}

function City() {
  const towers = [
    [6, 120, 26],
    [36, 96, 22],
    [62, 132, 20],
    [86, 84, 28],
    [118, 110, 24],
    [146, 70, 26],
    [176, 120, 22],
  ];
  return (
    <Frame>
      <circle cx="40" cy="44" r="13" fill="#fff3c4" opacity="0.85" />
      {towers.map(([x, y, w], i) => (
        <g key={i}>
          <rect x={x} y={y} width={w} height={200 - y} fill="#1e1436" opacity="0.85" />
          {Array.from({ length: Math.floor((200 - y) / 14) }).map((_, r) =>
            Array.from({ length: Math.floor(w / 8) }).map((_, c2) => {
              const lit = (r + c2 + i) % 3 === 0;
              return (
                <rect
                  key={`${r}-${c2}`}
                  className={lit ? "s-flicker" : undefined}
                  style={lit ? { animationDelay: `${((r + c2 + i) % 5) * 0.7}s` } : undefined}
                  x={x + 3 + c2 * 8}
                  y={y + 6 + r * 14}
                  width="3.5"
                  height="5"
                  fill={lit ? "#ffd76a" : "#6a5aa0"}
                  opacity="0.9"
                />
              );
            }),
          )}
        </g>
      ))}
    </Frame>
  );
}

function Aurora() {
  return (
    <Frame anchor="top">
      {Array.from({ length: 22 }).map((_, i) => (
        <circle key={i} className="s-twinkle" style={{ animationDelay: `${(i % 6) * 0.5}s` }} cx={(i * 47 + 9) % 198} cy={(i * 61 + 12) % 150} r={i % 4 === 0 ? 1.6 : 1} fill="#fff" opacity={0.4 + (i % 3) * 0.2} />
      ))}
      {/* shimmering aurora ribbons */}
      <path className="s-aurora" d="M-10 70 Q50 30 100 70 T210 60 V150 H-10 Z" fill="#3cdca0" opacity="0.28" />
      <path className="s-aurora" style={{ animationDelay: "1.5s" }} d="M-10 92 Q60 52 120 92 T210 84 V150 H-10 Z" fill="#5aa0ff" opacity="0.26" />
      <path className="s-aurora" style={{ animationDelay: "3s" }} d="M-10 112 Q70 78 130 112 T210 106 V150 H-10 Z" fill="#a06bdc" opacity="0.28" />
    </Frame>
  );
}

function Crystal() {
  const gem = (x: number, y: number, s: number, c: string) => (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity="0.9">
      <path d="M0 -14 L10 -4 L6 14 L-6 14 L-10 -4 Z" fill={c} />
      <path d="M0 -14 L10 -4 L0 0 Z" fill="#ffffff" opacity="0.5" />
      <path d="M0 0 L6 14 L-6 14 Z" fill="#000000" opacity="0.08" />
    </g>
  );
  return (
    <Frame>
      {Array.from({ length: 12 }).map((_, i) => (
        <path
          key={i}
          d="M0 -2.2l0.65 1.4 1.55 0.22-1.1 1.1 0.26 1.55L0 1.3l-1.36 0.72 0.26-1.55-1.1-1.1 1.55-0.22z"
          transform={`translate(${(i * 43 + 16) % 190} ${(i * 51 + 20) % 130}) scale(${1 + (i % 3) * 0.6})`}
          fill="#fff"
          opacity="0.7"
        />
      ))}
      {gem(40, 168, 1.6, "#7fd8ff")}
      {gem(100, 176, 2.1, "#c9a7ff")}
      {gem(158, 168, 1.7, "#ff9ed8")}
      {gem(70, 182, 1.2, "#a7ffe0")}
      {gem(132, 184, 1.3, "#ffd7a7")}
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
  "bg-beach": Beach,
  "bg-meadow": Meadow,
  "bg-rainbow": Rainbow,
  "bg-night": Night,
  "bg-city": City,
  "bg-aurora": Aurora,
  "bg-crystal": Crystal,
};

export function SceneArt({ bgId }: { bgId: string }) {
  const Scene = SCENES[bgId];
  return Scene ? <Scene /> : null;
}
