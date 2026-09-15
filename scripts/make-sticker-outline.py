"""Solid red mask → outer-only thin red sticker outline (no internals)."""
from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(r"c:\Users\Ян\Desktop\ЯН\Культурные прогулки\приложение\assets\contours")
SRC = Path(r"C:\Users\Ян\.cursor\projects\c-Users-Desktop-bigbossyan-pwa\assets")
STROKE = 3  # ~0.5mm on phone screen at typical density
PAD = 28


def to_binary_mask(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    out = Image.new("L", (w, h), 0)
    sp, dp = im.load(), out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            if a > 30 and r > 90 and r >= g + 20 and r >= b + 20:
                dp[x, y] = 255
            elif a > 30 and (r + g + b) > 100 and not (r < 40 and g < 40 and b < 40):
                # non-black opaque fallback
                if r > g and r > b:
                    dp[x, y] = 255
    # close small gaps / remove speckles
    out = out.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    out = out.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    return out


def fill_holes(mask: Image.Image) -> Image.Image:
    """Keep only exterior background; fill interior holes as foreground."""
    w, h = mask.size
    px = mask.load()
    # flood-fill exterior from borders through black pixels
    seen = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if px[x, y] < 128:
                q.append((x, y))
                seen[y][x] = True
    for y in range(h):
        for x in (0, w - 1):
            if px[x, y] < 128 and not seen[y][x]:
                q.append((x, y))
                seen[y][x] = True
    while q:
        x, y = q.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] < 128:
                seen[ny][nx] = True
                q.append((nx, ny))
    filled = Image.new("L", (w, h), 255)
    fp = filled.load()
    for y in range(h):
        for x in range(w):
            if seen[y][x]:
                fp[x, y] = 0
    return filled


def outer_ring(mask: Image.Image, stroke: int) -> Image.Image:
    """Pixels of FG that touch exterior BG, thickened to `stroke`."""
    w, h = mask.size
    mp = mask.load()
    edge = Image.new("L", (w, h), 0)
    ep = edge.load()
    for y in range(h):
        for x in range(w):
            if mp[x, y] < 128:
                continue
            border = False
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or ny < 0 or nx >= w or ny >= h or mp[nx, ny] < 128:
                    border = True
                    break
            if border:
                ep[x, y] = 255
    # thicken
    for _ in range(max(0, stroke - 1)):
        edge = edge.filter(ImageFilter.MaxFilter(3))
    return edge


def export(name: str, src: Path) -> None:
    mask = fill_holes(to_binary_mask(Image.open(src)))
    bbox = mask.getbbox()
    if not bbox:
        raise SystemExit(f"empty mask: {src}")
    x0, y0, x1, y1 = bbox
    x0, y0 = max(0, x0 - PAD), max(0, y0 - PAD)
    x1, y1 = min(mask.width, x1 + PAD), min(mask.height, y1 + PAD)
    mask = mask.crop((x0, y0, x1, y1))
    tw = 440
    th = max(1, int(mask.height * (tw / mask.width)))
    mask = mask.resize((tw, th), Image.Resampling.NEAREST)
    mask = fill_holes(mask)

    ring = outer_ring(mask, STROKE)

    rgba = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    rp, op = ring.load(), rgba.load()
    for y in range(mask.height):
        for x in range(mask.width):
            if rp[x, y] > 128:
                op[x, y] = (255, 48, 58, 255)

    preview = Image.new("RGBA", mask.size, (10, 9, 8, 255))
    preview.alpha_composite(rgba)

    score = Image.new("L", mask.size, 0)
    score.paste(255, mask=mask)

    ROOT.mkdir(parents=True, exist_ok=True)
    rgba.save(ROOT / f"{name}-sticker.png")
    preview.save(ROOT / f"{name}-sticker-preview.png")
    score.save(ROOT / f"{name}-sticker-mask.png")
    print(f"OK {name} {mask.size}")


def main():
    jobs = [
        ("pushkin", SRC / "pushkin-red-mask.png"),
        ("griboedov", SRC / "griboedov-red-mask-v2.png"),
        ("seated", SRC / "seated-red-mask.png"),
    ]
    for name, path in jobs:
        if path.exists():
            export(name, path)
        else:
            print("missing", path)


if __name__ == "__main__":
    main()
