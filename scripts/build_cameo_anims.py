# -*- coding: utf-8 -*-
"""Rebuild cameo WebP/GIF: corner chroma key + foot-locked lane."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(r"C:\Users\Ян\.cursor\projects\c-Users-Desktop\assets")
DST = Path(r"c:\Users\Ян\Desktop\ЯН\Культурные прогулки\приложение\assets\fx\cameos")
DST.mkdir(parents=True, exist_ok=True)

ANIMS = {
    "anim-cat-walk.webp": {
        "frames": [f"cat3-f{i}.png" for i in range(1, 7)],
        "size": (360, 260),
        "duration": 90,
        "pingpong": False,
    },
    "anim-cat-peek.webp": {
        "frames": ["cat-peek-f1.png", "cat-peek-f2.png", "cat-peek-f3.png"],
        "size": (300, 260),
        "duration": 140,
        "pingpong": True,
    },
    "anim-devil-run.webp": {
        "frames": [f"devil3-f{i}.png" for i in range(1, 5)],
        "size": (300, 280),
        "duration": 180,  # slow legs
        "pingpong": False,
    },
    "anim-baba-chase.webp": {
        "frames": [f"baba3-f{i}.png" for i in range(1, 7)],
        "size": (300, 380),
        "duration": 110,
        "pingpong": False,
    },
    "anim-worker-shout.webp": {
        "frames": ["worker3-f1.png", "worker3-f3.png"],  # calm pair, same framing
        "size": (260, 480),  # full-height person
        "duration": 240,  # calm pulse
        "pingpong": True,
    },
    "anim-carriage.webp": {
        "frames": [f"carriage3-f{i}.png" for i in range(1, 5)],
        "size": (580, 240),
        "duration": 110,
        "pingpong": False,
    },
}


def chroma_to_alpha(im: Image.Image) -> Image.Image:
    """Key screen BG from corner samples + classic magenta/green + despill."""
    arr = np.array(im.convert("RGBA"), dtype=np.int16)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    h, w = r.shape
    corners = np.stack(
        [
            arr[2, 2, :3],
            arr[2, w - 3, :3],
            arr[h - 3, 2, :3],
            arr[h - 3, w - 3, :3],
            arr[2, w // 2, :3],
            arr[h - 3, w // 2, :3],
            arr[h // 2, 2, :3],
            arr[h // 2, w - 3, :3],
        ]
    ).astype(np.int16)
    bg = np.median(corners, axis=0).astype(np.int16)
    dist = np.abs(r - bg[0]) + np.abs(g - bg[1]) + np.abs(b - bg[2])
    near_bg = dist < 110
    pure = (r > 190) & (b > 140) & (g < 120) & (r > g + 60) & (b > g + 40)
    fuchsia = (r > 200) & (b > 130) & (g < 100)
    green = (g > 190) & (r < 120) & (b < 120) & (g - np.maximum(r, b) > 50)
    white = (r > 245) & (g > 245) & (b > 245) & (bg[0] > 240)
    kill = near_bg | pure | fuchsia | green | white
    # leftover magenta/pink smears (under feet etc.) — high R+B, low G
    smear = (r > 180) & (b > 120) & (g < 90) & (r + b > g * 3 + 120)
    kill = kill | smear
    new_a = np.where(kill, 0, a)
    # despill remaining magenta cast on opaque pixels
    keep = new_a > 0
    magenta_cast = keep & (r > g + 25) & (b > g + 15) & (g < 160)
    # pull R/B down toward G for fringe spill
    r2 = np.where(magenta_cast, np.minimum(r, g + 18), r)
    b2 = np.where(magenta_cast, np.minimum(b, g + 18), b)
    # kill thin pink halo: low alpha already or very magenta after soft edge
    halo = keep & (r > 200) & (b > 150) & (g < 110) & ((r - g) > 80)
    new_a = np.where(halo, 0, new_a)
    arr[..., 0] = r2.astype(np.uint8)
    arr[..., 1] = g.astype(np.uint8)
    arr[..., 2] = b2.astype(np.uint8)
    arr[..., 3] = new_a.astype(np.uint8)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def trim(im: Image.Image, pad: int = 2) -> Image.Image:
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def load_raw(names: list[str]) -> list[Image.Image]:
    out = []
    for n in names:
        p = SRC / n
        if not p.exists():
            raise FileNotFoundError(p)
        im = chroma_to_alpha(Image.open(p))
        im = trim(im)
        out.append(im)
    return out


def fit_locked(frames: list[Image.Image], size: tuple[int, int]) -> list[Image.Image]:
    """Each frame fills the same height; feet sit on one baseline (no Y bob)."""
    cw, ch = size
    target_h = ch - 8
    target_w = cw - 8
    out = []
    for im in frames:
        if im.height < 1 or im.width < 1:
            out.append(Image.new("RGBA", (cw, ch), (0, 0, 0, 0)))
            continue
        scale = target_h / im.height
        if im.width * scale > target_w:
            scale = target_w / im.width
        nw = max(1, int(round(im.width * scale)))
        nh = max(1, int(round(im.height * scale)))
        resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        x = (cw - nw) // 2
        y = ch - nh - 2  # foot-lock
        canvas.paste(resized, (x, y), resized)
        out.append(canvas)
    return out


def expand_pingpong(frames: list[Image.Image]) -> list[Image.Image]:
    if len(frames) < 2:
        return frames
    return frames + frames[-2:0:-1]


def save_anim(path: Path, frames: list[Image.Image], duration: int) -> None:
    frames[0].save(
        path,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=0,
        lossless=False,
        quality=86,
        method=4,
    )
    gif = path.with_suffix(".gif")
    # GIF needs palette; use transparency index 0 after converting carefully
    gif_frames = []
    for fr in frames:
        # composite on near-black then convert — keep alpha via disposal
        rgba = fr.convert("RGBA")
        gif_frames.append(rgba)
    gif_frames[0].save(
        gif,
        format="GIF",
        save_all=True,
        append_images=gif_frames[1:],
        duration=duration,
        loop=0,
        disposal=2,
        optimize=False,
    )
    print(f"{path.name}: {len(frames)}f x {duration}ms, {path.stat().st_size // 1024}KB")


def main() -> None:
    for name, cfg in ANIMS.items():
        raw = load_raw(cfg["frames"])
        frames = fit_locked(raw, cfg["size"])
        if cfg.get("pingpong"):
            frames = expand_pingpong(frames)
        save_anim(DST / name, frames, cfg["duration"])
    print("done")


if __name__ == "__main__":
    main()
