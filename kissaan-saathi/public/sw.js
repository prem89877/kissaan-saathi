// Kissaan Saathi service worker.
//
// Scope is intentionally narrow: it only ever touches same-origin GET
// requests for content-hashed Next.js build assets and our own icons.
// It never intercepts:
//   - non-GET requests (login, order updates, Razorpay verify, etc.)
//   - any cross-origin request (Supabase REST/Realtime, Razorpay checkout)
//   - /api/* routes (always live, never cached)
//   - page navigations beyond a network-first + offline-fallback strategy,
//     so logged-in state, order status and prices are always fresh.

const STATIC_CACHE = "ks-static-v1";
const RUNTIME_CACHE = "ks-runtime-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leaves Supabase/Razorpay alone
  if (url.pathname.startsWith("/api/")) return; // always live

  // Page navigations: try the network first; only fall back to the offline
  // page if the request genuinely fails (no connectivity).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Next.js build assets are content-hashed (the filename changes whenever
  // the content does), and our icons are static — safe to cache-first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
  }
});
