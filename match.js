/** Contour matching: extract object blob from photo and IoU vs reference mask.
 * Allowed error 10–15% ⇒ need score ≥ 0.85–0.90.
 */
window.KP_MATCH = (function () {
  const DEFAULT_MIN = 0.86; // ~14% max error

  function luminance(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /** Border median ≈ background (sky / room wall) */
  function borderMedianLum(data, w, h) {
    const vals = [];
    const push = (i) => {
      const o = i * 4;
      vals.push(luminance(data[o], data[o + 1], data[o + 2]));
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + (w - 1));
    }
    vals.sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)] || 128;
  }

  /**
   * Build binary object map: pixels much darker than border background,
   * plus strong local contrast. Morphological open/close lightly via neighbor count.
   */
  function extractObject(frame, w, h) {
    const data = frame.data;
    const bg = borderMedianLum(data, w, h);
    // Object darker than background by margin; for indoor tables bg is also dark →
    // margin fails and we also require vertical structure score later.
    const thr = Math.max(40, bg - 38);
    const raw = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const lum = luminance(data[o], data[o + 1], data[o + 2]);
      raw[i] = lum < thr ? 1 : 0;
    }
    // Drop speckles: keep pixel if ≥3 neighbors also on
    const cleaned = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!raw[i]) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            n += raw[(y + dy) * w + (x + dx)];
          }
        }
        cleaned[i] = n >= 4 ? 1 : 0;
      }
    }
    return { obj: cleaned, bgLum: bg, thr };
  }

  function maskFromImageData(maskImg, w, h) {
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      m[i] = maskImg.data[i * 4] > 180 ? 1 : 0;
    }
    return m;
  }

  function scoreCapture(video, key, opts) {
    const w = 160;
    const h = 280;
    const maskData = window.KP_SILHOUETTE_MASK && window.KP_SILHOUETTE_MASK(key, w, h);
    if (!maskData) return { ok: false, score: 0, reason: "no-mask" };

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const vw = video.videoWidth || w;
    const vh = video.videoHeight || h;
    // Same cover-fit as AR overlay region (center crop)
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const frame = ctx.getImageData(0, 0, w, h);

    const ref = maskFromImageData(maskData, w, h);
    const { obj, bgLum } = extractObject(frame, w, h);

    let maskOn = 0;
    let objOn = 0;
    let inter = 0;
    let outsideObj = 0;
    let outside = 0;

    for (let i = 0; i < w * h; i++) {
      const rm = ref[i];
      const ob = obj[i];
      if (rm) maskOn++;
      else outside++;
      if (ob) objOn++;
      if (rm && ob) inter++;
      if (!rm && ob) outsideObj++;
    }

    const uni = maskOn + objOn - inter;
    const iou = uni ? inter / uni : 0;
    const fill = maskOn ? inter / maskOn : 0; // how much of silhouette is covered by object
    const leak = outside ? outsideObj / outside : 1; // object junk outside silhouette

    // Vertical mass: monuments are tall — reject flat table blobs
    let topMass = 0;
    let botMass = 0;
    const mid = Math.floor(h * 0.45);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!ref[i] || !obj[i]) continue;
        if (y < mid) topMass++;
        else botMass++;
      }
    }
    const tallRatio = topMass + botMass ? topMass / (topMass + botMass) : 0;

    // Combined score weighted toward IoU + fill, penalize leak
    let score = 0.55 * iou + 0.35 * fill + 0.1 * (1 - Math.min(1, leak * 2));
    if (tallRatio < 0.22) score *= 0.55; // too flat / only base
    if (bgLum < 70) score *= 0.75; // very dark scene (indoor table) — harder to trust
    if (objOn < maskOn * 0.35) score *= 0.7; // almost empty
    if (leak > 0.35) score *= 0.6; // huge spill outside contour

    const minScore = (opts && opts.minScore) || DEFAULT_MIN;
    const maxError = 1 - minScore;
    const error = 1 - score;
    const ok =
      score >= minScore &&
      iou >= minScore - 0.08 &&
      fill >= 0.72 &&
      leak <= 0.18 &&
      tallRatio >= 0.2;

    return {
      ok,
      score,
      iou,
      fill,
      leak,
      tallRatio,
      error,
      maxError,
      bgLum,
      reason: ok ? "match" : "mismatch",
    };
  }

  return { scoreCapture, DEFAULT_MIN };
})();
