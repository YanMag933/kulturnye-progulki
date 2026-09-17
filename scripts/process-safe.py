"""Remove bg + soft-clean pngtree watermarks; export closed/open + handle disk."""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageDraw
from rembg import remove

UI = Path(__file__).resolve().parents[1] / "assets" / "ui"


def soft_dewatermark(rgba: Image.Image) -> Image.Image:
    """Reduce light semi-transparent watermark haze on dark metal."""
    arr = np.array(rgba).astype(np.float32)
    rgb = arr[:, :, :3]
    a = arr[:, :, 3]
    # luminance
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    # watermark candidates: mid-gray, low chroma, on opaque dark metal
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    mask = (a > 200) & (lum > 55) & (lum < 175) & (chroma < 28)
    # only where local neighborhood is darker (watermark lifts tone)
    from scipy import ndimage  # optional

    try:
        local = ndimage.uniform_filter(lum, size=21)
    except Exception:
        # fallback without scipy
        pil = Image.fromarray(lum.astype(np.uint8), "L").filter(ImageFilter.BoxBlur(10))
        local = np.array(pil).astype(np.float32)

    lift = lum - local
    mask &= lift > 8

    if mask.any():
        # pull toward darker local mean
        for c in range(3):
            ch = rgb[:, :, c]
            target = np.clip(local - 12, 0, 255)
            ch[mask] = ch[mask] * 0.35 + target[mask] * 0.65
            rgb[:, :, c] = ch

    out = np.dstack([rgb, a]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def remove_near_black_bg(rgba: Image.Image, thresh: int = 18) -> Image.Image:
    arr = np.array(rgba)
    rgb = arr[:, :, :3].astype(np.int16)
    a = arr[:, :, 3].astype(np.int16)
    dark = (rgb.max(axis=2) <= thresh) & (a > 0)
    # keep dark interior pixels that are surrounded by safe (erode edge only)
    a[dark] = 0
    arr[:, :, 3] = a.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def autocrop(im: Image.Image, pad: int = 12) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(im.width, r + pad)
    b = min(im.height, b + pad)
    return im.crop((l, t, r, b))


def extract_handle(closed: Image.Image) -> tuple[Image.Image, dict]:
    """
    Find bright circular chrome handle (wheel) below dial on closed safe.
    Returns circular RGBA crop + meta (cx, cy relative to closed image, r).
    """
    arr = np.array(closed)
    rgb = arr[:, :, :3].astype(np.float32)
    a = arr[:, :, 3]
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    # search lower-middle of opaque region for bright disk
    ys, xs = np.where(a > 200)
    if len(xs) == 0:
        raise RuntimeError("no opaque pixels")
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    # handle typically in lower 55-85% of safe body height, center-ish
    y_lo = int(y0 + (y1 - y0) * 0.48)
    y_hi = int(y0 + (y1 - y0) * 0.88)
    x_lo = int(x0 + (x1 - x0) * 0.22)
    x_hi = int(x0 + (x1 - x0) * 0.78)
    region = lum.copy()
    region[:y_lo, :] = 0
    region[y_hi:, :] = 0
    region[:, :x_lo] = 0
    region[:, x_hi:] = 0
    region[a < 200] = 0

    # threshold bright metal
    bright = region > 145
    # find connected-ish centroid of brightest blob via max filter peak
    yy, xx = np.where(bright)
    if len(xx) < 50:
        # fallback fixed relative
        cx = int(x0 + (x1 - x0) * 0.48)
        cy = int(y0 + (y1 - y0) * 0.68)
        r = int((x1 - x0) * 0.11)
    else:
        cx = int(np.median(xx))
        cy = int(np.median(yy))
        # radius from bright extent around center
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        r = int(np.percentile(dist, 92))
        r = max(28, min(r, int((x1 - x0) * 0.18)))

    # slightly expand
    r = int(r * 1.08)
    left, top = cx - r, cy - r
    right, bottom = cx + r, cy + r
    # pad canvas
    pad_l, pad_t = max(0, -left), max(0, -top)
    crop = closed.crop((max(0, left), max(0, top), min(closed.width, right), min(closed.height, bottom)))
    # circular alpha
    disk = Image.new("RGBA", (r * 2, r * 2), (0, 0, 0, 0))
    disk.paste(crop, (pad_l, pad_t))
    mask = Image.new("L", (r * 2, r * 2), 0)
    ImageDraw.Draw(mask).ellipse((1, 1, r * 2 - 2, r * 2 - 2), fill=255)
    # soft edge
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    disk.putalpha(mask)
    meta = {"cx": cx, "cy": cy, "r": r, "w": closed.width, "h": closed.height}
    return disk, meta


def process_one(raw_name: str, out_name: str) -> Image.Image:
    raw = Image.open(UI / raw_name).convert("RGBA")
    cut = remove(raw)
    if not isinstance(cut, Image.Image):
        cut = Image.open(cut).convert("RGBA")
    cut = cut.convert("RGBA")
    cut = remove_near_black_bg(cut, thresh=22)
    try:
        cut = soft_dewatermark(cut)
    except Exception as e:
        print("dewatermark skip:", e)
    cut = autocrop(cut, pad=16)
    cut.save(UI / out_name, optimize=True)
    print("wrote", out_name, cut.size)
    return cut


def main():
    closed = process_one("safe-closed-raw.png", "safe-closed.png")
    open_im = process_one("safe-open-raw.png", "safe-open.png")
    handle, meta = extract_handle(closed)
    handle.save(UI / "safe-handle.png", optimize=True)
    # hide handle under overlay area on closed (darken circle slightly so rotating handle covers seam)
    meta_path = UI / "safe-handle-meta.json"
    import json

    meta_path.write_text(json.dumps(meta), encoding="utf-8")
    print("handle", handle.size, meta)
    print("open", open_im.size)


if __name__ == "__main__":
    main()
