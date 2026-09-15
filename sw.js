/* Service worker — offline PWA cache */
const CACHE = "kultprogulki-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./create.html",
  "./walk.html",
  "./styles.css",
  "./create-styles.css",
  "./shared.js",
  "./assets.js",
  "./silhouettes.js",
  "./content-db.js",
  "./demo-quest.js",
  "./walk.js",
  "./create.js",
  "./mechanics-data.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
