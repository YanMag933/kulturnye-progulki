# -*- coding: utf-8 -*-
"""Build monument photo + object-selection outline from live photos."""
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance, ImageChops, ImageOps
import io

ROOT = Path(r"c:\Users\Ян\Desktop\ЯН\Культурные прогулки\приложение\assets")
PHOTOS = ROOT / "photos"
OUT = ROOT / "contours"
OUT.mkdir(parents=True, exist_ok=True)


def resize_max(im: Image.Image, max_side=900) -> Image.Image:
    im = im.convert("RGB")
    w, h = im.size
    scale = min(max_side / max(w, h), 1.0)
    if scale < 1:
        im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    return im


def rembg_cut(im: Image.Image) -> Image.Image | None:
    try:
        from rembg import remove, new_session
        session = new_session("u2netp")  # ~4MB, not 1GB
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        out = remove(buf.getvalue(), session=session)
        return Image.open(io.BytesIO(out)).convert("RGBA")
    except Exception as e:
        print("rembg failed:", e)
        return None


def flood_cut(im: Image.Image) -> Image.Image:
    """Fallback: remove near-corner background colors, keep central statue."""
    rgba = im.convert("RGBA")
    w, h = rgba.size
    # work on quantized image for flood
    q = im.convert("RGB").quantize(colors=32).convert("RGB")
    mask = Image.new("L", (w, h), 0)
    # seed flood from corners/edges
    from collections import deque
    px = q.load()
    visited = [[False] * w for _ in range(h)]
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    # also sample top sky band
    for x in range(0, w, max(1, w // 20)):
        seeds.append((x, 2))

    def close(a, b, tol=38):
        return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol and abs(a[2] - b[2]) <= tol

    bg = set()
    dq = deque()
    for s in seeds:
        dq.append(s)
        visited[s[1]][s[0]] = True
        bg.add(s)

    while dq:
        x, y = dq.popleft()
        c = px[x, y]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx]:
                if close(c, px[nx, ny]):
                    visited[ny][nx] = True
                    bg.add((nx, ny))
                    dq.append((nx, ny))

    # subject = not bg, then keep largest blob roughly center
    alpha = Image.new("L", (w, h), 0)
    ap = alpha.load()
    for y in range(h):
        for x in range(w):
            if (x, y) not in bg:
                ap[x, y] = 255
    alpha = alpha.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.8))
    out = Image.new("RGBA", (w, h))
    out.paste(rgba, mask=alpha)
    # force alpha from mask
    r, g, b, _ = out.split()
    return Image.merge("RGBA", (r, g, b, alpha))


def outline_from_alpha(cut: Image.Image, stroke=5, color=(255, 214, 120, 255)) -> Image.Image:
    alpha = cut.split()[-1]
    mask = alpha.point(lambda p: 255 if p > 40 else 0)
    dil = mask.filter(ImageFilter.MaxFilter(stroke * 2 + 1))
    ero = mask.filter(ImageFilter.MinFilter(max(3, stroke * 2 - 1)))
    edge = ImageChops.subtract(dil, ero)
    glow = edge.filter(ImageFilter.GaussianBlur(1.4))
    outline = Image.new("RGBA", cut.size, (0, 0, 0, 0))
    # paint edge
    px_e = edge.load()
    px_o = outline.load()
    w, h = cut.size
    for y in range(h):
        for x in range(w):
            if px_e[x, y] > 0:
                px_o[x, y] = color
    glow_rgba = Image.new("RGBA", cut.size, (0, 0, 0, 0))
    gpx = glow.load()
    gr = glow_rgba.load()
    for y in range(h):
        for x in range(w):
            a = gpx[x, y]
            if a:
                gr[x, y] = (color[0], color[1], color[2], min(150, int(a)))
    return Image.alpha_composite(glow_rgba, outline)


def dim_background(photo: Image.Image, cut: Image.Image, dim=0.42) -> Image.Image:
    base = photo.convert("RGBA")
    dimmed = ImageEnhance.Brightness(base.convert("RGB")).enhance(dim)
    dimmed = ImageEnhance.Color(dimmed).enhance(0.5).convert("RGBA")
    soft = cut.split()[-1].filter(ImageFilter.GaussianBlur(1.6))
    return Image.composite(base, dimmed, soft)


def process(src_name: str, key: str):
    src = PHOTOS / src_name
    print("load", src, src.stat().st_size)
    photo = resize_max(Image.open(src), 900)
    print("size", photo.size)
    cut = rembg_cut(photo)
    if cut is None or cut.split()[-1].getextrema()[1] < 10:
        print("using flood fallback")
        cut = flood_cut(photo)
    cut.save(OUT / f"{key}-cut.png", optimize=True)
    outline = outline_from_alpha(cut, stroke=4)
    outline.save(OUT / f"{key}-outline.png", optimize=True)
    staged = Image.alpha_composite(dim_background(photo, cut), outline)
    staged.save(OUT / f"{key}-selected.png", optimize=True)
    photo_outline = Image.alpha_composite(photo.convert("RGBA"), outline)
    photo_outline.save(OUT / f"{key}-match.png", optimize=True)
    photo.save(OUT / f"{key}-photo.jpg", quality=86, optimize=True)
    # transparent outline-only for CSS overlay on photo
    outline.save(OUT / f"{key}-outline.png", optimize=True)
    (OUT / f"{key}-source.txt").write_text(
        f"Source: {src_name}\nWikimedia Commons photo, contour extracted for object-selection overlay.\n",
        encoding="utf-8",
    )
    print("OK", key)


if __name__ == "__main__":
    process("griboedov-full.jpg", "griboedov")
    process("pushkin-full.jpg", "pushkin")
    print("DONE")
