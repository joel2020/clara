"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlayCircle, MessageCircle, Headphones, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { t, type StringKey } from "@/lib/i18n";

// iPhone-first bottom tab bar. She uses the app one-handed on a phone every
// day, so the daily surfaces need to be a thumb-tap away. Shown only on hub
// pages — practice flows (/lesson, /talk, rounds) stay immersive.

const SHOW_ON = new Set(["/", "/today", "/map", "/shop", "/plan", "/dashboard"]);

const ITEMS: { href: string; label: StringKey; icon: typeof Home }[] = [
  { href: "/", label: "navHome", icon: Home },
  { href: "/today", label: "navToday", icon: PlayCircle },
  { href: "/talk", label: "navTalk", icon: MessageCircle },
  { href: "/listen", label: "navListenTab", icon: Headphones },
  { href: "/map", label: "navMap", icon: MapIcon },
];

export function MobileNav() {
  const pathname = usePathname();
  const { settings } = useSettings();
  const lang = settings.coachLanguage;

  if (!SHOW_ON.has(pathname)) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/92 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              {t(label, lang)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
