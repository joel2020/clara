import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// The honesty architecture as components: earned numbers are ink with a
// tricolor stamp underline; estimated numbers are ghosts that say so. A screen
// shows at most one big number, and only once it means something — zeros render
// as promises, not dashboards (see EmptyState for that path).

export function EarnedStat({
  value,
  label,
  detail,
  className,
}: {
  value: string;
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="type-data-big text-foreground">
        {value}
        <span className="mt-1 block h-[3px] w-10 rounded-full flag-bar" aria-hidden />
      </span>
      <span className="type-label">{label}</span>
      {detail && <span className="type-support">{detail}</span>}
    </div>
  );
}

export function EstimatedStat({
  value,
  label,
  estimatedTag = "estimado",
  className,
}: {
  value: string;
  label: string;
  /** The word shown beside the value — always visible, never fine print. */
  estimatedTag?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="flex items-baseline gap-2">
        <span className="type-data-big" style={{ color: "var(--estimated)" }}>
          {value}
        </span>
        <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {estimatedTag}
        </span>
      </span>
      <span className="type-label">{label}</span>
    </div>
  );
}

/** A quiet metric row — replaces stat-chip card grids (no cards inside cards). */
export function StatRow({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon?: LucideIcon;
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", className)}>
      {Icon && <Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden />}
      <span className="type-body flex-1">{label}</span>
      <span className="type-data text-foreground">{value}</span>
    </div>
  );
}
