# -*- coding: utf-8 -*-
"""Rebuild cameo WebP/GIF: chroma key, foot-lock, facing fix, worker pulse."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance

SRC = Path(r"C:\Users\Ян\.cursor\projects\c-Users-Desktop\assets")
DST = Path(r"c:\Users\Ян\Desktop\ЯН\Культурные прогулки\приложение\assets\fx\cameos")
DST.mkdir(parents=True, exist_ok=True)

ANIMS = {
    "anim-cat-walk.webp": {
        "frames": [f"cat4-f{i}.png" for i in range(1, 7)],
        "size": (380, 260),
        "duration": 80,
        "pingpong": False,
    },
    "anim-cat-peek.webp": {
        "frames": ["cat-peek-f1.png", "cat-peek-f2.png", "cat-peek-f3.png"],
        "size": (300, 260),
        "duration": 140,
        "pingpong": True,
    },
    "anim-devil-run.webp": {
        "frames": [f"devil4-f{i}.png" for i in range(1, 5)],
        "size": (300, 280),
        "duration": 100,
        "pingpong": False,
    },
    "anim-baba-chase.webp": {
        "frames": [f"baba4-f{i}.png" for i in range(1, 5)],
        "size": (300, 380),
        "duration": 100,
        "pingpong": False,
    },
    "anim-worker-shout.webp": {
        # built from single master — never swap clothes
        "worker_pulse": "worker4-base.png",
        "size": (260, 480),
        "duration": 280,
    },
    "anim-carriage.webp": {
        "frames": [f"carriage4-f{i}.png" for i in range(1, 5)],
        "size": (580, 240),
        "duration": 95,
        "pingpong": False,
        "carriage": True,
    },
}


def chroma_to_alpha(im: Image.Image) -> Image.Image:
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
    smear = (r > 180) & (b > 120) & (g < 90) & (r + b > g * 3 + 120)
    kill = near_bg | pure | fuchsia | green | white | smear
    new_a = np.where(kill, 0, a)
    keep = new_a > 0
    magenta_cast = keep & (r > g + 25) & (b > g + 15) & (g < 160)
    r2 = np.where(magenta_cast, np.minimum(r, g + 18), r)
    b2 = np.where(magenta_cast, np.minimum(b, g + 18), b)
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


def facing_score(im: Image.Image) -> float:
    """Positive => more opaque mass on the right (good for facing-right subjects)."""
    a = np.array(im)
    alpha = a[..., 3] > 40
    if not alpha.any():
        return 0.0
    h, w = alpha.shape
    left = alpha[:, : w // 3].sum()
    right = alpha[:, 2 * w // 3 :].sum()
    return float(right - left)


def ensure_carriage_face_right(im: Image.Image) -> Image.Image:
    """Horses (brown) must lead on the RIGHT. Flip if brown mass is on the left."""
    a = np.array(im.convert("RGBA"))
    r, g, b, al = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int), a[..., 3]
    # bay/brown horse fur (not black carriage, not gold)
    brown = (
        (al > 40)
        & (r > 70)
        & (r < 200)
        & (g > 40)
        & (g < 150)
        & (b < 110)
        & (r > b + 25)
        & (g > b + 10)
        & (r + g > b * 3)
    )
    h, w = brown.shape
    left = int(brown[:, : w // 3].sum())
    right = int(brown[:, 2 * w // 3 :].sum())
    if left > right:
        im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    # drop full-width ground strip under hooves if present
    a = np.array(im.convert("RGBA"))
    al = a[..., 3]
    row_fill = (al > 40).mean(axis=1)
    # rows that are almost a solid bar near bottom
    for y in range(a.shape[0] - 1, max(0, a.shape[0] - 40), -1):
        if row_fill[y] > 0.55:
            a[y, :, 3] = 0
        else:
            break
    return Image.fromarray(a, "RGBA")


def load_raw(names: list[str], carriage: bool = False) -> list[Image.Image]:
    out = []
    for n in names:
        p = SRC / n
        if not p.exists():
            raise FileNotFoundError(p)
        im = chroma_to_alpha(Image.open(p))
        im = trim(im)
        if carriage:
            im = ensure_carriage_face_right(im)
        out.append(im)
    return out


def fit_locked(frames: list[Image.Image], size: tuple[int, int]) -> list[Image.Image]:
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
        y = ch - nh - 2
        canvas.paste(resized, (x, y), resized)
        out.append(canvas)
    return out


def worker_pulse_frames(master: str, size: tuple[int, int]) -> list[Image.Image]:
    """One outfit forever — tiny brightness/breath pulse, hands stay at mouth."""
    im = chroma_to_alpha(Image.open(SRC / master))
    im = trim(im)
    base = fit_locked([im], size)[0]
    frames = [base]
    bright = ImageEnhance.Brightness(base).enhance(1.06)
    frames.append(bright)
    up = Image.new("RGBA", size, (0, 0, 0, 0))
    up.paste(base, (0, -3), base)
    frames.append(up)
    frames.append(bright)
    return frames


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
    try:
        frames[0].save(
            gif,
            format="GIF",
            save_all=True,
            append_images=frames[1:],
            duration=duration,
            loop=0,
            disposal=2,
            optimize=False,
        )
    except OSError as e:
        print(f"gif skip {gif.name}: {e}")
    print(f"{path.name}: {len(frames)}f x {duration}ms, {path.stat().st_size // 1024}KB")


def main() -> None:
    for name, cfg in ANIMS.items():
        if cfg.get("worker_pulse"):
            frames = worker_pulse_frames(cfg["worker_pulse"], cfg["size"])
        else:
            raw = load_raw(
                cfg["frames"],
                carriage=bool(cfg.get("carriage")),
            )
            frames = fit_locked(raw, cfg["size"])
            if cfg.get("pingpong"):
                frames = expand_pingpong(frames)
        save_anim(DST / name, frames, cfg["duration"])
    print("done")


if __name__ == "__main__":
    main()
