/* Service worker - offline PWA cache */
const CACHE = "kultprogulki-v48";
const ASSETS = [
  "./",
  "./index.html",
  "./create.html",
  "./walk.html",
  "./safes-fit.html",
  "./styles.css",
  "./themes.css",
  "./theme.js",
  "./create-styles.css",
  "./shared.js",
  "./assets.js",
  "./silhouettes.js",
  "./match.js",
  "./radar.js",
  "./content-db.js",
  "./monuments-extra.js",
  "./demo-quest.js",
  "./story-pushkin.js",
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
  "./assets/ui/themes/slate.jpg",
  "./assets/ui/themes/crystal.jpg",
  "./assets/ui/themes/marble.jpg",
  "./assets/ui/themes/basalt.jpg",
  "./assets/maps/pushkin-route.jpg",
  "./assets/maps/walker-3d.svg",
  "./assets/maps/tverskoy-clock.jpg",
  "./assets/ui/antique-letter.jpg",
  "./assets/fonts/Montserrat-Variable.ttf",
  "./assets/fonts/Manrope-Variable.ttf",
  "./assets/fonts/Rubik-Variable.ttf",
  "./assets/fonts/Poppins-Bold.ttf",
  "./assets/fonts/Poppins-Regular.ttf",
  "./assets/fonts/PlayfairDisplay-Variable.ttf",
  "./assets/fonts/Oswald-Variable.ttf",
  "./assets/contours/pushkin-side-sticker.png",
  "./assets/contours/pushkin-side-sticker-preview.png",
  "./assets/contours/pushkin-side-sticker-mask.png",
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
  // HTML/JS/CSS  ñíà÷àëà ñåòü, ÷òîáû ïðàâêè UI íå çàëèïàëè â êýøå
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
