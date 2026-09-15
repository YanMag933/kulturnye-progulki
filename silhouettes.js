/** Sticker-style outer contours: thin red outline PNGs (no photo, no internals). */
window.KP_SILHOUETTES = {
  griboedov: {
    sticker: "assets/contours/griboedov-sticker.png",
    preview: "assets/contours/griboedov-sticker-preview.png",
    mask: "assets/contours/griboedov-sticker-mask.png",
  },
  pushkin: {
    sticker: "assets/contours/pushkin-sticker.png",
    preview: "assets/contours/pushkin-sticker-preview.png",
    mask: "assets/contours/pushkin-sticker-mask.png",
  },
  seated: {
    sticker: "assets/contours/seated-sticker.png",
    preview: "assets/contours/seated-sticker-preview.png",
    mask: "assets/contours/seated-sticker-mask.png",
  },
};

window.KP_SILHOUETTE_HTML = function (key, mode) {
  const s = window.KP_SILHOUETTES[key];
  if (!s) return "";
  const src = mode === "ar" ? s.sticker : s.preview || s.sticker;
  const cls = mode === "ar" ? "sticker-outline ar" : "sticker-outline guess";
  return `<img class="${cls}" src="${src}" alt="Контур памятника" draggable="false" />`;
};

window.KP_SILHOUETTE_SVG = function (key) {
  return window.KP_SILHOUETTE_HTML(key, "guess");
};

window.KP_SILHOUETTE_MASK = function (key, w, h) {
  const cached = window.__KP_MASK_CACHE && window.__KP_MASK_CACHE[key];
  if (!cached) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(cached, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
};

window.KP_PRELOAD_SILHOUETTES = function () {
  window.__KP_MASK_CACHE = window.__KP_MASK_CACHE || {};
  return Promise.all(
    Object.keys(window.KP_SILHOUETTES).map(
      (key) =>
        new Promise((resolve) => {
          const s = window.KP_SILHOUETTES[key];
          const img = new Image();
          img.onload = () => {
            window.__KP_MASK_CACHE[key] = img;
            resolve();
          };
          img.onerror = () => resolve();
          img.src = s.mask;
          const st = new Image();
          st.src = s.sticker;
          const pr = new Image();
          pr.src = s.preview;
        })
    )
  );
};
