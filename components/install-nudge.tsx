"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";
import { useSettings } from "@/lib/hooks/useSettings";
import { t } from "@/lib/i18n";

// A gentle home-screen banner for iPhone Safari tabs: installed-PWA usage is
// what protects her storage from eviction and enables push reminders, so a
// browser-tab student gets one dismissible nudge (remembered in localStorage,
// which survives independently of the app database).

const DISMISS_KEY = "clara.installNudgeDismissed";

function isIOS(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallNudge() {
  const { settings } = useSettings();
  const lang = settings.coachLanguage;
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (isIOS() && !isStandalone() && !localStorage.getItem(DISMISS_KEY)) {
        timer = setTimeout(() => setShow(true), 0);
      }
    } catch {
      /* private mode — skip the nudge */
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="animate-fade-up mt-4 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Share className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t("installTitle", lang)}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{t("installBody", lang)}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("installDismiss", lang)}
        className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
