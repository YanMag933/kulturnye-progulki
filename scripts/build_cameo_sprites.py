# -*- coding: utf-8 -*-
"""Fast chroma-key + sprite sheets for poet cameos."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(r"C:\Users\Ян\.cursor\projects\c-Users-Desktop\assets")
DST = Path(r"c:\Users\Ян\Desktop\ЯН\Культурные прогулки\приложение\assets\fx\cameos")
DST.mkdir(parents=True, exist_ok=True)

SHEETS = {
    "sheet-devil-run.png": (["devil-run-1.png", "devil-run-2.png", "devil-run-3.png", "devil-run-4.png"], 300, False),
    "sheet-baba-chase.png": (["baba-chase-1.png", "baba-chase-2.png", "baba-chase-3.png", "baba-chase-4.png"], 300, False),
    "sheet-cat-walk.png": (["cat-walk-1.png", "cat-walk-2.png", "cat-walk-3.png", "cat-walk-4.png"], 280, False),
    "sheet-cat-peek.png": (["cat-peek-1.png", "cat-peek-2.png"], 280, False),
    "sheet-worker-shout.png": (
        ["worker-shout-1.png", "worker-shout-2.png", "worker-shout-3.png", "worker-shout-4.png"],
        320,
        False,
    ),
    "sheet-carriage.png": (["carriage-1.png", "carriage-2.png", "carriage-3.png", "carriage-4.png"], 280, True),
}


def chroma_to_alpha(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"), dtype=np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    magenta = (r > 160) & (b > 140) & (g < 170) & ((r.astype(np.int32) + b - 2 * g) > 40)
    # pink / fuchsia spill
    pink = (r > 200) & (b > 120) & (g < 180) & (r > g + 30)
    green = (g > 170) & (r < 150) & (b < 150) & (g > r + 35) & (g > b + 35)
    # sample-like flat screens: very saturated magenta-ish
    sat_m = (r > 190) & (b > 190) & (g < 120)
    # near-white
    white = (r > 248) & (g > 248) & (b > 248)
    kill = magenta | pink | green | sat_m | white
    arr[..., 3] = np.where(kill, 0, a).astype(np.uint8)
    arr = arr.astype(np.uint8)
    out = Image.fromarray(arr, "RGBA")
    return out


def trim(im: Image.Image, pad: int = 6) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def fit_cell(im: Image.Image, cw: int, ch: int) -> Image.Image:
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    im = im.copy()
    im.thumbnail((cw - 12, ch - 12), Image.Resampling.LANCZOS)
    x = (cw - im.width) // 2
    y = ch - im.height - 6
    canvas.paste(im, (x, y), im)
    return canvas


def build_sheet(name: str, frames: list[str], cell_h: int, wide: bool) -> None:
    cw = int(cell_h * 1.85) if wide else cell_h
    ch = cell_h
    cells = []
    for f in frames:
        path = SRC / f
        if not path.exists():
            raise FileNotFoundError(path)
        im = chroma_to_alpha(Image.open(path))
        im = trim(im)
        cells.append(fit_cell(im, cw, ch))
    sheet = Image.new("RGBA", (cw * len(cells), ch), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        sheet.paste(c, (i * cw, 0), c)
    out = DST / name
    sheet.save(out, "PNG", optimize=True)
    a = np.array(sheet)[..., 3]
    print(f"{name}: {sheet.size}, transparent {100 * (a == 0).mean():.1f}%")


def main() -> None:
    for name, (frames, cell, wide) in SHEETS.items():
        build_sheet(name, frames, cell, wide)
    # replace single display assets with first cleaned frame of each sheet for fallbacks
    print("done")


if __name__ == "__main__":
    main()
