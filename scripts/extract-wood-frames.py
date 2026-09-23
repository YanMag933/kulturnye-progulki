"""Extract wood frame / corner / button assets from the UI sprite sheet."""
from __future__ import annotations

import os
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "ui", "frames", "wood-metal-leaves.jpg")
OUT = os.path.join(ROOT, "assets", "ui", "frames")

im = Image.open(SRC).convert("RGBA")
w, h = im.size
px = im.load()
bg = (95, 96, 98)


def is_bg(c, tol=28):
    return abs(c[0] - bg[0]) <= tol and abs(c[1] - bg[1]) <= tol and abs(c[2] - bg[2]) <= tol


mask = Image.new("L", (w, h), 0)
mp = mask.load()
for y in range(h):
    for x in range(w):
        if not is_bg(px[x, y]):
            mp[x, y] = 255

visited = [[False] * w for _ in range(h)]


def flood(sx, sy):
    if visited[sy][sx] or mp[sx, sy] == 0:
        return None
    q = deque([(sx, sy)])
    visited[sy][sx] = True
    minx = maxx = sx
    miny = maxy = sy
    n = 0
    while q:
        x, y = q.popleft()
        n += 1
        minx = min(minx, x)
        maxx = max(maxx, x)
        miny = min(miny, y)
        maxy = max(maxy, y)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and mp[nx, ny]:
                visited[ny][nx] = True
                q.append((nx, ny))
    return (n, minx, miny, maxx, maxy)


blobs = []
for y in range(0, h, 2):
    for x in range(0, w, 2):
        r = flood(x, y)
        if r and r[0] > 800:
            blobs.append(r)
blobs.sort(reverse=True)
print("top blobs:")
for b in blobs[:12]:
    n, x0, y0, x1, y1 = b
    print(n, x0, y0, x1, y1, "size", x1 - x0 + 1, y1 - y0 + 1)

frame_blob = None
for b in blobs:
    n, x0, y0, x1, y1 = b
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    ar = bw / max(bh, 1)
    if 0.85 <= ar <= 1.15 and bw > 180 and bh > 180:
        frame_blob = b
        break
print("frame_blob", frame_blob)

corner_blob = None
for b in blobs:
    n, x0, y0, x1, y1 = b
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    if x0 < 80 and y0 < 80 and bw > 120 and bh > 120 and bw < 280:
        corner_blob = b
        break
print("corner_blob", corner_blob)

btn_blobs = [
    b for b in blobs if b[1] > 600 and (b[4] - b[2]) < 70 and (b[3] - b[1]) > 120
]
print("btn count", len(btn_blobs))

os.makedirs(OUT, exist_ok=True)


def clear_bg(img, tol=32):
    p = img.load()
    iw, ih = img.size
    for y in range(ih):
        for x in range(iw):
            if is_bg(p[x, y], tol):
                p[x, y] = (0, 0, 0, 0)


if frame_blob:
    n, x0, y0, x1, y1 = frame_blob
    pad = 4
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w - 1, x1 + pad)
    y1 = min(h - 1, y1 + pad)
    frame = im.crop((x0, y0, x1 + 1, y1 + 1))
    clear_bg(frame)
    fp = frame.load()
    fw, fh = frame.size
    cx, cy = fw // 2, fh // 2
    q = deque([(cx, cy)])
    seen = {(cx, cy)}
    while q:
        x, y = q.popleft()
        r, g, b, a = fp[x, y]
        is_wood = r > 90 and g > 50 and b < 90 and r > g + 15
        is_metal = a > 200 and abs(r - g) < 40 and abs(g - b) < 40 and r > 140
        is_leaf = (r > 140 and g > 80 and b < 100) or (r > 160 and g > 120 and b < 80)
        if is_wood or is_metal or is_leaf:
            continue
        is_hole = (
            a < 10
            or (abs(r - g) < 18 and abs(g - b) < 18 and r < 140)
            or is_bg((r, g, b, a), 40)
        )
        if not is_hole and a > 180 and (r + g + b) > 200:
            continue
        fp[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < fw and 0 <= ny < fh and (nx, ny) not in seen:
                seen.add((nx, ny))
                q.append((nx, ny))
    frame.save(os.path.join(OUT, "wood-frame.png"))
    print("saved wood-frame", frame.size)

if corner_blob:
    n, x0, y0, x1, y1 = corner_blob
    pad = 2
    corner = im.crop(
        (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + 1 + pad), min(h, y1 + 1 + pad))
    )
    clear_bg(corner)
    corner.save(os.path.join(OUT, "wood-corner.png"))
    corner.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(OUT, "wood-corner-tr.png"))
    corner.transpose(Image.FLIP_TOP_BOTTOM).save(os.path.join(OUT, "wood-corner-bl.png"))
    corner.transpose(Image.FLIP_LEFT_RIGHT).transpose(Image.FLIP_TOP_BOTTOM).save(
        os.path.join(OUT, "wood-corner-br.png")
    )
    print("saved corners", corner.size)

for b in btn_blobs:
    n, x0, y0, x1, y1 = b
    btn = im.crop((x0, y0, x1 + 1, y1 + 1))
    bp = btn.load()
    bw, bh = btn.size
    bright = 0
    for y in range(bh):
        for x in range(bw):
            r, g, b2, a = bp[x, y]
            if r > 180 and g > 150 and b2 < 120:
                bright += 1
            if is_bg(bp[x, y], 32):
                bp[x, y] = (0, 0, 0, 0)
    print("btn bright", bright, bw, bh)
    if bright < bw * bh * 0.02 and bw > 150:
        btn.save(os.path.join(OUT, "wood-btn.png"))
        print("saved wood-btn", btn.size)
        break

for f in os.listdir(OUT):
    if f.startswith("_tmp-"):
        os.remove(os.path.join(OUT, f))
print("done")
