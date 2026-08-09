"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/hooks/useSettings";
import { useAccess } from "@/lib/hooks/useAccess";
import { Switch } from "@/components/ui/switch";
import { t } from "@/lib/i18n";
import { isImmersiveRoute, isLearnerNavActive, LEARNER_NAV } from "@/lib/navigation";

// Desktop nav mirrors the tab bar's four spaces — one IA on every device.
// Links appear at lg+ (below that the bottom tab bar owns navigation).
export function SiteHeader() {
  const pathname = usePathname();
  const { settings, update } = useSettings();
  const lang = settings.coachLanguage;
  // Teaching tools are for the teacher: with a real auth backend, only admin
  // accounts see the toggle. Local dev (no auth) keeps it for convenience.
  const { admin } = useAccess();
  const teacher = admin;

  if (isImmersiveRoute(pathname)) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-background/70 backdrop-blur-xl">
      {/* Colombia, up top — a quiet tricolor signature. */}
      <div className="flag-bar h-[3px] w-full" aria-hidden />
      <div className="mx-auto flex h-16 max-w-3xl items-center px-5 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <span className="font-display text-xl font-semibold tracking-tight">Clara</span>
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline">
            American English
          </span>
        </Link>

        {/* On phones and tablets the bottom tab bar owns navigation, so the
            header stays minimal: logo + sound + settings. */}
        <nav className="ml-auto flex items-center gap-5">
          {LEARNER_NAV.map((item) => {
            const active = isLearnerNavActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative hidden text-sm font-medium transition-colors lg:inline",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(item.labelKey, lang)}
                {active && (
                  <span className="absolute -bottom-1.5 left-0 h-px w-full bg-foreground" aria-hidden />
                )}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => update({ soundEnabled: !settings.soundEnabled })}
            aria-label={settings.soundEnabled ? "Mute sounds" : "Unmute sounds"}
            className="-m-1 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            {settings.soundEnabled ? <Volume2 className="size-[18px]" /> : <VolumeX className="size-[18px]" />}
          </button>

          <Link
            href="/settings"
            aria-label={t("settingsTitle", lang)}
            className={cn(
              "-m-1 grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
              pathname === "/settings" && "text-foreground",
            )}
          >
            <Settings2 className="size-[18px]" />
          </Link>

          {teacher && (
            <div className="hidden items-center gap-2 border-l border-hairline pl-5 lg:flex">
              <span className="text-xs font-medium text-muted-foreground">Instructor</span>
              <Switch
                checked={settings.instructorMode}
                onCheckedChange={(v) => update({ instructorMode: v })}
                aria-label="Toggle instructor mode"
              />
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
