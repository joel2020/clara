"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecentAttempts } from "@/lib/hooks/useData";
import { CATEGORY_BY_ID } from "@/lib/content/categories";

// Instructor view of recent attempts — exactly what to target in the next live
// session: what she aimed for, what the recognizer heard, and the score.

export function RecentAttempts() {
  const attempts = useRecentAttempts(30);

  if (!attempts) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (attempts.length === 0) {
    return <p className="text-sm text-muted-foreground">No attempts yet. They&apos;ll appear here as she practices.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {attempts.map((a) => (
        <li key={a.id} className="flex items-center gap-3 py-2.5">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full text-white",
              a.passed ? "bg-success" : "bg-destructive",
            )}
          >
            {a.passed ? <Check className="size-4" /> : <X className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {a.target}
              {a.heard && a.heard.toLowerCase() !== a.target.toLowerCase() && (
                <span className="font-normal text-muted-foreground"> → heard “{a.heard}”</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {CATEGORY_BY_ID.get(a.categoryId)?.label ?? a.categoryId} · {timeAgo(a.at)}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
              a.passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {a.score}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
