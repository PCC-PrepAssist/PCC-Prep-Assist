const CACHE_NAME = "pcc-prep-assist-cache";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./service-worker.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./Exhibition%20Mode%20Pro.pdf",
  "./ExhibitionMode_for%20pure_0.3_SW%200102.pdf"
];


self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && (data.type === "SKIP_WAITING" || data === "SKIP_WAITING")) {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin requests (GitHub Pages)
  if (url.origin !== self.location.origin) return;

  // Only handle GET requests
  if (req.method !== "GET") return;

  const isNavigation = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  event.respondWith(
    (async () => {
      try {
        // For HTML/navigations: bypass HTTP cache to get the newest version
        const res = await fetch(req, isNavigation ? { cache: "no-store" } : undefined);
        const copy = res.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, copy);
        return res;
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;

        // Offline fallback for navigations
        if (isNavigation) {
          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;
        }
        throw e;
      }
    })()
  );
});
