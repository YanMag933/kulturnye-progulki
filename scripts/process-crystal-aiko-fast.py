"""Fast cutouts without rembg: crystal (black), handle/safe (white)."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

UI = Path(__file__).resolve().parents[1] / "assets" / "ui"


def autocrop(im: Image.Image, pad: int = 8) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def cut_black(path: Path, thresh: int = 26) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.int16)
    a = arr[:, :, 3].astype(np.float32)
    mx = rgb.max(axis=2)
    # hard kill near-black
    a[mx <= thresh] = 0
    # soft fringe
    fringe = (mx > thresh) & (mx <= thresh + 22)
    a[fringe] *= (mx[fringe] - thresh) / 22.0
    arr[:, :, 3] = np.clip(a, 0, 255).astype(np.uint8)
    out = Image.fromarray(arr, "RGBA")
    return autocrop(out)


def cut_white(path: Path, thresh: int = 238) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.int16)
    a = arr[:, :, 3].astype(np.float32)
    mn = rgb.min(axis=2)
    a[mn >= thresh] = 0
    fringe = (mn < thresh) & (mn >= thresh - 24)
    a[fringe] *= (thresh - mn[fringe]) / 24.0
    arr[:, :, 3] = np.clip(a, 0, 255).astype(np.uint8)
    out = Image.fromarray(arr, "RGBA")
    # feather
    alpha = out.split()[-1].filter(ImageFilter.GaussianBlur(0.6))
    out.putalpha(alpha)
    return autocrop(out)


def patch_keyhole(body: Image.Image) -> Image.Image:
    arr = np.array(body).astype(np.float32)
    h, w = arr.shape[:2]
    cx, cy = int(w * 0.58), int(h * 0.48)
    rx, ry = int(w * 0.13), int(h * 0.15)
    yy, xx = np.ogrid[:h, :w]
    mask = ((xx - cx) / max(rx, 1)) ** 2 + ((yy - cy) / max(ry, 1)) ** 2 <= 1.0
    sample = arr[int(h * 0.40) : int(h * 0.45), int(w * 0.40) : int(w * 0.48), :3]
    tone = sample.reshape(-1, 3).mean(axis=0) if sample.size else np.array([50, 50, 50], np.float32)
    for c in range(3):
        ch = arr[:, :, c]
        ch[mask] = ch[mask] * 0.2 + tone[c] * 0.8
        arr[:, :, c] = ch
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def main():
    crystal = cut_black(UI / "crystal-raw.png", thresh=24)
    if crystal.width < 280:
        crystal = crystal.resize((crystal.width * 2, crystal.height * 2), Image.Resampling.LANCZOS)
    crystal.save(UI / "crystal.png", optimize=True)
    print("crystal", crystal.size)

    handle = cut_white(UI / "safe-aiko-handle-raw.png", thresh=236)
    arr = np.array(handle)
    a = arr[:, :, 3]
    ys, xs = np.where(a > 40)
    if len(xs) == 0:
        raise SystemExit("handle empty after cut")
    cx, cy = float(xs.mean()), float(ys.mean())
    half = int(np.ceil(max(cx, handle.width - cx, cy, handle.height - cy))) + 4
    side = half * 2
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.paste(handle, (int(round(half - cx)), int(round(half - cy))), handle)
    sq.save(UI / "safe-aiko-handle.png", optimize=True)
    print("handle", sq.size, "hub centered")

    body = cut_white(UI / "safe-aiko-raw.jpg", thresh=245)
    body = patch_keyhole(body)
    body.save(UI / "safe-aiko-body.png", optimize=True)
    print("body", body.size)

    meta = {
        "hubXPct": 50.0,
        "hubYPct": 50.0,
        "bodyCxPct": 52.5,
        "bodyCyPct": 47.5,
        "wPct": 42.0,
        "handleW": sq.width,
        "handleH": sq.height,
        "bodyW": body.width,
        "bodyH": body.height,
        "note": "handle opaque hub centered; rotate at 50/50",
    }
    (UI / "safe-aiko-meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print("DONE", meta)


if __name__ == "__main__":
    main()
