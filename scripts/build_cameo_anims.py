# -*- coding: utf-8 -*-
"""Build smooth looping transparent animated WebP (and GIF) from chroma frames."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(r"C:\Users\Ян\.cursor\projects\c-Users-Desktop\assets")
DST = Path(r"c:\Users\Ян\Desktop\ЯН\Культурные прогулки\приложение\assets\fx\cameos")
DST.mkdir(parents=True, exist_ok=True)

ANIMS = {
    "anim-cat-walk.webp": {
        "frames": [f"cat-f{i}.png" for i in range(1, 7)],
        "size": (320, 280),
        "duration": 70,
        "pingpong": False,
    },
    "anim-cat-peek.webp": {
        "frames": ["cat-peek-f1.png", "cat-peek-f2.png", "cat-peek-f3.png"],
        "size": (300, 280),
        "duration": 120,
        "pingpong": True,
    },
    "anim-devil-run.webp": {
        "frames": [f"devil-f{i}.png" for i in range(1, 7)],
        "size": (320, 300),
        "duration": 65,
        "pingpong": False,
    },
    "anim-baba-chase.webp": {
        "frames": [f"baba-f{i}.png" for i in range(1, 7)],
        "size": (340, 320),
        "duration": 75,
        "pingpong": False,
    },
    "anim-worker-shout.webp": {
        "frames": [f"worker-f{i}.png" for i in range(1, 7)],
        "size": (340, 340),
        "duration": 90,
        "pingpong": True,
    },
    "anim-carriage.webp": {
        "frames": [f"carriage-f{i}.png" for i in range(1, 7)],
        "size": (560, 260),
        "duration": 70,
        "pingpong": False,
    },
}


def chroma_to_alpha(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"), dtype=np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    magenta = (r > 155) & (b > 130) & (g < 175) & ((r.astype(np.int32) + b - 2 * g) > 35)
    pink = (r > 195) & (b > 110) & (g < 185) & (r > g + 25)
    green = (g > 170) & (r < 150) & (b < 150) & (g > r + 35) & (g > b + 35)
    white = (r > 248) & (g > 248) & (b > 248)
    kill = magenta | pink | green | white
    # soften edges slightly: near-magenta fringe
    fringe = (r > 140) & (b > 120) & (g < 160) & ((r.astype(np.int32) + b - 2 * g) > 20) & ~kill
    arr[..., 3] = np.where(kill, 0, np.where(fringe, (a * 0.35).astype(np.int16), a)).astype(np.uint8)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def trim(im: Image.Image, pad: int = 4) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def fit(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    cw, ch = size
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    im = im.copy()
    im.thumbnail((cw - 8, ch - 8), Image.Resampling.LANCZOS)
    x = (cw - im.width) // 2
    y = ch - im.height - 4
    canvas.paste(im, (x, y), im)
    return canvas


def load_frames(names: list[str], size: tuple[int, int]) -> list[Image.Image]:
    out = []
    for n in names:
        p = SRC / n
        if not p.exists():
            raise FileNotFoundError(p)
        im = chroma_to_alpha(Image.open(p))
        im = trim(im)
        out.append(fit(im, size))
    return out


def expand_pingpong(frames: list[Image.Image]) -> list[Image.Image]:
    if len(frames) < 2:
        return frames
    return frames + frames[-2:0:-1]


def save_anim(path: Path, frames: list[Image.Image], duration: int) -> None:
    # WebP animated
    frames[0].save(
        path,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        lossless=False,
        quality=82,
        method=4,
    )
    # GIF fallback (palette)
    gif = path.with_suffix(".gif")
    # composite on near-transparent for GIF: keep alpha via disposal
    gframes = []
    for fr in frames:
        # quantize with alpha preserved via RGBA conversion tricks
        gframes.append(fr.convert("RGBA"))
    gframes[0].save(
        gif,
        format="GIF",
        save_all=True,
        append_images=gframes[1:],
        duration=duration,
        loop=0,
        disposal=2,
        transparency=0,
        optimize=False,
    )
    print(f"{path.name}: {len(frames)} frames, {duration}ms, {path.stat().st_size // 1024}KB")


def main() -> None:
    for name, cfg in ANIMS.items():
        frames = load_frames(cfg["frames"], cfg["size"])
        if cfg.get("pingpong"):
            frames = expand_pingpong(frames)
        save_anim(DST / name, frames, cfg["duration"])
    print("done")


if __name__ == "__main__":
    main()
