const CACHE_NAME = "pcc-prep-assist-cache";
const META_KEY = "__cache_meta__";

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

async function broadcast(msg){
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

async function writeMeta(updatedIso){
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    META_KEY,
    new Response(JSON.stringify({ updated: updatedIso }), {
      headers: { "Content-Type": "application/json" }
    })
  );
}

self.addEventListener("message", (event) => {
  const data = event.data || {};

  // allow both {type:"..."} and plain string
  const type = typeof data === "string" ? data : data.type;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "GET_CACHE_STATUS") {
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const res = await cache.match(META_KEY);
        const payload = res ? await res.json() : {};
        event.source?.postMessage({ type: "CACHE_STATUS", payload });
      } catch (e) {
        event.source?.postMessage({ type: "CACHE_STATUS", payload: { error: true } });
      }
    })();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // cleanup old caches
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));

      // stamp "data stand" on every new SW activation
      const updated = new Date().toISOString();
      try { await writeMeta(updated); } catch (e) {}

      await self.clients.claim();

      // notify UI
      try {
        await broadcast({ type: "CACHE_UPDATED", payload: { updated } });
      } catch (e) {}
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
