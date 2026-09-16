"""Cut magenta BG; split chest into lid + body for 3D open animation."""
from pathlib import Path
from PIL import Image

SRC = Path(r"C:\Users\Ян\.cursor\projects\c-Users-Desktop-bigbossyan-pwa\assets")
DST = Path(r"c:\Users\Ян\Desktop\ЯН\Культурные прогулки\приложение\assets\ui")


def remove_magenta(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r > 150 and b > 150 and g < 110:
                px[x, y] = (0, 0, 0, 0)
            elif r > 200 and b > 100 and g < 80:  # pink fringe
                px[x, y] = (0, 0, 0, 0)
            elif r < 35 and g < 35 and b < 35:
                px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im


def find_hinge_y(im: Image.Image) -> int:
    """Find horizontal seam: densest opaque row in mid band (lid/body join)."""
    w, h = im.size
    px = im.load()
    # look in middle third for brass band (high R+G relative)
    y0, y1 = int(h * 0.38), int(h * 0.62)
    best_y, best = y0, -1
    for y in range(y0, y1):
        metal = 0
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 40:
                continue
            if r > 90 and g > 60 and b < 90:  # brass-ish
                metal += 1
            elif r > 70 and g > 50 and abs(r - g) < 40 and b < r:
                metal += 1
        if metal > best:
            best, best_y = metal, y
    return best_y


def main():
    DST.mkdir(parents=True, exist_ok=True)
    chest = remove_magenta(Image.open(SRC / "chest-single-closed.png"))
    pad = 12
    full = Image.new("RGBA", (chest.width + pad * 2, chest.height + pad * 2), (0, 0, 0, 0))
    full.paste(chest, (pad, pad), chest)
    full.save(DST / "chest-closed.png")

    hinge = find_hinge_y(full)
    print("hinge_y", hinge, "h", full.height)

    w, h = full.size
    # lid = top including hinge band
    lid = full.crop((0, 0, w, hinge + 2))
    body = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    body.paste(full.crop((0, hinge - 2, w, h)), (0, hinge - 2))

    lid.save(DST / "chest-lid.png")
    body.save(DST / "chest-body.png")

    # scrolls if present
    for name in ("scroll-rolled.png", "scroll-unrolled.png"):
        p = SRC / name
        if p.exists():
            s = remove_magenta(Image.open(p))
            out = Image.new("RGBA", (s.width + 16, s.height + 16), (0, 0, 0, 0))
            out.paste(s, (8, 8), s)
            out.save(DST / name)
            print("OK", name, out.size)

    print("OK chest", full.size, "lid", lid.size, "body", body.size)


if __name__ == "__main__":
    main()
