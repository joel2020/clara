"use client";

import { useEffect } from "react";
import { installErrorReporting, trackOncePerDay } from "@/lib/analytics";

// Registers the service worker (offline support + installable). Silent — no UI.
// Also the one client component mounted on every load, so it logs the daily
// app-open signal here.

export function PwaRegister() {
  useEffect(() => {
    trackOncePerDay("app_open");
    // Mounted app-wide, so uncaught errors anywhere are recorded from here on.
    installErrorReporting();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline is a nice-to-have; never block the app on it */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  return null;
}
