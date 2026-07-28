"use client";

import Link from "next/link";
import { Sunrise, Route, MessageCircle, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";

// The four-space tab bar of the target IA: Hoy · Camino · Hablar · Yo.
// Presentational: it takes the active path so preview surfaces can drive it
// without router state. Production adoption replaces mobile-nav.tsx and keeps
// its immersion rule (hidden inside sessions). Persists through lg — the old
// md cutoff stranded tablet users with a 2-link desktop header.

export interface TabItem {
  href: string;
  label: string;
  icon: typeof Sunrise;
}

export const DEFAULT_TABS: TabItem[] = [
  { href: "/", label: "Hoy", icon: Sunrise },
  { href: "/map", label: "Camino", icon: Route },
  { href: "/talk", label: "Hablar", icon: MessageCircle },
  { href: "/profile", label: "Yo", icon: CircleUser },
];

export function TabBar({
  items = DEFAULT_TABS,
  activePath,
  className,
}: {
  items?: TabItem[];
  activePath: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Principal"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/92 backdrop-blur lg:hidden",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = activePath === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {/* Active state is never color-only: a 2px top indicator + stroke weight. */}
              {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" aria-hidden />}
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.75} aria-hidden />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
