/** Clean EXTERNAL-ONLY silhouette SVGs — outer boundary only, no photo, no internals. */
window.KP_SILHOUETTES = {
  griboedov: {
    viewBox: "0 0 200 440",
    /* standing figure + tall pedestal + stepped base — single outer contour */
    path:
      "M100 12c-14 0-26 12-26 28s12 28 26 28 26-12 26-28-12-28-26-28zm-28 62c-8 6-14 18-12 34l8 48c-16 8-34 14-40 30-4 12 4 22 16 18l28-10 6 58h40l8-56 26 8c14 4 24-4 20-16-8-16-24-24-40-28l6-50c4-16-2-30-12-36-10-6-22-2-30 0zm-4 168h36l6 78c24 6 46 24 50 52v28H40v-26c4-30 26-50 48-56l8-76zm-36 168h120v22H68zm-16 26h152v26H52zm-14 30h180v28H38z",
  },
  pushkin: {
    viewBox: "0 0 200 440",
    path:
      "M98 10c-15 0-28 14-26 30 2 14 14 26 28 26 16 0 28-14 26-30-2-14-14-26-28-26zm-26 64c-10 8-16 24-10 42l10 40c-14 12-22 30-10 46 8 10 20 8 30 0l12-10 6 56h24l6-54 14 8c12 8 26 4 30-10 6-18-4-34-18-44l8-40c6-18-2-34-14-42-12-8-24-4-34 2zm-2 170h32l8 84c26 10 48 32 52 62v28H42v-26c2-34 24-58 50-66l8-82zm-40 180h124v24H62zm-14 28h152v26H48zm-12 30h176v28H36z",
  },
  seated: {
    viewBox: "0 0 220 360",
    path:
      "M110 16c-16 0-28 14-28 30s12 30 28 30 28-14 28-30-12-30-28-30zM72 80c-12 8-18 24-10 42l14 36c-20 6-42 4-54 18-10 12 0 26 16 24l36-6 8 28h28l6 44h-64c-18 0-28 12-22 28l18 44h120l16-44c6-16-4-28-20-28h-48l4-40 22 4c14 2 26-6 24-20-4-16-18-24-34-26l8-34c6-18 0-34-12-42-10-6-22-2-30 4zM48 292h124v20H48zM32 316h156v24H32zM20 344h180v16H20z",
  },
};

window.KP_SILHOUETTE_SVG = function (key, opts) {
  const s = window.KP_SILHOUETTES[key];
  if (!s) return "";
  const stroke = (opts && opts.stroke) || "#FFD678";
  const fill = (opts && opts.fill) || "none";
  const sw = (opts && opts.strokeWidth) || 3.4;
  const bg = opts && opts.bg;
  const opacity = (opts && opts.opacity) != null ? opts.opacity : 1;
  const bgRect = bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : "";
  return `<svg viewBox="${s.viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="opacity:${opacity}">${bgRect}<path d="${s.path}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
};

/** Rasterize silhouette mask into ImageData for AR scoring */
window.KP_SILHOUETTE_MASK = function (key, w, h) {
  const s = window.KP_SILHOUETTES[key];
  if (!s) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const path = new Path2D(s.path);
  const [, , vbW, vbH] = s.viewBox.split(" ").map(Number);
  const padX = w * 0.18;
  const padY = h * 0.08;
  const scale = Math.min((w - padX * 2) / vbW, (h - padY * 2) / vbH);
  ctx.save();
  ctx.translate((w - vbW * scale) / 2, padY);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fff";
  ctx.fill(path);
  ctx.restore();
  return ctx.getImageData(0, 0, w, h);
};
