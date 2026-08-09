"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sunrise, Route, MessageCircle, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";
import { isImmersiveRoute, isLearnerNavActive, LEARNER_NAV, type LearnerNavIcon } from "@/lib/navigation";

// The four-space tab bar: Hoy · Camino · Hablar · Yo. Closet lives under Yo,
// so the daily learning loop never competes with a store destination.
// Practice drills are no longer destinations here — Hoy deals
// them out. Shown on hub pages only; immersive flows (/lesson, rounds, the
// call) stay full-screen. Persists through lg so tablet users keep touch nav —
// the old md cutoff stranded 768px tablets on a two-link desktop header.

const SHOW_ON = new Set([
  "/",
  "/map",
  "/talk",
  "/shop",
  "/plan",
  "/dashboard",
  "/lessons",
  "/settings",
  "/mundo",
  "/profile",
]);

const ICONS: Record<LearnerNavIcon, typeof Sunrise> = {
  sunrise: Sunrise,
  route: Route,
  message: MessageCircle,
  profile: CircleUser,
};

export function MobileNav() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;

  if (!SHOW_ON.has(pathname) || isImmersiveRoute(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/92 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Principal"
    >
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {LEARNER_NAV.map((item) => {
          const { href, labelKey, icon } = item;
          const Icon = ICONS[icon];
          const active = isLearnerNavActive(item, pathname);
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
              {/* Never color-only: active adds a top indicator + heavier stroke. */}
              {active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary" aria-hidden />
              )}
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.75} aria-hidden />
              {t(labelKey, lang)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
