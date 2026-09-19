/* Service worker — offline PWA cache */
const CACHE = "kultprogulki-v28";
const ASSETS = [
  "./",
  "./index.html",
  "./create.html",
  "./walk.html",
  "./safes-fit.html",
  "./styles.css",
  "./create-styles.css",
  "./shared.js",
  "./assets.js",
  "./silhouettes.js",
  "./match.js",
  "./radar.js",
  "./content-db.js",
  "./monuments-extra.js",
  "./demo-quest.js",
  "./walk.js",
  "./create.js",
  "./mechanics-data.js",
  "./manifest.json",
  "./icon.svg",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./assets/ui/safe-aiko-body.png",
  "./assets/ui/safe-aiko-handle.png",
  "./assets/ui/safe-dial-body.png",
  "./assets/ui/safe-keypad-body.png",
  "./assets/ui/crystal.png",
  "./assets/ui/scroll-rolled.png",
  "./assets/ui/scroll-unrolled.png",
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
  const url = new URL(req.url);
  const path = url.pathname;
  // HTML/JS/CSS — сначала сеть, чтобы правки UI не залипали в кэше
  const networkFirst =
    req.mode === "navigate" ||
    path.endsWith(".html") ||
    path.endsWith(".js") ||
    path.endsWith(".css") ||
    path.endsWith("/sw.js") ||
    /\/(index|walk|safes-fit|radar|styles)(\.html|\.js|\.css)?$/.test(path) ||
    path.endsWith("/");

  if (networkFirst) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

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
