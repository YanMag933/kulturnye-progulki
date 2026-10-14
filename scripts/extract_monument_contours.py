"""Silhouettes from on-site photos: sticker, preview, mask."""
import cv2
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "contours"
OUT.mkdir(parents=True, exist_ok=True)


def find_photo(token):
    root = Path.home() / ".cursor" / "projects"
    hits = list(root.glob(f"**/assets/*{token}*.jpg"))
    if not hits:
        raise SystemExit("photo not found " + token)
    return hits[0]


PHOTOS = {
    "pushkin": find_photo("941fd95d"),
    "pushkin-side": find_photo("776b1372"),
    "gogol": find_photo("5013dc11"),
}

# Outer probable box (x0,y0,x1,y1). Inner sure FG. Side BG columns cut lamps/trees.
BOX = {
    # Tight X band: full pedestal, no street lamp on the right.
    "pushkin": (0.36, 0.14, 0.62, 0.90),
    "pushkin-side": (0.38, 0.05, 0.64, 0.90),
    "gogol": (0.36, 0.14, 0.64, 0.86),
}
MODE = {
    "pushkin": "band",
    "pushkin-side": "band",
    "gogol": "band",
}
SURE = {
    "pushkin": (0.42, 0.18, 0.58, 0.86),
    "pushkin-side": (0.43, 0.10, 0.60, 0.84),
    "gogol": (0.42, 0.20, 0.58, 0.80),
}
# How aggressively to shave lamp/tree spikes (0 = off).
TRIM = {
    "pushkin": 0.28,
    "pushkin-side": 0.32,
    "gogol": 0.30,
}


def largest_blob(mask):
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cnts:
        return mask
    cnt = max(cnts, key=cv2.contourArea)
    canvas = np.zeros_like(mask)
    cv2.drawContours(canvas, [cnt], -1, 255, -1)
    return canvas


def trim_lateral_spikes(mask, strength=0.32):
    """Keep the tall central column; drop thin side spikes (lamp, thin trees)."""
    if strength <= 0:
        return mask
    h, w = mask.shape
    col = (mask > 0).sum(axis=0)
    thr = max(h * 0.12, col.max() * strength)
    keep = col >= thr
    if not keep.any():
        return mask
    xs = np.where(keep)[0]
    x0, x1 = xs.min(), xs.max()
    pad = max(6, int((x1 - x0) * 0.12))
    x0, x1 = max(0, x0 - pad), min(w - 1, x1 + pad)
    out = np.zeros_like(mask)
    out[:, x0 : x1 + 1] = mask[:, x0 : x1 + 1]
    return largest_blob(out)


def extract_band(img, box):
    """Dark-vs-sky silhouette inside a hard X band (keeps lamps/trees out)."""
    h, w = img.shape[:2]
    scale = 1100 / max(h, w)
    small = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]
    x0, y0, x1, y1 = box
    rx, ry = int(x0 * sw), int(y0 * sh)
    rw, rh = max(1, int((x1 - x0) * sw)), max(1, int((y1 - y0) * sh))
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    sky = float(np.median(gray[0 : max(8, int(sh * 0.1)), :]))
    thr = max(85, sky - 28)
    dark = (gray < thr).astype(np.uint8) * 255
    gate = np.zeros_like(dark)
    gate[ry : ry + rh, rx : rx + rw] = 255
    dark = cv2.bitwise_and(dark, gate)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, k, iterations=3)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, k, iterations=1)
    dark = largest_blob(dark)
    # Per row: keep the contiguous dark run nearest to the box midline (drops lamps).
    center = rx + rw // 2
    cleaned = np.zeros_like(dark)
    for y in range(sh):
        row = dark[y]
        xs = np.where(row > 0)[0]
        if len(xs) == 0:
            continue
        # Split into contiguous runs
        runs = []
        start = xs[0]
        prev = xs[0]
        for x in xs[1:]:
            if x == prev + 1:
                prev = x
                continue
            runs.append((start, prev))
            start = prev = x
        runs.append((start, prev))
        best = min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - center))
        cleaned[y, best[0] : best[1] + 1] = 255
    cleaned = largest_blob(cleaned)
    flood = cleaned.copy()
    ff = np.zeros((sh + 2, sw + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    holes = cv2.bitwise_not(flood)
    cleaned = cv2.bitwise_or(cleaned, holes)
    cleaned = largest_blob(cleaned)
    return small, cleaned


def extract(img, box, sure, trim=0.32, mode="grab"):
    if mode == "band":
        return extract_band(img, box)

    h, w = img.shape[:2]
    scale = 1100 / max(h, w)
    small = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    sh, sw = small.shape[:2]
    x0, y0, x1, y1 = box
    rx, ry = int(x0 * sw), int(y0 * sh)
    rw, rh = max(1, int((x1 - x0) * sw)), max(1, int((y1 - y0) * sh))

    mask = np.full((sh, sw), cv2.GC_BGD, np.uint8)
    mask[ry : ry + rh, rx : rx + rw] = cv2.GC_PR_FGD
    sx0, sy0, sx1, sy1 = sure
    mask[int(sy0 * sh) : int(sy1 * sh), int(sx0 * sw) : int(sx1 * sw)] = cv2.GC_FGD
    margin = max(8, int(sw * 0.03))
    mask[:, max(0, rx - margin) : rx] = cv2.GC_BGD
    mask[:, rx + rw : min(sw, rx + rw + margin)] = cv2.GC_BGD

    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(small, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    gate = np.zeros_like(fg)
    gate[ry : ry + rh, rx : rx + rw] = 255
    fg = cv2.bitwise_and(fg, gate)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=3)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k, iterations=1)
    fg = largest_blob(fg)
    fg = trim_lateral_spikes(fg, trim)
    flood = fg.copy()
    ff = np.zeros((sh + 2, sw + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 255)
    holes = cv2.bitwise_not(flood)
    fg = cv2.bitwise_or(fg, holes)
    fg = largest_blob(fg)
    return small, fg


def crop_pad(mask, pad=0.06):
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return mask
    x0, x1 = xs.min(), xs.max()
    y0, y1 = ys.min(), ys.max()
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    px, py = int(bw * pad), int(bh * pad)
    h, w = mask.shape
    x0, y0 = max(0, x0 - px), max(0, y0 - py)
    x1, y1 = min(w - 1, x1 + px), min(h - 1, y1 + py)
    return mask[y0 : y1 + 1, x0 : x1 + 1]


def save_set(name, small, raw_mask):
    overlay = small.copy()
    cnts, _ = cv2.findContours(raw_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(overlay, cnts, -1, (40, 40, 230), 3)
    ok, buf = cv2.imencode(".png", overlay)
    (OUT / f"_{name}-overlay.png").write_bytes(buf.tobytes())

    mask = crop_pad(raw_mask)
    h, w = mask.shape
    target_h = 900
    scale = target_h / h
    mask = cv2.resize(mask, (max(1, int(w * scale)), target_h), interpolation=cv2.INTER_NEAREST)
    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    mask = cv2.GaussianBlur(mask, (5, 5), 0)
    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    sticker = np.zeros((mask.shape[0], mask.shape[1], 4), np.uint8)
    edge = cv2.morphologyEx(mask, cv2.MORPH_GRADIENT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    sticker[edge > 0] = (40, 40, 230, 255)
    preview = sticker.copy()

    def dump(filename, image):
        ok, buf = cv2.imencode(".png", image)
        if not ok:
            raise SystemExit("encode " + filename)
        (OUT / filename).write_bytes(buf.tobytes())

    dump(f"{name}-sticker-mask.png", mask)
    dump(f"{name}-sticker.png", sticker)
    dump(f"{name}-sticker-preview.png", preview)

    dbg = np.zeros((mask.shape[0], mask.shape[1], 3), np.uint8)
    dbg[:] = (30, 30, 30)
    dbg[mask > 0] = (210, 210, 210)
    dbg[edge > 0] = (40, 40, 230)
    ok, buf = cv2.imencode(".png", dbg)
    (OUT / f"_{name}-debug.png").write_bytes(buf.tobytes())
    print(name, mask.shape, int((mask > 0).mean() * 100))


def main():
    for name, path in PHOTOS.items():
        data = np.fromfile(path, dtype=np.uint8)
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        if img is None:
            raise SystemExit("missing " + path.name)
        small, fg = extract(img, BOX[name], SURE[name], TRIM[name], MODE[name])
        save_set(name, small, fg)


if __name__ == "__main__":
    main()
