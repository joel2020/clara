import { createElement } from "react";
import { cn } from "@/lib/utils";
import { contentIcon } from "@/lib/ui/icon-map";

// A scenario's visual mark, drawn-icon first: resolves the content id (or its
// emoji) to a lucide icon on a washed chip. Unmapped future content falls back
// to the emoji so nothing ever renders blank — but mapped surfaces stop
// shipping OS emoji as product iconography.

export function ScenarioGlyph({
  id,
  emoji,
  className,
  iconClassName = "size-5",
}: {
  id?: string;
  emoji?: string;
  className?: string;
  iconClassName?: string;
}) {
  const icon = contentIcon(id, emoji);
  return (
    <span
      className={cn("grid shrink-0 place-items-center", className)}
      style={{ background: "var(--surface-wash)" }}
      aria-hidden
    >
      {icon ? (
        createElement(icon, { className: cn("text-primary", iconClassName), strokeWidth: 1.75 })
      ) : (
        <span className="text-xl leading-none">{emoji}</span>
      )}
    </span>
  );
}
