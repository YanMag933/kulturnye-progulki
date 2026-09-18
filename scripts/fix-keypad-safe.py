"""Export keypad safe as opaque rounded plate (no holey alpha → no jagged drop-shadow).

Prefers assets/ui/safe-keypad-raw-v2.png (generated steel panel), falls back to
safe-keypad-raw.jpg.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

UI = Path(__file__).resolve().parents[1] / "assets" / "ui"


def _load_raw() -> Image.Image:
    for name in ("safe-keypad-raw-v2.png", "safe-keypad-raw.jpg"):
        p = UI / name
        if p.exists():
            return Image.open(p).convert("RGB")
    raise FileNotFoundError("no keypad raw in assets/ui")


def main() -> None:
    raw = _load_raw()
    a = np.array(raw).astype(np.float32)
    lum = 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]
    h, w = lum.shape

    # Near-white / near-black studio bg → crop to door
    # Door is dark metal with bright chrome frame — keep anything not flat white
    ys, xs = np.where(lum < 245)
    if xs.size == 0:
        ys, xs = np.where(lum > 12)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    pad = 4
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(w - 1, x1 + pad), min(h - 1, y1 + pad)
    crop = raw.crop((x0, y0, x1 + 1, y1 + 1))
    cw, ch = crop.size

    carr = np.array(crop).astype(np.float32)
    clum = 0.299 * carr[:, :, 0] + 0.587 * carr[:, :, 1] + 0.114 * carr[:, :, 2]

    # Fill residual pure-black corners (outside chrome) with door metal tone
    fill = clum < 6
    sample = carr[int(ch * 0.4) : int(ch * 0.55), int(cw * 0.35) : int(cw * 0.5)]
    tone = sample.reshape(-1, 3).mean(axis=0) if sample.size else np.array([48.0, 50.0, 54.0])
    # Prefer slightly lifted gunmetal so plate doesn't read as a black hole
    tone = np.clip(tone + 8, 0, 255)
    for c in range(3):
        chn = carr[:, :, c]
        chn[fill] = tone[c]
        carr[:, :, c] = chn

    out_rgb = Image.fromarray(carr.astype(np.uint8), "RGB")
    # Lift midtones a touch for readability on dark UI
    out_rgb = ImageEnhance.Brightness(out_rgb).enhance(1.08)
    out_rgb = ImageEnhance.Contrast(out_rgb).enhance(1.06)

    alpha = Image.new("L", (cw, ch), 0)
    radius = max(28, int(min(cw, ch) * 0.055))
    ImageDraw.Draw(alpha).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=radius, fill=255)
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))

    out = out_rgb.convert("RGBA")
    out.putalpha(alpha)

    max_w = 720
    if out.width > max_w:
        nh = int(out.height * (max_w / out.width))
        out = out.resize((max_w, nh), Image.Resampling.LANCZOS)

    dest = UI / "safe-keypad-body.png"
    out.save(dest, optimize=True)
    print("wrote", dest.name, out.size, out.mode)


if __name__ == "__main__":
    main()
