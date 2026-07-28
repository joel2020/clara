import { cn } from "@/lib/utils";

// Progress primitives of the design system. Two shapes only: a 6px bar and a
// 44px ring. Both animate their fill via CSS transition (transform/stroke are
// GPU-cheap) and read correctly with the reduced-motion kill switch.

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  /** Accessible name; required whenever the bar isn't adjacent to its own label. */
  label?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-lg bg-muted", className)}
    >
      <div
        className="h-full rounded-lg bg-primary transition-[width] duration-[var(--dur-gentle)]"
        style={{ width: `${pct}%`, transitionTimingFunction: "var(--ease-out)" }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  max = 100,
  size = 44,
  label,
  children,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  label?: string;
  /** Center content — a step number, a check icon. */
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset var(--dur-gentle) var(--ease-out)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
