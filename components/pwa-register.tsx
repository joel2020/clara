"use client";

import { useEffect } from "react";
import { installErrorReporting, trackOncePerDay } from "@/lib/analytics";
import { canReloadForAppUpdate, serviceWorkerUrl } from "@/lib/pwa-update";

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
    const pendingKey = "clara-app-update-pending";
    let registration: ServiceWorkerRegistration | null = null;
    let reloading = false;
    let hadController = Boolean(navigator.serviceWorker.controller);

    const applyUpdateWhenSafe = () => {
      if (reloading || document.visibilityState !== "visible") return;
      if (!canReloadForAppUpdate(window.location.pathname)) {
        sessionStorage.setItem(pendingKey, "1");
        return;
      }
      reloading = true;
      sessionStorage.removeItem(pendingKey);
      window.location.reload();
    };

    const onControllerChange = () => {
      // A first-time service-worker install does not mean the page is stale.
      // Only refresh when this tab already had a controller and a newer one
      // replaces it.
      if (!hadController) {
        hadController = true;
        return;
      }
      applyUpdateWhenSafe();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      // Returning to the app is a natural, low-disruption time to discover a
      // deployment and to apply one deferred during an active lesson.
      void registration?.update();
      if (sessionStorage.getItem(pendingKey) === "1") applyUpdateWhenSafe();
    };

    const onLoad = async () => {
      try {
        registration = await navigator.serviceWorker.register(
          serviceWorkerUrl(process.env.NEXT_PUBLIC_CLARA_BUILD_ID),
          {
            updateViaCache: "none",
          },
        );
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        document.addEventListener("visibilitychange", onVisibilityChange);
        await registration.update();
      } catch {
        /* offline is a nice-to-have; never block the app on it */
      }
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
