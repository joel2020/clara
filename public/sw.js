// Clara service worker — offline support so practice keeps working on the train.
// App shell: network-first (always fresh when online, cached fallback offline).
// Audio clips + icons: cache-first (immutable, and there are hundreds of them —
// caching on first play means her practiced words work offline forever).

const SHELL_CACHE = "clara-shell-v1";
// Bump ASSET_CACHE whenever an image is REPLACED at an existing path (e.g. the
// Lumi poses were regenerated in place). Images are served cache-first, so an
// installed PWA otherwise keeps the old art forever; renaming the cache makes
// `activate` drop the stale one and refetch on next use. Audio filenames are
// content-hashed, so re-downloading them is the only cost, once.
const ASSET_CACHE = "clara-assets-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// Daily practice reminders — payload is JSON {title, body, url}.
self.addEventListener("push", (event) => {
  let data = { title: "Clara", body: "¡Lumi te espera! · Lumi is waiting!", url: "/today" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the transcription API.
  if (url.pathname.startsWith("/api/")) return;

  // Audio + icons: cache-first, immutable.
  if (url.pathname.startsWith("/audio/") || url.pathname.startsWith("/icon-") || url.pathname.endsWith(".png")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return hit ?? Response.error();
        }
      }),
    );
    return;
  }

  // Everything else (pages, Next assets): network-first, cache fallback.
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        if (res.ok && (request.mode === "navigate" || url.pathname.startsWith("/_next/"))) {
          const cache = await caches.open(SHELL_CACHE);
          cache.put(request, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        return Response.error();
      }
    })(),
  );
});
