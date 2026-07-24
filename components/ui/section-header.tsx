import { cn } from "@/lib/utils";

// The app's editorial section label: a small uppercase heading with an optional
// sub-line and hairline rule. One primitive so Lessons, the shop, and the home
// modules read as one system instead of drifting on tracking/spacing.
export function SectionHeader({
  label,
  sub,
  bordered = false,
  className,
}: {
  label: string;
  sub?: string;
  /** Adds the hairline rule beneath (used on full-page section headers). */
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(bordered && "border-b border-hairline pb-4", className)}>
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-foreground">{label}</h2>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
